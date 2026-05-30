import { z } from 'zod';

export const registerSchema = z
    .object({
        email: z.string().trim().toLowerCase().email('Enter a valid email'),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .max(72, 'Password must be at most 72 characters'),
        name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
        phone: z.string().trim().min(3).max(30).optional(),
    })
    .strict();

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z.string().min(1, 'Password is required'),
});

export const googleSchema = z
    .object({
        credential: z.string().min(1, 'Google credential is required'),
    })
    .strict();

export const updateProfileSchema = z
    .object({
        name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120).optional(),
        phone: z.string().trim().max(30).optional().or(z.literal('')),
        address: z.string().trim().max(300).optional().or(z.literal('')),
        countryId: z.coerce.number().int().positive().optional().nullable(),
    })
    .strict();
