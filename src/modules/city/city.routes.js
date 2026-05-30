import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    createCitySchema,
    idParamSchema,
    listCitySchema,
    updateCitySchema,
} from './city.validation.js';
import * as cityController from './city.controller.js';

const router = Router();

router.get('/', optionalAuth, validate({ query: listCitySchema }), asyncHandler(cityController.list));
router.get('/:id', optionalAuth, validate({ params: idParamSchema }), asyncHandler(cityController.getById));

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createCitySchema }),
    asyncHandler(cityController.create)
);

router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateCitySchema }),
    asyncHandler(cityController.update)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(cityController.remove)
);

export default router;
