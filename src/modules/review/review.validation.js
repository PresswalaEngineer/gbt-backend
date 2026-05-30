import { z } from 'zod';

export const tourIdParamSchema = z.object({
    tourId: z.coerce.number().int().positive(),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const createReviewSchema = z
    .object({
        rating: z.coerce.number().int().min(1).max(5),
        title: z.string().trim().max(160).optional(),
        body: z.string().trim().max(2000).optional(),
    })
    .strict();

export const listReviewSchema = z.object({
    search: z.string().trim().optional(),
    tourId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const createAdminReviewSchema = z
    .object({
        tourId: z.coerce.number().int().positive(),
        author: z.string().trim().min(1).max(120),
        rating: z.coerce.number().int().min(1).max(5),
        title: z.string().trim().max(160).optional(),
        body: z.string().trim().max(2000).optional(),
        createdAt: z.coerce.date().optional(),
    })
    .strict();
