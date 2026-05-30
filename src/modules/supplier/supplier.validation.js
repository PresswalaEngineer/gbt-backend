import { z } from 'zod';

const optionalString = z
    .string()
    .trim()
    .max(2_000)
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null));

const optionalEmail = z
    .union([z.string().trim().email('Invalid email').max(200), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' || value === null || value === undefined ? null : value));

const optionalDate = z
    .union([z.string().trim().min(1), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' || value === null || value === undefined ? null : value));

const requiredCurrency = z
    .string()
    .trim()
    .length(3, 'Use a 3-letter ISO currency code')
    .toUpperCase();

const cityIdsSchema = z
    .array(z.coerce.number().int().positive())
    .max(200)
    .default([]);

const baseFields = {
    name: z.string().trim().min(2, 'Supplier name is required').max(200),
    countryId: z.coerce.number().int().positive(),
    cityIds: cityIdsSchema,

    address: optionalString,
    phone: optionalString,
    bookingEmail: z.string().trim().email('Invalid booking email').max(200),

    bankAccountHolder: optionalString,
    bankAccountNumber: optionalString,
    bankIfsc: optionalString,
    bankSwift: optionalString,
    bankName: optionalString,
    bankAddress: optionalString,

    financeContactName: optionalString,
    financeContactEmail: optionalEmail,
    financeContactPhone: optionalString,

    contractContactName: optionalString,
    contractContactEmail: optionalEmail,
    contractContactPhone: optionalString,

    paymentMode: z.enum(['PREPAID', 'POSTPAID']).default('POSTPAID'),
    currency: requiredCurrency,

    hasApi: z.coerce.boolean().default(false),
    apiType: z.enum(['NONE', 'TOURCMS', 'VENTRATA']).default('NONE'),
    apiKey: optionalString,
    apiChannelId: optionalString,

    notes: optionalString,
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
};

const refineApiFields = (schema) =>
    schema
        .refine(
            (value) => !value.hasApi || (value.apiType && value.apiType !== 'NONE'),
            { message: 'API type is required when supplier has an API', path: ['apiType'] }
        )
        .refine(
            (value) =>
                !value.hasApi ||
                value.apiType !== 'TOURCMS' ||
                (value.apiChannelId && value.apiChannelId.length > 0),
            { message: 'TourCMS channel ID is required', path: ['apiChannelId'] }
        )
        .refine(
            (value) =>
                !value.hasApi ||
                value.apiType !== 'VENTRATA' ||
                (value.apiKey && value.apiKey.length > 0),
            { message: 'API key is required for Ventrata suppliers', path: ['apiKey'] }
        );

export const createSupplierSchema = refineApiFields(z.object(baseFields).strict());

export const updateSupplierSchema = refineApiFields(
    z
        .object(
            Object.fromEntries(
                Object.entries(baseFields).map(([key, schema]) => [key, schema.optional()])
            )
        )
        .strict()
);

export const listSupplierSchema = z.object({
    search: z.string().trim().optional(),
    countryId: z.coerce.number().int().positive().optional(),
    cityId: z.coerce.number().int().positive().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    hasApi: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === true || value === 'true')),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const contractIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
    contractId: z.coerce.number().int().positive(),
});

export const createContractSchema = z
    .object({
        type: z.enum(['CONTRACT', 'RATE_SHEET']).default('RATE_SHEET'),
        label: z.string().trim().min(1, 'Label is required').max(200),
        fileUrl: z.string().trim().url('File URL must be a valid URL').max(2048),
        validFrom: optionalDate,
        validTo: optionalDate,
        notes: optionalString,
    })
    .strict()
    .refine(
        (value) =>
            !value.validFrom ||
            !value.validTo ||
            new Date(value.validTo).getTime() >= new Date(value.validFrom).getTime(),
        { message: 'validTo must be on or after validFrom', path: ['validTo'] }
    );
