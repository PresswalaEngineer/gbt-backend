import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z
    .object({
        email: z.string().trim().toLowerCase().email('Enter a valid email'),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .max(72, 'Password must be at most 72 characters'),
        name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
        role: z.enum(['ADMIN', 'STAFF']).default('STAFF'),
    })
    .strict();

export const refreshSchema = z.object({}).strict();
