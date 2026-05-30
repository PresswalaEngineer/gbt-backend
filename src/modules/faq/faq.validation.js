import { z } from 'zod';

const questionSchema = z.string().trim().min(3, 'Question is required').max(500);
const answerSchema = z.string().trim().min(1, 'Answer is required').max(4000);

export const createFaqSchema = z
    .object({
        question: questionSchema,
        answer: answerSchema,
        orderIndex: z.coerce.number().int().nonnegative().optional(),
        isActive: z.boolean().optional(),
    })
    .strict();

export const updateFaqSchema = z
    .object({
        question: questionSchema.optional(),
        answer: answerSchema.optional(),
        orderIndex: z.coerce.number().int().nonnegative().optional(),
        isActive: z.boolean().optional(),
    })
    .strict();

export const replaceFaqsSchema = z
    .object({
        faqs: z
            .array(
                z
                    .object({
                        question: questionSchema,
                        answer: answerSchema,
                    })
                    .strict()
            )
            .min(1, 'At least one FAQ is required')
            .max(100, 'Too many FAQs'),
    })
    .strict();

export const listFaqSchema = z.object({
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(200),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
