import { z } from 'zod';
import { ALERT_TYPES } from '../alert/alert.defaults.js';

const optionalString = z
    .string()
    .trim()
    .max(50_000)
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null));

const baseFields = {
    alertType: z.enum(ALERT_TYPES),
    name: z.string().trim().min(2).max(200),
    subject: z.string().trim().min(2).max(500),
    bodyHtml: z.string().trim().min(2).max(50_000),
    bodyText: optionalString,
    fromName: optionalString,
    fromEmail: z
        .union([z.string().trim().email().max(200), z.literal(''), z.null()])
        .optional()
        .transform((value) => (value === '' || value === null || value === undefined ? null : value)),
    description: optionalString,
    isActive: z.coerce.boolean().default(true),
};

export const updateTemplateSchema = z
    .object(
        Object.fromEntries(
            Object.entries(baseFields).map(([key, schema]) => [
                key === 'alertType' ? key : key,
                schema.optional(),
            ])
        )
    )
    .strict();

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const listTemplateSchema = z.object({
    isActive: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === true || value === 'true')),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(50),
});
