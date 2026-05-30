import { decrypt } from '../../utils/crypto.js';
import { logger } from '../../utils/logger.js';
import {
    tourcmsClient,
    extractComponentKey,
    extractBookingId,
} from '../../services/integrations/tourcms/client.js';
import { ventrataClient } from '../../services/integrations/ventrata/client.js';

function supplierApiKey(supplier) {
    if (!supplier?.apiKey) return null;
    try {
        return decrypt(supplier.apiKey);
    } catch (err) {
        logger.warn({ err: err?.message }, 'failed to decrypt supplier apiKey');
        return null;
    }
}

export async function placeVendorBooking({ tour, supplier, booking, customer }) {
    if (!tour || tour.apiType === 'NONE') return null;
    try {
        if (tour.apiType === 'TOURCMS') {
            const channelId = supplier?.apiChannelId ? Number(supplier.apiChannelId) : undefined;
            const date = booking.travelDate.toISOString().slice(0, 10);
            const paxCount = Number(booking.paxCount) || 1;

            // 1. Live availability → bookable component_key (rate 1 = adult).
            const avail = await tourcmsClient.checkAvailability({
                channelId,
                tourId: tour.apiId,
                date,
                rateQs: `r1=${paxCount}`,
            });
            const componentKey = extractComponentKey(avail);
            if (!componentKey) {
                return { provider: 'TOURCMS', externalRef: null, payload: { avail }, status: 'FAILED' };
            }

            // 2. Start new (temporary) booking with that component_key.
            const start = await tourcmsClient.startNewBooking({
                channelId,
                payload: {
                    componentKey,
                    totalCustomers: paxCount,
                    startDate: date,
                    customers: [
                        {
                            firstname: (booking.leadGuestName || '').split(' ')[0] || 'Guest',
                            surname: (booking.leadGuestName || '').split(' ').slice(1).join(' ') || '.',
                            email: booking.leadGuestEmail,
                            tel_mobile: booking.leadGuestPhone || '',
                        },
                    ],
                },
            });
            const bookingId = extractBookingId(start);
            if (!bookingId) {
                return { provider: 'TOURCMS', externalRef: null, payload: { start }, status: 'PENDING_COMMIT' };
            }

            // 3. Commit → live booking. tourcmsRequest throws on a non-OK error,
            // so reaching here means TourCMS accepted the commit.
            const commit = await tourcmsClient.commitNewBooking({ channelId, bookingId });
            return {
                provider: 'TOURCMS',
                externalRef: String(bookingId),
                payload: { start, commit },
                status: 'CONFIRMED',
            };
        }

        if (tour.apiType === 'VENTRATA') {
            const apiKey = supplierApiKey(supplier);

            // 1. Product → pick an option + its unit map (OCTO).
            const product = await ventrataClient.getProduct({ apiKey, productId: tour.apiId });
            const options = product?.options ?? [];
            const option = options.find((o) => o.default) || options[0];
            if (!option) {
                return { provider: 'VENTRATA', externalRef: null, payload: { error: 'No bookable option' }, status: 'FAILED' };
            }
            const unitByType = {};
            for (const u of option.units ?? []) {
                if (u?.type && !unitByType[u.type]) unitByType[u.type] = u.id;
            }
            const adultUnit = unitByType.ADULT || option.units?.[0]?.id;

            // 2. Availability for the travel date.
            const date = booking.travelDate.toISOString().slice(0, 10);
            const availability = await ventrataClient.checkAvailability({
                apiKey,
                payload: { productId: tour.apiId, optionId: option.id, localDateStart: date, localDateEnd: date },
            });
            const slot =
                (Array.isArray(availability) ? availability : []).find((a) => a.available) ||
                (Array.isArray(availability) ? availability[0] : null);
            if (!slot?.id) {
                return { provider: 'VENTRATA', externalRef: null, payload: { error: 'No availability', date }, status: 'FAILED' };
            }

            // 3. unitItems from the booking pax breakdown (fallback: 1 adult).
            const pax = booking.paxBreakdown && typeof booking.paxBreakdown === 'object' ? booking.paxBreakdown : {};
            const unitItems = [];
            for (const [tier, count] of Object.entries(pax)) {
                const unitId = unitByType[tier] || adultUnit;
                for (let i = 0; i < Number(count || 0); i++) unitItems.push({ unitId });
            }
            if (unitItems.length === 0 && adultUnit) unitItems.push({ unitId: adultUnit });

            // 4. Create the (unconfirmed) booking.
            const created = await ventrataClient.createBooking({
                apiKey,
                payload: {
                    productId: tour.apiId,
                    optionId: option.id,
                    availabilityId: slot.id,
                    unitItems,
                    notes: booking.notes ?? undefined,
                },
            });
            const uuid = created?.uuid || created?.id || null;
            if (!uuid) {
                return { provider: 'VENTRATA', externalRef: null, payload: { created }, status: 'PENDING_CONFIRM' };
            }

            // 5. Confirm with the lead-guest contact.
            const confirmed = await ventrataClient.confirmBooking({
                apiKey,
                uuid,
                payload: {
                    contact: {
                        fullName: booking.leadGuestName,
                        emailAddress: booking.leadGuestEmail,
                        phoneNumber: booking.leadGuestPhone ?? undefined,
                    },
                },
            });
            const okStatus = confirmed?.status === 'CONFIRMED' || confirmed?.utcConfirmedAt;
            return {
                provider: 'VENTRATA',
                externalRef: confirmed?.supplierReference || uuid,
                payload: { uuid, status: confirmed?.status, supplierReference: confirmed?.supplierReference },
                status: okStatus ? 'CONFIRMED' : 'PENDING_CONFIRM',
            };
        }
    } catch (err) {
        logger.warn({ err: err?.message, tourId: tour.id }, 'vendor booking failed — keeping local-only');
        return { provider: tour.apiType, externalRef: null, payload: { error: err?.message }, status: 'FAILED' };
    }
    return null;
}

// Cancels the booking on the supplier side. Returns { ok, raw|error } — ok is
// normalized per vendor (TourCMS replies error:"OK" on success and treats an
// already-cancelled booking as success; Ventrata DELETE needs the booking UUID
// from the stored payload, not the supplierReference).
export async function cancelVendorBooking({ tour, supplier, booking }) {
    if (!tour || tour.apiType === 'NONE' || !booking?.externalRef) return { ok: false, skipped: true };
    try {
        if (tour.apiType === 'TOURCMS') {
            const channelId = supplier?.apiChannelId ? Number(supplier.apiChannelId) : undefined;
            const res = await tourcmsClient.cancelBooking({ channelId, bookingId: booking.externalRef });
            const err = res?.error;
            const ok = !err || String(err).toUpperCase() === 'OK' || /CANCEL/i.test(String(err));
            if (!ok) logger.warn({ err, ref: booking.externalRef }, 'tourcms cancel returned non-OK');
            return { ok, raw: res };
        }
        if (tour.apiType === 'VENTRATA') {
            const apiKey = supplierApiKey(supplier);
            // The cancel endpoint keys off the booking UUID; externalRef stores the
            // (human) supplierReference, so prefer the uuid captured at booking time.
            const uuid = booking.externalPayload?.uuid || booking.externalRef;
            const res = await ventrataClient.cancelBooking({ apiKey, uuid });
            const status = String(res?.status || '').toUpperCase();
            const ok = !!(res && !res.error) && (status === '' || status === 'CANCELLED');
            if (!ok) logger.warn({ res, ref: booking.externalRef }, 'ventrata cancel returned non-cancelled');
            return { ok, raw: res };
        }
    } catch (err) {
        logger.warn({ err: err?.message, ref: booking.externalRef }, 'vendor cancel failed');
        return { ok: false, error: err?.message };
    }
    return { ok: false };
}
