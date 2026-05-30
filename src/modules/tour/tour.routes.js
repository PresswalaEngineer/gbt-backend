import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    availabilityQuerySchema,
    createTourSchema,
    idParamSchema,
    listTourSchema,
    monthAvailabilityQuerySchema,
    slugParamSchema,
    updateTourSchema,
} from './tour.validation.js';
import * as tourController from './tour.controller.js';

const router = Router();

router.get('/', optionalAuth, validate({ query: listTourSchema }), asyncHandler(tourController.list));
router.get(
    '/slug/:slug',
    optionalAuth,
    validate({ params: slugParamSchema }),
    asyncHandler(tourController.getBySlug)
);
router.get(
    '/:id/availability/month',
    optionalAuth,
    validate({ params: idParamSchema, query: monthAvailabilityQuerySchema }),
    asyncHandler(tourController.monthAvailability)
);
router.get(
    '/:id/availability',
    optionalAuth,
    validate({ params: idParamSchema, query: availabilityQuerySchema }),
    asyncHandler(tourController.availability)
);
router.get(
    '/:id',
    optionalAuth,
    validate({ params: idParamSchema }),
    asyncHandler(tourController.getById)
);

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createTourSchema }),
    asyncHandler(tourController.create)
);

router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateTourSchema }),
    asyncHandler(tourController.update)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(tourController.remove)
);

export default router;
