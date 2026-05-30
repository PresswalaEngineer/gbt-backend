import { z } from 'zod';

const optionalString = z
    .string()
    .trim()
    .max(2_000)
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null));

const optionalInt = z
    .union([z.null(), z.literal(''), z.coerce.number().int()])
    .optional()
    .transform((value) => (value === '' || value === null || value === undefined ? null : Number(value)));

const dateString = z
    .string()
    .trim()
    .min(1)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Invalid date');

export const createBookingSchema = z
    .object({
        tourId: z.coerce.number().int().positive(),
        tourOptionId: optionalInt,
        customerId: optionalInt,
        agentId: optionalInt,
        leadGuestName: z.string().trim().min(2).max(200),
        leadGuestEmail: z.string().trim().email('Invalid email').max(200),
        leadGuestPhone: optionalString,
        paxBreakdown: z.record(z.string(), z.coerce.number().int().nonnegative()),
        travelDate: dateString,
        startTime: optionalString,
        couponCode: optionalString,
        notes: optionalString,
    })
    .strict();

export const customerBookingSchema = z
    .object({
        tourId: z.coerce.number().int().positive(),
        tourOptionId: optionalInt,
        leadGuestName: z.string().trim().min(2).max(200),
        leadGuestEmail: z.string().trim().email('Invalid email').max(200),
        leadGuestPhone: optionalString,
        paxBreakdown: z.record(z.string(), z.coerce.number().int().nonnegative()),
        travelDate: dateString,
        startTime: optionalString,
        couponCode: optionalString,
        notes: optionalString,
    })
    .strict();

export const updateBookingSchema = z
    .object({
        leadGuestName: z.string().trim().min(2).max(200).optional(),
        leadGuestEmail: z.string().trim().email().max(200).optional(),
        leadGuestPhone: optionalString.optional(),
        travelDate: dateString.optional(),
        startTime: optionalString.optional(),
        notes: optionalString.optional(),
    })
    .strict();

export const cancelBookingSchema = z
    .object({
        reason: z.string().trim().min(2).max(2000),
        refundAmount: z.coerce.number().nonnegative().optional(),
    })
    .strict();

// Customer-initiated cancel — reason optional.
export const customerCancelSchema = z
    .object({
        reason: z.string().trim().max(2000).optional(),
    })
    .strict();

export const refundBookingSchema = z
    .object({
        amount: z.coerce.number().nonnegative(),
        provider: z.string().trim().max(60).optional(),
        providerRef: z.string().trim().max(200).optional(),
        notes: optionalString,
    })
    .strict();

export const recordPaymentSchema = z
    .object({
        amount: z.coerce.number().nonnegative(),
        currency: z.string().trim().length(3).toUpperCase(),
        status: z.enum(['PENDING', 'PAID', 'FAILED']).default('PAID'),
        provider: z.string().trim().max(60).optional(),
        providerRef: z.string().trim().max(200).optional(),
        notes: optionalString,
    })
    .strict();

export const listBookingSchema = z.object({
    status: z
        .enum(['PENDING', 'CONFIRMED', 'CANCELLATION_REQUESTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED'])
        .optional(),
    paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND']).optional(),
    tourId: z.coerce.number().int().positive().optional(),
    customerId: z.coerce.number().int().positive().optional(),
    supplierId: z.coerce.number().int().positive().optional(),
    agentId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().optional(),
    fromDate: dateString.optional(),
    toDate: dateString.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(50),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
