import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    createAttractionSchema,
    idParamSchema,
    slugParamSchema,
    listAttractionSchema,
    updateAttractionSchema,
} from './attraction.validation.js';
import * as attractionController from './attraction.controller.js';

const router = Router();

router.get(
    '/',
    optionalAuth,
    validate({ query: listAttractionSchema }),
    asyncHandler(attractionController.list)
);

router.get(
    '/slug/:slug',
    optionalAuth,
    validate({ params: slugParamSchema }),
    asyncHandler(attractionController.getBySlug)
);

router.get(
    '/:id',
    optionalAuth,
    validate({ params: idParamSchema }),
    asyncHandler(attractionController.getById)
);

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createAttractionSchema }),
    asyncHandler(attractionController.create)
);

router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateAttractionSchema }),
    asyncHandler(attractionController.update)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(attractionController.remove)
);

export default router;
