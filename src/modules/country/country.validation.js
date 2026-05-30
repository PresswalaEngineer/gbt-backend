import { z } from 'zod';

const codeSchema = z
    .string()
    .trim()
    .min(2, 'ISO code must be 2-3 characters')
    .max(3, 'ISO code must be 2-3 characters')
    .toUpperCase();

const currencySchema = z.string().trim().length(3, 'Currency must be 3 characters').toUpperCase();

const heroPointsSchema = z
    .array(z.string().trim().min(1, 'Point cannot be empty').max(240, 'Point too long'))
    .max(20, 'Too many points')
    .default([]);

const heroImagesSchema = z
    .array(z.string().trim().url('Each image must be a URL').max(2048))
    .max(20, 'Too many images')
    .default([]);

export const createCountrySchema = z
    .object({
        code: codeSchema,
        name: z.string().trim().min(2).max(120),
        currency: currencySchema,
        status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
        subtitle: z.string().trim().max(160).nullable().optional(),
        description: z.string().trim().max(4000).nullable().optional(),
        points: heroPointsSchema.optional(),
        images: heroImagesSchema.optional(),
    })
    .strict();

export const updateCountrySchema = z
    .object({
        code: codeSchema.optional(),
        name: z.string().trim().min(2).max(120).optional(),
        currency: currencySchema.optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        subtitle: z.string().trim().max(160).nullable().optional(),
        description: z.string().trim().max(4000).nullable().optional(),
        points: heroPointsSchema.optional(),
        images: heroImagesSchema.optional(),
    })
    .strict();

export const listCountrySchema = z.object({
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
