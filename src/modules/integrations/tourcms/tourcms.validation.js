import { z } from 'zod';

const channelIdQuery = z.coerce.number().int().positive().optional();

export const searchToursQuerySchema = z.object({
    channelId: channelIdQuery,
    q: z.string().trim().min(1).max(200).optional(),
    perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export const tourQuerySchema = z.object({
    channelId: channelIdQuery,
});

export const tourParamsSchema = z.object({
    tourId: z.coerce.number().int().positive(),
});
