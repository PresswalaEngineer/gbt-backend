import { z } from 'zod';
import { ALERT_TYPES } from './alert.defaults.js';

export const alertTypeSchema = z.object({
    alertType: z.enum(ALERT_TYPES),
});

export const updateSettingSchema = z
    .object({
        enabled: z.coerce.boolean().optional(),
        recipients: z.array(z.string().trim().email().max(200)).max(50).optional(),
    })
    .strict();

export const sendTestSchema = z
    .object({
        alertType: z.enum(ALERT_TYPES),
        toEmail: z.string().trim().email().max(200),
    })
    .strict();

export const listLogSchema = z.object({
    alertType: z.enum(ALERT_TYPES).optional(),
    status: z.enum(['QUEUED', 'SENT', 'FAILED', 'SKIPPED']).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(50),
});
