import { z } from 'zod';

const optionalString = z
    .string()
    .trim()
    .max(20_000)
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null));

const optionalInt = z
    .union([z.null(), z.literal(''), z.coerce.number().int()])
    .optional()
    .transform((value) => (value === '' || value === null || value === undefined ? null : Number(value)));

const tourOptionSchema = z
    .object({
        name: z.string().trim().min(1, 'Option name is required').max(200),
        code: optionalString,
        externalId: z.string().trim().min(1, 'Option ID is required').max(120),
    })
    .strict();

const PRICE_TIER_VALUES = [
    'ADULT',
    'CHILD',
    'INFANT',
    'SENIOR',
    'FAMILY',
    'PAX_1',
    'PAX_2',
    'PAX_3',
    'CHILD_WITH_BED',
    'CHILD_WITHOUT_BED',
];

const PRODUCT_TAG_VALUES = [
    'MOBILE_VOUCHER',
    'PRINTED_VOUCHER',
    'WHEELCHAIR',
    'AUDIO_GUIDE',
    'LIVE_GUIDE',
    'MULTI_LANGUAGE',
];

const optionalDecimal = z.preprocess(
    (value) =>
        value === '' || value === null || value === undefined ? null : value,
    z.coerce.number().nonnegative().max(9_999_999.99).nullable()
);

const requiredDecimal = z.coerce
    .number()
    .nonnegative('Price cannot be negative')
    .max(9_999_999.99);

const priceTierSchema = z
    .object({
        tier: z.enum(PRICE_TIER_VALUES),
        nettPrice: optionalDecimal,
        grossPrice: requiredDecimal,
        originalPrice: optionalDecimal,
        notes: optionalString,
    })
    .strict()
    .refine(
        (value) =>
            value.originalPrice === null ||
            value.grossPrice === null ||
            value.grossPrice === undefined ||
            value.originalPrice >= value.grossPrice,
        {
            message: 'Original price (slashed) must be ≥ gross price',
            path: ['originalPrice'],
        }
    );

const optionalPercent = z.preprocess(
    (value) =>
        value === '' || value === null || value === undefined ? null : value,
    z.coerce.number().min(-100).max(100).nullable()
);

const trimmedStringArray = (max) =>
    z
        .array(z.string().trim().min(1).max(500))
        .max(max)
        .default([]);

const baseFields = {
    name: z.string().trim().min(2).max(200),
    productId: z.string().trim().min(1).max(120),
    productCode: optionalString,
    productSlug: z
        .union([
            z
                .string()
                .trim()
                .min(2)
                .max(160)
                .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and dashes'),
            z.literal(''),
            z.null(),
        ])
        .optional()
        .transform((value) => (value === '' || value === null || value === undefined ? null : value)),

    apiType: z.enum(['NONE', 'TOURCMS', 'VENTRATA']).default('NONE'),
    apiId: optionalString,

    countryId: z.coerce.number().int().positive(),
    cityId: z.coerce.number().int().positive(),
    categoryId: optionalInt,
    attractionId: optionalInt,
    supplierId: optionalInt,
    supplierName: optionalString,

    description: optionalString,
    highlights: optionalString,
    itinerary: optionalString,
    inclusions: optionalString,
    exclusions: optionalString,
    cancellationPolicy: optionalString,
    importantNotes: optionalString,
    voucherUsage: optionalString,

    meetingPoint: z.string().trim().min(2).max(500),
    endingPoint: z.string().trim().min(2).max(500),
    duration: optionalString,
    startTime: z.string().trim().min(1).max(20),
    startTimes: trimmedStringArray(20),
    meetingPointType: z.enum(['FIXED', 'MULTIPLE', 'CUSTOMISED']).default('FIXED'),
    meetingPoints: trimmedStringArray(20),
    bookingWindow: z.string().trim().min(1).max(60),
    bookingCutoffHours: z
        .union([z.coerce.number().int().min(0).max(8760), z.literal(''), z.null()])
        .optional()
        .transform((value) =>
            value === '' || value === null || value === undefined ? null : Number(value)
        ),
    maxBookingDays: z
        .union([z.coerce.number().int().min(1).max(3650), z.literal(''), z.null()])
        .optional()
        .transform((value) =>
            value === '' || value === null || value === undefined ? null : Number(value)
        ),
    unavailableDates: z
        .array(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD'))
        .max(366, 'Too many blackout dates')
        .optional()
        .default([]),
    freeCancellationHours: z
        .union([z.coerce.number().int().min(0).max(8760), z.literal(''), z.null()])
        .optional()
        .transform((value) =>
            value === '' || value === null || value === undefined ? null : Number(value)
        ),

    routeMapUrl: optionalString,
    mapUrl: z
        .union([z.string().trim().url(), z.literal(''), z.null()])
        .optional()
        .transform((value) => (value === '' || value === null || value === undefined ? null : value)),
    voucherType: z.enum(['PRINTED', 'MOBILE']).default('MOBILE'),
    productTags: z.array(z.enum(PRODUCT_TAG_VALUES)).max(20).default([]),
    requireAllPaxDetails: z.coerce.boolean().default(false),

    minPax: z.coerce.number().int().min(1).default(1),
    maxPax: z.coerce.number().int().min(1).default(99),

    // Per-day seat capacity for internal tours (blank/null = unlimited). Undefined
    // is left untouched on update; only an explicit '' / null clears it.
    dailyCapacity: z
        .union([z.coerce.number().int().min(0), z.literal(''), z.null()])
        .optional()
        .transform((value) => (value === '' || value === null ? null : value)),

    infantAllowed: z.coerce.boolean().default(true),
    infantAgeFrom: z.coerce.number().int().min(0).max(99).default(0),
    infantAgeTo: z.coerce.number().int().min(0).max(99).default(2),
    childAllowed: z.coerce.boolean().default(true),
    childAgeFrom: z.coerce.number().int().min(0).max(99).default(3),
    childAgeTo: z.coerce.number().int().min(0).max(99).default(12),

    instantConfirmation: z.coerce.boolean().default(true),
    guestNameRequired: z.coerce.boolean().default(false),

    tourType: z.enum(['SINGLE_DAY', 'MULTI_DAY']).default('SINGLE_DAY'),
    durationDays: z
        .union([z.coerce.number().int().min(1).max(365), z.literal(''), z.null()])
        .optional()
        .transform((value) =>
            value === '' || value === null || value === undefined ? null : Number(value)
        ),
    pricingMode: z.enum(['NETT', 'COMMISSIONABLE']).default('NETT'),
    marginPercent: optionalPercent,
    commissionPercent: optionalPercent,
    currency: z
        .union([
            z.string().trim().length(3, 'Use a 3-letter ISO currency code').toUpperCase(),
            z.literal(''),
            z.null(),
        ])
        .optional()
        .transform((value) =>
            value === '' || value === null || value === undefined ? null : value
        ),

    priceTiers: z.array(priceTierSchema).default([]),

    thumbnail: optionalString,
    images: z.array(z.string()).max(20).default([]),

    seoTitle: optionalString,
    seoDescription: optionalString,
    seoKeywords: optionalString,
    canonicalUrl: optionalString,

    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),

    options: z.array(tourOptionSchema).default([]),
};

const refineAgeAndPax = (schema) =>
    schema
        .refine(
            (value) => {
                if (!Array.isArray(value.priceTiers) || !value.priceTiers.length) return true;
                const seen = new Set();
                for (const row of value.priceTiers) {
                    if (seen.has(row.tier)) return false;
                    seen.add(row.tier);
                }
                return true;
            },
            { message: 'Each price tier may only appear once', path: ['priceTiers'] }
        )
        .refine((value) => value.maxPax === undefined || value.minPax === undefined || value.maxPax >= value.minPax, {
            message: 'maxPax must be ≥ minPax',
            path: ['maxPax'],
        })
        .refine(
            (value) =>
                value.infantAgeFrom === undefined ||
                value.infantAgeTo === undefined ||
                value.infantAgeTo >= value.infantAgeFrom,
            { message: 'Infant age range is invalid', path: ['infantAgeTo'] }
        )
        .refine(
            (value) =>
                value.childAgeFrom === undefined ||
                value.childAgeTo === undefined ||
                value.childAgeTo >= value.childAgeFrom,
            { message: 'Child age range is invalid', path: ['childAgeTo'] }
        )
        .refine(
            (value) =>
                value.apiType === undefined ||
                value.apiType === 'NONE' ||
                (value.apiId && value.apiId.length > 0),
            { message: 'API ID is required when an API source is selected', path: ['apiId'] }
        )
        .refine(
            (value) =>
                value.meetingPointType !== 'MULTIPLE' ||
                (Array.isArray(value.meetingPoints) && value.meetingPoints.length > 0),
            { message: 'Add at least one meeting point when type is MULTIPLE', path: ['meetingPoints'] }
        );

export const createTourSchema = refineAgeAndPax(z.object(baseFields).strict());

export const updateTourSchema = refineAgeAndPax(
    z
        .object(
            Object.fromEntries(
                Object.entries(baseFields).map(([key, schema]) => [
                    key,
                    schema instanceof z.ZodOptional || schema instanceof z.ZodDefault
                        ? schema.optional()
                        : schema.optional(),
                ])
            )
        )
        .strict()
);

export const listTourSchema = z.object({
    search: z.string().trim().optional(),
    cityId: z.coerce.number().int().positive().optional(),
    countryId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    attractionId: z.coerce.number().int().positive().optional(),
    tourType: z.enum(['SINGLE_DAY', 'MULTI_DAY']).optional(),
    apiType: z.enum(['NONE', 'TOURCMS', 'VENTRATA']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    sortBy: z.enum(['createdAt', 'bookingCount', 'name', 'price']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const slugParamSchema = z.object({
    slug: z.string().trim().min(1).max(200),
});

export const availabilityQuerySchema = z.object({
    date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
    pax: z.coerce.number().int().positive().max(99).optional(),
});

export const monthAvailabilityQuerySchema = z.object({
    month: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM'),
});
