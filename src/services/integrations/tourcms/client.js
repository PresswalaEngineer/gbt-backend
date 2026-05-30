import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/api-error.js';
import { logger } from '../../../utils/logger.js';

const USER_AGENT = 'gbt-admin/1.0 (+TourCMS integration)';

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    trimValues: true,
});

function rawurlencode(value) {
    return encodeURIComponent(String(value))
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');
}

export function signRequest({ channelId, marketplaceId, verb, timestamp, path, apiKey }) {
    const stringToSign = `${channelId}/${marketplaceId}/${verb}/${timestamp}${path}`;
    const hash = crypto.createHmac('sha256', apiKey).update(stringToSign).digest('base64');
    return rawurlencode(hash);
}

function ensureConfigured() {
    if (!env.TOURCMS_API_KEY || !env.TOURCMS_MARKETPLACE_ID) {
        throw ApiError.serviceUnavailable('TourCMS integration is not configured', {
            code: 'TOURCMS_NOT_CONFIGURED',
            details: {
                missing: [
                    !env.TOURCMS_API_KEY ? 'TOURCMS_API_KEY' : null,
                    !env.TOURCMS_MARKETPLACE_ID ? 'TOURCMS_MARKETPLACE_ID' : null,
                ].filter(Boolean),
            },
        });
    }
}

function bubbleUpstreamError(parsed, statusCode) {
    const errorBlock = parsed?.response?.error;
    const message =
        (typeof errorBlock === 'string' ? errorBlock : errorBlock?.error_message) ||
        parsed?.response?.error_message ||
        `TourCMS upstream returned ${statusCode}`;
    throw ApiError.badGateway(message, {
        code: 'TOURCMS_UPSTREAM_ERROR',
        details: { statusCode, upstream: parsed?.response ?? null },
    });
}

export async function tourcmsRequest({ verb = 'GET', path, channelId, body }) {
    ensureConfigured();
    if (!path || !path.startsWith('/')) {
        throw ApiError.internal('TourCMS request path must start with "/"', {
            code: 'TOURCMS_BAD_PATH',
        });
    }

    const effectiveChannelId = channelId ?? 0;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest({
        channelId: effectiveChannelId,
        marketplaceId: env.TOURCMS_MARKETPLACE_ID,
        verb,
        timestamp,
        path,
        apiKey: env.TOURCMS_API_KEY,
    });

    const url = `${env.TOURCMS_BASE_URL}${path}`;
    const headers = {
        Accept: 'application/xml',
        'x-tourcms-date': String(timestamp),
        Authorization: `TourCMS ${effectiveChannelId}:${env.TOURCMS_MARKETPLACE_ID}:${signature}`,
        'User-Agent': USER_AGENT,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/xml';

    const response = await fetch(url, {
        method: verb,
        headers,
        body: body !== undefined ? body : undefined,
    }).catch((cause) => {
        logger.error({ err: cause, url }, 'TourCMS network error');
        throw ApiError.badGateway('Could not reach TourCMS', {
            code: 'TOURCMS_NETWORK_ERROR',
            details: { url, cause: cause?.message },
        });
    });

    const text = await response.text();
    let parsed;
    try {
        parsed = xmlParser.parse(text);
    } catch (cause) {
        throw ApiError.badGateway('TourCMS returned invalid XML', {
            code: 'TOURCMS_PARSE_ERROR',
            details: { statusCode: response.status, body: text.slice(0, 400) },
        });
    }

    const status = parsed?.response?.error;
    const isOk = response.ok && (status === 'OK' || status === undefined);
    if (!isOk) {
        bubbleUpstreamError(parsed, response.status);
    }

    return parsed.response ?? {};
}

function buildBookingXml(payload) {
    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    const parts = [
        '<?xml version="1.0"?>',
        '<booking>',
        `<total_customers>${esc(payload.totalCustomers ?? payload.paxCount ?? 1)}</total_customers>`,
        '<components><component>',
        `<component_key>${esc(payload.componentKey ?? payload.tourId)}</component_key>`,
    ];
    if (payload.startDate) parts.push(`<start_date>${esc(payload.startDate)}</start_date>`);
    if (payload.note) parts.push(`<note>${esc(payload.note)}</note>`);
    parts.push('</component></components>');
    parts.push('<customers>');
    const customers = payload.customers ?? [];
    for (const c of customers) {
        parts.push('<customer>');
        if (c.firstname) parts.push(`<firstname>${esc(c.firstname)}</firstname>`);
        if (c.surname) parts.push(`<surname>${esc(c.surname)}</surname>`);
        if (c.email) parts.push(`<email>${esc(c.email)}</email>`);
        if (c.tel_mobile) parts.push(`<tel_mobile>${esc(c.tel_mobile)}</tel_mobile>`);
        parts.push('</customer>');
    }
    parts.push('</customers>');
    parts.push('</booking>');
    return parts.join('');
}

// fast-xml-parser nests booking data unpredictably across TourCMS endpoints;
// pull the first occurrence of a tag anywhere in the parsed tree.
function deepFind(obj, key) {
    if (obj == null || typeof obj !== 'object') return undefined;
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const found = deepFind(item, key);
            if (found !== undefined) return found;
        }
        return undefined;
    }
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
    for (const k of Object.keys(obj)) {
        const found = deepFind(obj[k], key);
        if (found !== undefined) return found;
    }
    return undefined;
}

export function extractComponentKey(availResponse) {
    const v = deepFind(availResponse, 'component_key');
    return v != null ? String(v) : null;
}

export function extractBookingId(bookingResponse) {
    const v = deepFind(bookingResponse, 'booking_id');
    return v != null ? String(v) : null;
}

export const tourcmsClient = {
    listChannels: () => tourcmsRequest({ path: '/p/channels/list.xml' }),
    showChannel: ({ channelId }) =>
        tourcmsRequest({ path: '/c/channel/show.xml', channelId }),
    searchTours: ({ channelId, qs = '' }) =>
        tourcmsRequest({
            path: `/c/tours/search.xml${qs ? `?${qs}` : ''}`,
            channelId,
        }),
    showTour: ({ channelId, tourId }) =>
        tourcmsRequest({
            path: `/c/tour/show.xml?id=${encodeURIComponent(tourId)}`,
            channelId,
        }),
    // Live availability for a date → yields the bookable `component_key`
    // (valid ~1h) that Start New Booking requires. `rateQs` carries the per-rate
    // quantities, e.g. "r1=2" (rate 1 = adult by convention).
    checkAvailability: ({ channelId, tourId, date, rateQs = 'r1=1' }) =>
        tourcmsRequest({
            verb: 'GET',
            path: `/c/tour/datesprices/checkavail.xml?id=${encodeURIComponent(tourId)}&${rateQs}${date ? `&date=${encodeURIComponent(date)}` : ''}`,
            channelId,
        }),
    // Start New Booking — POST /c/booking/new/start.xml with the component_key
    // from checkAvailability. Standard POST signing (the old GET hack + wrong
    // path /c/booking/new.xml were the cause of the FAIL_SIG / login-page wall).
    startNewBooking: ({ channelId, payload }) =>
        tourcmsRequest({
            verb: 'POST',
            path: '/c/booking/new/start.xml',
            channelId,
            body: buildBookingXml(payload),
        }),
    // Commit New Booking — POST /c/booking/new/commit.xml with the temp booking_id.
    commitNewBooking: ({ channelId, bookingId }) =>
        tourcmsRequest({
            verb: 'POST',
            path: '/c/booking/new/commit.xml',
            channelId,
            body: `<?xml version="1.0"?><booking><booking_id>${String(bookingId).replace(/[^0-9]/g, '')}</booking_id></booking>`,
        }),
    cancelBooking: ({ channelId, bookingId }) =>
        tourcmsRequest({
            verb: 'POST',
            path: '/c/booking/cancel.xml',
            channelId,
            body: `<?xml version="1.0"?><booking><booking_id>${String(bookingId).replace(/[^0-9]/g, '')}</booking_id></booking>`,
        }),
};
