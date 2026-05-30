import { z } from 'zod';

export const addWishlistSchema = z
    .object({ tourId: z.coerce.number().int().positive() })
    .strict();

export const tourIdParamSchema = z.object({
    tourId: z.coerce.number().int().positive(),
});
