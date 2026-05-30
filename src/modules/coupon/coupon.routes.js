import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as couponController from './coupon.controller.js';
import {
    createCouponSchema,
    updateCouponSchema,
    listCouponSchema,
    idParamSchema,
    applyCouponSchema,
} from './coupon.validation.js';

const router = Router();

// Cart needs to validate a code with or without a session (pre/post login).
router.post('/apply', optionalAuth, validate({ body: applyCouponSchema }), asyncHandler(couponController.apply));
// Public "available offers" for the checkout offers panel.
router.get('/offers', optionalAuth, asyncHandler(couponController.offers));

router.get('/', requireAuth, validate({ query: listCouponSchema }), asyncHandler(couponController.list));
router.get('/:id', requireAuth, validate({ params: idParamSchema }), asyncHandler(couponController.getById));
router.post('/', requireAuth, requireRole('ADMIN'), validate({ body: createCouponSchema }), asyncHandler(couponController.create));
router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateCouponSchema }),
    asyncHandler(couponController.update)
);
router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(couponController.remove)
);

export default router;
