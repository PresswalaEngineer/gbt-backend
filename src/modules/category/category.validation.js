import { z } from 'zod';

export const createCategorySchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    })
    .strict();

export const updateCategorySchema = z
    .object({
        name: z.string().trim().min(2).max(120).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    })
    .strict();

export const listCategorySchema = z.object({
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
