import { z } from 'zod';

export const listQuerySchema = z.object({
    search: z.string().trim().optional(),
    role: z.enum(['ADMIN', 'STAFF']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const updateStaffSchema = z
    .object({
        name: z.string().trim().min(2).max(120).optional(),
        role: z.enum(['ADMIN', 'STAFF']).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        password: z.string().min(8).max(72).optional(),
    })
    .strict();
