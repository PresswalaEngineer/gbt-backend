import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireCustomer, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as bookingController from './booking.controller.js';
import {
    createBookingSchema,
    customerBookingSchema,
    updateBookingSchema,
    listBookingSchema,
    cancelBookingSchema,
    customerCancelSchema,
    refundBookingSchema,
    recordPaymentSchema,
    idParamSchema,
} from './booking.validation.js';

const router = Router();

const quoteSchema = z
    .object({
        tourId: z.coerce.number().int().positive(),
        paxBreakdown: z.record(z.string(), z.coerce.number().int().nonnegative()),
        couponCode: z.string().trim().max(60).optional(),
    })
    .strict();

// Pricing only (no sensitive data) — usable by the admin booking screen and the
// storefront cart alike.
router.post('/quote', optionalAuth, validate({ body: quoteSchema }), asyncHandler(bookingController.quote));

// --- Public voucher + payment-receipt routes (token-based; precede everything) ---
router.get('/voucher/:token', asyncHandler(bookingController.voucherHtml));
router.get('/voucher/:token/pdf', asyncHandler(bookingController.voucherPdf));
router.get('/receipt/:token', asyncHandler(bookingController.receiptHtml));
router.get('/receipt/:token/pdf', asyncHandler(bookingController.receiptPdf));

// --- Customer (storefront) routes — must precede the staff `/:id` routes ---
router.post(
    '/customer',
    requireCustomer,
    validate({ body: customerBookingSchema }),
    asyncHandler(bookingController.createForCustomer)
);
router.get(
    '/customer/:id/voucher',
    requireCustomer,
    validate({ params: idParamSchema }),
    asyncHandler(bookingController.voucherData)
);
router.get('/customer', requireCustomer, asyncHandler(bookingController.listForCustomer));
router.get(
    '/customer/:id',
    requireCustomer,
    validate({ params: idParamSchema }),
    asyncHandler(bookingController.getForCustomer)
);
router.post(
    '/customer/:id/cancel',
    requireCustomer,
    validate({ params: idParamSchema, body: customerCancelSchema }),
    asyncHandler(bookingController.cancelForCustomer)
);

// --- Staff/admin routes ---
router.get(
    '/',
    requireAuth,
    validate({ query: listBookingSchema }),
    asyncHandler(bookingController.list)
);
router.get(
    '/:id',
    requireAuth,
    validate({ params: idParamSchema }),
    asyncHandler(bookingController.getById)
);
router.post(
    '/',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    validate({ body: createBookingSchema }),
    asyncHandler(bookingController.create)
);
router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateBookingSchema }),
    asyncHandler(bookingController.update)
);
router.post(
    '/:id/confirm',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    validate({ params: idParamSchema }),
    asyncHandler(bookingController.confirm)
);
router.post(
    '/:id/cancel',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: cancelBookingSchema }),
    asyncHandler(bookingController.cancel)
);
router.post(
    '/:id/payments',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: recordPaymentSchema }),
    asyncHandler(bookingController.recordPayment)
);
router.post(
    '/:id/refund',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: refundBookingSchema }),
    asyncHandler(bookingController.refund)
);
router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(bookingController.remove)
);

export default router;
