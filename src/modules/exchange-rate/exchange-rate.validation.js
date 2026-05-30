import { z } from 'zod';

const currency = z
    .string()
    .trim()
    .length(3, 'Use a 3-letter ISO currency code')
    .toUpperCase();

const baseFields = {
    fromCurrency: currency,
    toCurrency: currency,
    rate: z.coerce.number().positive('Rate must be positive'),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
};

const refineDifferent = (schema) =>
    schema.refine(
        (value) => !value.fromCurrency || !value.toCurrency || value.fromCurrency !== value.toCurrency,
        { message: 'From and To currency must differ', path: ['toCurrency'] }
    );

export const createExchangeRateSchema = refineDifferent(z.object(baseFields).strict());

export const updateExchangeRateSchema = refineDifferent(
    z
        .object(
            Object.fromEntries(Object.entries(baseFields).map(([key, schema]) => [key, schema.optional()]))
        )
        .strict()
);

export const listExchangeRateSchema = z.object({
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(100),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const convertQuerySchema = z
    .object({
        amount: z.coerce.number().positive('Amount must be positive'),
        from: currency,
        to: currency,
    })
    .strict();
