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

const baseFields = {
    name: z.string().trim().min(2, 'Customer name is required').max(200),
    email: z.string().trim().email('Invalid email').max(200),
    phone: optionalString,
    countryId: optionalInt,
    notes: optionalString,
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
};

export const createCustomerSchema = z.object(baseFields).strict();

export const updateCustomerSchema = z
    .object(
        Object.fromEntries(Object.entries(baseFields).map(([key, schema]) => [key, schema.optional()]))
    )
    .strict();

export const listCustomerSchema = z.object({
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    countryId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
