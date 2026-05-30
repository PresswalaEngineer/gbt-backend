import { Router } from 'express';
import { asyncHandler } from '../../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import {
    searchToursQuerySchema,
    tourQuerySchema,
    tourParamsSchema,
} from './tourcms.validation.js';
import * as tourcmsController from './tourcms.controller.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/ping', asyncHandler(tourcmsController.ping));

router.get(
    '/tours/search',
    validate({ query: searchToursQuerySchema }),
    asyncHandler(tourcmsController.search)
);

router.get(
    '/tours/:tourId',
    validate({ params: tourParamsSchema, query: tourQuerySchema }),
    asyncHandler(tourcmsController.show)
);

router.post(
    '/tours/:tourId/import',
    validate({ params: tourParamsSchema, query: tourQuerySchema }),
    asyncHandler(tourcmsController.importTour)
);

export default router;
