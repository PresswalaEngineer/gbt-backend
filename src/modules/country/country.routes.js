import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    createCountrySchema,
    idParamSchema,
    slugParamSchema,
    listCountrySchema,
    updateCountrySchema,
} from './country.validation.js';
import * as countryController from './country.controller.js';

const router = Router();

router.get(
    '/',
    optionalAuth,
    validate({ query: listCountrySchema }),
    asyncHandler(countryController.list)
);

router.get(
    '/slug/:slug',
    optionalAuth,
    validate({ params: slugParamSchema }),
    asyncHandler(countryController.getBySlug)
);

router.get(
    '/:id',
    optionalAuth,
    validate({ params: idParamSchema }),
    asyncHandler(countryController.getById)
);

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createCountrySchema }),
    asyncHandler(countryController.create)
);

router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateCountrySchema }),
    asyncHandler(countryController.update)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(countryController.remove)
);

export default router;
