import { z } from 'zod';

export const searchProductsQuerySchema = z.object({
    q: z.string().trim().min(1).max(200).optional(),
    perPage: z.coerce.number().int().min(1).max(50).default(20),
    supplierId: z.coerce.number().int().positive().optional(),
});

export const supplierQuerySchema = z.object({
    supplierId: z.coerce.number().int().positive().optional(),
});

export const productParamsSchema = z.object({
    productId: z.string().trim().min(1).max(200),
});
