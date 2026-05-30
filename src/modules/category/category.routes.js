import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    createCategorySchema,
    idParamSchema,
    listCategorySchema,
    updateCategorySchema,
} from './category.validation.js';
import * as categoryController from './category.controller.js';

const router = Router();

router.get('/', optionalAuth, validate({ query: listCategorySchema }), asyncHandler(categoryController.list));
router.get('/:id', optionalAuth, validate({ params: idParamSchema }), asyncHandler(categoryController.getById));

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createCategorySchema }),
    asyncHandler(categoryController.create)
);

router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateCategorySchema }),
    asyncHandler(categoryController.update)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(categoryController.remove)
);

export default router;
