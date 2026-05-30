import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireCustomer } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createReviewSchema, tourIdParamSchema } from './review.validation.js';
import * as reviewController from './review.controller.js';

const router = Router();

router.get(
    '/:tourId/reviews',
    optionalAuth,
    validate({ params: tourIdParamSchema }),
    asyncHandler(reviewController.listForTour)
);

router.post(
    '/:tourId/reviews',
    requireCustomer,
    validate({ params: tourIdParamSchema, body: createReviewSchema }),
    asyncHandler(reviewController.create)
);

export default router;
