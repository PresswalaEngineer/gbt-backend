import { z } from 'zod';

const heroPointsSchema = z
    .array(z.string().trim().min(1, 'Point cannot be empty').max(240, 'Point too long'))
    .max(20, 'Too many points')
    .default([]);

const heroImagesSchema = z
    .array(z.string().trim().url('Each image must be a URL').max(2048))
    .max(20, 'Too many images')
    .default([]);

export const createCitySchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        countryId: z.coerce.number().int().positive(),
        population: z.string().trim().max(40).nullable().optional().or(z.literal('')),
        status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
        subtitle: z.string().trim().max(160).nullable().optional(),
        description: z.string().trim().max(4000).nullable().optional(),
        points: heroPointsSchema.optional(),
        images: heroImagesSchema.optional(),
    })
    .strict()
    .transform((value) => ({
        ...value,
        population: value.population ? value.population : null,
    }));

export const updateCitySchema = z
    .object({
        name: z.string().trim().min(2).max(120).optional(),
        countryId: z.coerce.number().int().positive().optional(),
        population: z.string().trim().max(40).nullable().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        subtitle: z.string().trim().max(160).nullable().optional(),
        description: z.string().trim().max(4000).nullable().optional(),
        points: heroPointsSchema.optional(),
        images: heroImagesSchema.optional(),
    })
    .strict();

export const listCitySchema = z.object({
    search: z.string().trim().optional(),
    countryId: z.coerce.number().int().positive().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
