import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    createDestCatSchema,
    idParamSchema,
    listDestCatSchema,
    updateDestCatSchema,
} from './destination-category.validation.js';
import * as controller from './destination-category.controller.js';

const router = Router();

router.get('/', optionalAuth, validate({ query: listDestCatSchema }), asyncHandler(controller.list));

router.get('/:id', optionalAuth, validate({ params: idParamSchema }), asyncHandler(controller.getById));

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createDestCatSchema }),
    asyncHandler(controller.create)
);

router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateDestCatSchema }),
    asyncHandler(controller.update)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(controller.remove)
);

export default router;
