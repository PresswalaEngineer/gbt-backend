import { z } from 'zod';

export const suggestQuerySchema = z.object({
    q: z.string().trim().min(1).max(100),
    limit: z.coerce.number().int().positive().max(20).optional(),
});
