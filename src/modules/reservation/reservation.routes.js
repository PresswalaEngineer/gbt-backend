import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireCustomer } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { resolveOwner } from './reservation.owner.js';
import * as reservationController from './reservation.controller.js';
import {
    addItemSchema,
    updateItemSchema,
    migrateSchema,
    checkoutSchema,
    idParamSchema,
} from './reservation.validation.js';

const router = Router();

// Customer-only operations (migration + checkout) — must precede the generic
// owner-resolved routes so requireCustomer applies.
router.post('/migrate', requireCustomer, validate({ body: migrateSchema }), asyncHandler(reservationController.migrate));
router.post('/checkout', requireCustomer, validate({ body: checkoutSchema }), asyncHandler(reservationController.checkout));

// Guest-or-customer cart operations.
router.get('/', optionalAuth, resolveOwner, asyncHandler(reservationController.getCart));
router.post('/items', optionalAuth, resolveOwner, validate({ body: addItemSchema }), asyncHandler(reservationController.addItem));
router.patch(
    '/items/:id',
    optionalAuth,
    resolveOwner,
    validate({ params: idParamSchema, body: updateItemSchema }),
    asyncHandler(reservationController.updateItem)
);
router.delete(
    '/items/:id',
    optionalAuth,
    resolveOwner,
    validate({ params: idParamSchema }),
    asyncHandler(reservationController.removeItem)
);
router.delete('/', optionalAuth, resolveOwner, asyncHandler(reservationController.clearCart));

export default router;
