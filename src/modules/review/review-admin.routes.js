import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    createAdminReviewSchema,
    idParamSchema,
    listReviewSchema,
} from './review.validation.js';
import * as reviewController from './review.controller.js';

const router = Router();

router.get(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ query: listReviewSchema }),
    asyncHandler(reviewController.list)
);

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createAdminReviewSchema }),
    asyncHandler(reviewController.createAdmin)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(reviewController.remove)
);

export default router;
