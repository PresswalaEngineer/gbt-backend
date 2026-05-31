import { z } from 'zod';

export const presignSchema = z
    .object({
        filename: z.string().trim().min(1, 'Filename is required').max(200),
        contentType: z.string().trim().min(1, 'Content type is required').max(120),
        size: z.coerce.number().int().positive('File size must be positive'),
        folder: z
            .string()
            .trim()
            .max(60)
            .regex(/^[a-z0-9-]+$/i, 'Folder must be alphanumeric or hyphenated')
            .optional(),
    })
    .strict();

export const imageUploadQuerySchema = z
    .object({
        folder: z
            .string()
            .trim()
            .max(60)
            .regex(/^[a-z0-9-]+$/i, 'Folder must be alphanumeric or hyphenated')
            .optional(),
        preset: z.string().trim().max(40).optional(),
    })
    .strict();

export const cleanupSchema = z
    .object({
        urls: z
            .array(z.string().trim().url('Each entry must be a valid URL').max(2048))
            .max(50, 'Too many URLs in one request')
            .default([]),
    })
    .strict();
