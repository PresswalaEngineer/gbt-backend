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

const optionalPercent = z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : value),
    z.coerce.number().min(-100).max(100).nullable()
);

const baseFields = {
    name: z.string().trim().min(2, 'Agent name is required').max(200),
    email: z.string().trim().email('Invalid email').max(200),
    phone: optionalString,
    companyName: optionalString,
    countryId: optionalInt,
    commissionPercent: optionalPercent,
    agentStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).default('PENDING'),
    notes: optionalString,
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
};

export const createAgentSchema = z.object(baseFields).strict();

export const updateAgentSchema = z
    .object(
        Object.fromEntries(Object.entries(baseFields).map(([key, schema]) => [key, schema.optional()]))
    )
    .strict();

export const listAgentSchema = z.object({
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    agentStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
    countryId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
