import { z } from 'zod';

const optionalString = z
    .string()
    .trim()
    .max(20_000)
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null));

const baseFields = {
    name: z.string().trim().min(2).max(200),
    slug: z.string().trim().max(80).optional(),
    cityId: z.coerce.number().int().positive(),
    categoryId: z.coerce.number().int().positive().nullable().optional(),
    thumbnail: optionalString,
    canonicalTag: optionalString,
    firstOfferImage: optionalString,
    secondOfferImage: optionalString,
    seoTitle: optionalString,
    seoDescription: optionalString,
    seoKeywords: optionalString,
    footerHeading: optionalString,
    footerContent: optionalString,
    schema: optionalString,
    bannerImage: optionalString,
    bannerHeading: z.string().trim().min(2).max(200),
    bannerContent: optionalString,
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
};

export const createAttractionSchema = z.object(baseFields).strict();

export const updateAttractionSchema = z
    .object(
        Object.fromEntries(
            Object.entries(baseFields).map(([key, schema]) => [
                key,
                schema instanceof z.ZodOptional ? schema : schema.optional(),
            ])
        )
    )
    .strict();

export const listAttractionSchema = z.object({
    search: z.string().trim().optional(),
    cityId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).default(50),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const slugParamSchema = z.object({
    slug: z.string().trim().min(1).max(120),
});
