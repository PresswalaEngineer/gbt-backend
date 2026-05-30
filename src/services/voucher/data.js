import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';

// Rich include for the voucher — pulls the tour content + supplier that the
// e-ticket renders (meeting point, inclusions, policy, etc.).
const VOUCHER_INCLUDE = {
    tour: {
        select: {
            id: true,
            name: true,
            description: true,
            duration: true,
            meetingPoint: true,
            meetingPoints: true,
            meetingPointType: true,
            endingPoint: true,
            startTime: true,
            startTimes: true,
            inclusions: true,
            exclusions: true,
            importantNotes: true,
            cancellationPolicy: true,
            voucherType: true,
            images: true,
            thumbnail: true,
            city: { select: { name: true } },
            country: { select: { name: true } },
        },
    },
    supplier: {
        select: {
            name: true,
            bookingEmail: true,
            contractContactEmail: true,
            contractContactPhone: true,
            financeContactPhone: true,
        },
    },
    payments: {
        where: { isRefund: false },
        orderBy: { createdAt: 'desc' },
        select: { provider: true, status: true, amount: true, currency: true, createdAt: true },
    },
};

export async function loadVoucherByToken(token) {
    const booking = await prisma.booking.findUnique({ where: { voucherToken: token }, include: VOUCHER_INCLUDE });
    if (!booking) throw ApiError.notFound('Voucher not found');
    return booking;
}

export async function loadVoucherById(id, customerId) {
    const booking = await prisma.booking.findUnique({ where: { id }, include: VOUCHER_INCLUDE });
    if (!booking || (customerId != null && booking.customerId !== customerId)) {
        throw ApiError.notFound('Booking not found');
    }
    return booking;
}
