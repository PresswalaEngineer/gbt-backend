import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as exchangeRateController from './exchange-rate.controller.js';
import {
    createExchangeRateSchema,
    updateExchangeRateSchema,
    listExchangeRateSchema,
    convertQuerySchema,
    idParamSchema,
} from './exchange-rate.validation.js';

const router = Router();

router.get(
    '/',
    optionalAuth,
    validate({ query: listExchangeRateSchema }),
    asyncHandler(exchangeRateController.list)
);
router.get('/sync/status', optionalAuth, asyncHandler(exchangeRateController.syncStatus));
router.post('/sync', requireAuth, requireRole('ADMIN'), asyncHandler(exchangeRateController.sync));
router.get(
    '/convert',
    optionalAuth,
    validate({ query: convertQuerySchema }),
    asyncHandler(exchangeRateController.convert)
);
router.get(
    '/:id',
    optionalAuth,
    validate({ params: idParamSchema }),
    asyncHandler(exchangeRateController.getById)
);
router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createExchangeRateSchema }),
    asyncHandler(exchangeRateController.create)
);
router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateExchangeRateSchema }),
    asyncHandler(exchangeRateController.update)
);
router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(exchangeRateController.remove)
);

export default router;
