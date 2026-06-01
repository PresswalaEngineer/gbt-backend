import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireCustomer } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../booking/booking.validation.js';
import * as paymentController from './payment.controller.js';

const router = Router();

const cartCheckoutSchema = z
    .object({
        bookingIds: z.array(z.coerce.number().int().positive()).min(1).max(20),
        currency: z.string().trim().length(3),
    })
    .strict();

// Combined payment for the whole cart (one PaymentIntent, display currency).
router.post(
    '/checkout',
    requireCustomer,
    validate({ body: cartCheckoutSchema }),
    asyncHandler(paymentController.checkoutCart)
);

// Confirm-on-return fallback (settles immediately without a webhook).
router.post(
    '/confirm',
    requireCustomer,
    validate({
        body: z
            .object({ sessionId: z.string().min(1).optional(), paymentIntentId: z.string().min(1).optional() })
            .strict()
            .refine((b) => b.sessionId || b.paymentIntentId, 'sessionId or paymentIntentId required'),
    }),
    asyncHandler(paymentController.confirm)
);

router.post(
    '/bookings/:id/checkout',
    requireCustomer,
    validate({ params: idParamSchema }),
    asyncHandler(paymentController.checkout)
);

export default router;
