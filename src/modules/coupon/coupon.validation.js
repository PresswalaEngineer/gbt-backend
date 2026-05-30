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

const optionalDecimal = z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : value),
    z.coerce.number().nonnegative().nullable()
);

const requiredDecimal = z.coerce.number().nonnegative('Must be ≥ 0');

const dateString = z
    .string()
    .trim()
    .min(1, 'Date is required')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');

const baseFields = {
    name: z.string().trim().min(2, 'Coupon name is required').max(200),
    code: z.string().trim().min(2, 'Coupon code is required').max(60).toUpperCase(),
    description: optionalString,
    discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
    discountAmount: requiredDecimal,
    minOrderAmount: optionalDecimal,
    startDate: dateString,
    endDate: dateString,
    userLimit: optionalInt,
    eligibility: z.enum(['ALL', 'CITY', 'ATTRACTION', 'CATEGORY', 'TOUR']).default('ALL'),
    targetCityId: optionalInt,
    targetAttractionId: optionalInt,
    targetCategoryId: optionalInt,
    targetTourId: optionalInt,
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
};

const refineCoupon = (schema) =>
    schema
        .refine(
            (value) => {
                if (!value.startDate || !value.endDate) return true;
                return new Date(value.endDate).getTime() >= new Date(value.startDate).getTime();
            },
            { message: 'End date must be on/after start date', path: ['endDate'] }
        )
        .refine(
            (value) => {
                const tgt = value.eligibility;
                const map = {
                    CITY: value.targetCityId,
                    ATTRACTION: value.targetAttractionId,
                    CATEGORY: value.targetCategoryId,
                    TOUR: value.targetTourId,
                };
                if (!tgt || tgt === 'ALL') return true;
                return Boolean(map[tgt]);
            },
            { message: 'Pick a target for the chosen eligibility', path: ['eligibility'] }
        )
        .refine(
            (value) => value.discountType !== 'PERCENTAGE' || value.discountAmount === undefined || value.discountAmount <= 100,
            { message: 'Percentage discount must be ≤ 100', path: ['discountAmount'] }
        );

export const createCouponSchema = refineCoupon(z.object(baseFields).strict());

export const updateCouponSchema = refineCoupon(
    z
        .object(
            Object.fromEntries(Object.entries(baseFields).map(([key, schema]) => [key, schema.optional()]))
        )
        .strict()
);

export const listCouponSchema = z.object({
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    eligibility: z.enum(['ALL', 'CITY', 'ATTRACTION', 'CATEGORY', 'TOUR']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const applyCouponSchema = z
    .object({
        code: z.string().trim().min(1).max(60),
        tourId: z.coerce.number().int().positive(),
        amount: requiredDecimal,
    })
    .strict();
