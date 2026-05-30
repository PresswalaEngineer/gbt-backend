import { z } from 'zod';

const nameSchema = z.string().trim().min(1, 'Name is required').max(160);
const typeSchema = z.enum(['Destination', 'Category'], {
    errorMap: () => ({ message: "Type must be 'Destination' or 'Category'" }),
});

export const createDestCatSchema = z
    .object({
        name: nameSchema,
        type: typeSchema,
        orderIndex: z.coerce.number().int().nonnegative().optional(),
        isActive: z.boolean().optional(),
    })
    .strict();

export const updateDestCatSchema = z
    .object({
        name: nameSchema.optional(),
        type: typeSchema.optional(),
        orderIndex: z.coerce.number().int().nonnegative().optional(),
        isActive: z.boolean().optional(),
    })
    .strict();

export const listDestCatSchema = z.object({
    search: z.string().trim().optional(),
    type: typeSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(200),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
