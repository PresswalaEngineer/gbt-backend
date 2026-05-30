import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    createBlogSchema,
    idParamSchema,
    listBlogSchema,
    slugParamSchema,
    updateBlogSchema,
} from './blog.validation.js';
import * as blogController from './blog.controller.js';

const router = Router();

router.get(
    '/',
    optionalAuth,
    validate({ query: listBlogSchema }),
    asyncHandler(blogController.list)
);

router.get(
    '/slug/:slug',
    optionalAuth,
    validate({ params: slugParamSchema }),
    asyncHandler(blogController.getBySlug)
);

router.get(
    '/:id',
    optionalAuth,
    validate({ params: idParamSchema }),
    asyncHandler(blogController.getById)
);

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createBlogSchema }),
    asyncHandler(blogController.create)
);

router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateBlogSchema }),
    asyncHandler(blogController.update)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(blogController.remove)
);

export default router;
