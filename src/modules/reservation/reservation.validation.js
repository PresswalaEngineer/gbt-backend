import { z } from 'zod';

const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'travelDate must be YYYY-MM-DD');

const paxBreakdown = z.record(z.string(), z.coerce.number().int().nonnegative());

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() }).strict();

export const addItemSchema = z
    .object({
        tourId: z.coerce.number().int().positive(),
        tourOptionId: z.coerce.number().int().positive().optional(),
        travelDate: dateString,
        startTime: z.string().trim().max(20).optional(),
        paxBreakdown,
        unitLabel: z.string().trim().max(120).optional(),
    })
    .strict();

export const updateItemSchema = z
    .object({
        paxBreakdown,
    })
    .strict();

export const migrateSchema = z
    .object({
        guestId: z.string().trim().min(1).max(120),
    })
    .strict();

export const checkoutSchema = z
    .object({
        leadGuestName: z.string().trim().min(2).max(200),
        leadGuestEmail: z.string().trim().email('Invalid email').max(200),
        leadGuestPhone: z.string().trim().max(40).optional(),
        couponCode: z.string().trim().max(60).optional(),
    })
    .strict();
