import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const tagsSchema = z
    .array(z.string().trim().min(1).max(50))
    .max(30, 'Too many tags')
    .default([]);

const imagesArraySchema = z
    .array(z.string().trim().url('Each image must be a URL').max(2048))
    .max(200, 'Too many content images')
    .default([]);

const blogStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);

const blogCategorySchema = z.enum(['TRAVEL_GUIDE', 'NEWS', 'TIPS', 'DESTINATION', 'HOW_TO']);

const baseShape = {
    title: z.string().trim().min(3, 'Title is required').max(200, 'Title too long'),
    slug: z
        .string()
        .trim()
        .min(3, 'Slug is required')
        .max(180, 'Slug too long')
        .regex(slugRegex, 'Slug must be lowercase letters, numbers and hyphens only'),
    excerpt: z.string().trim().min(20, 'Excerpt should be at least 20 chars').max(500, 'Excerpt too long'),
    content: z.string().min(1, 'Content is required'),
    contentImages: imagesArraySchema.optional(),
    bannerImage: z.string().trim().url('Banner must be a URL').max(2048),
    thumbnailImage: z.string().trim().url('Thumbnail must be a URL').max(2048),
    ogImage: z.string().trim().url('OG image must be a URL').max(2048).nullable().optional(),
    author: z.string().trim().min(2, 'Author is required').max(120),
    category: blogCategorySchema,
    tags: tagsSchema.optional(),
    status: blogStatusSchema.default('DRAFT'),
    isFeatured: z.boolean().default(false),
    publishedAt: z.coerce.date().nullable().optional(),
    seoTitle: z.string().trim().max(120).nullable().optional(),
    seoDescription: z.string().trim().max(320).nullable().optional(),
    seoKeywords: z.string().trim().max(500).nullable().optional(),
    canonicalUrl: z.string().trim().url('Canonical must be a URL').max(2048).nullable().optional(),
    schema: z.string().max(20000).nullable().optional(),
};

export const createBlogSchema = z.object(baseShape).strict();

export const updateBlogSchema = z
    .object({
        title: baseShape.title.optional(),
        slug: baseShape.slug.optional(),
        excerpt: baseShape.excerpt.optional(),
        content: baseShape.content.optional(),
        contentImages: imagesArraySchema.optional(),
        bannerImage: baseShape.bannerImage.optional(),
        thumbnailImage: baseShape.thumbnailImage.optional(),
        ogImage: baseShape.ogImage,
        author: baseShape.author.optional(),
        category: blogCategorySchema.optional(),
        tags: tagsSchema.optional(),
        status: blogStatusSchema.optional(),
        isFeatured: z.boolean().optional(),
        publishedAt: z.coerce.date().nullable().optional(),
        seoTitle: baseShape.seoTitle,
        seoDescription: baseShape.seoDescription,
        seoKeywords: baseShape.seoKeywords,
        canonicalUrl: baseShape.canonicalUrl,
        schema: baseShape.schema,
    })
    .strict();

export const listBlogSchema = z.object({
    search: z.string().trim().optional(),
    status: blogStatusSchema.optional(),
    category: blogCategorySchema.optional(),
    isFeatured: z
        .union([z.boolean(), z.enum(['true', 'false'])])
        .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
        .optional(),
    tag: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const slugParamSchema = z.object({
    slug: z.string().trim().min(1).max(180),
});
