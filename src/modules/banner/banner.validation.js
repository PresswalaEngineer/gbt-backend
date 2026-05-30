import { z } from 'zod';

export const MAX_BANNERS = 7;

const imageUrlSchema = z
    .string()
    .trim()
    .max(2048)
    .refine(
        (v) => v.startsWith('/') || (() => { try { new URL(v); return true; } catch { return false; } })(),
        'Must be a valid image URL or path'
    );
const contentSchema = z.string().trim().min(1, 'Content is required').max(100, 'Content cannot exceed 100 characters');

export const createBannerSchema = z
    .object({
        imageUrl: imageUrlSchema,
        content: contentSchema,
        isActive: z.boolean().optional(),
    })
    .strict();

export const updateBannerSchema = z
    .object({
        imageUrl: imageUrlSchema.optional(),
        content: contentSchema.optional(),
    })
    .strict();

export const listBannerSchema = z.object({
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
