import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    createBannerSchema,
    idParamSchema,
    listBannerSchema,
    updateBannerSchema,
} from './banner.validation.js';
import * as bannerController from './banner.controller.js';

const router = Router();

router.get('/', optionalAuth, validate({ query: listBannerSchema }), asyncHandler(bannerController.list));

router.get('/:id', optionalAuth, validate({ params: idParamSchema }), asyncHandler(bannerController.getById));

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createBannerSchema }),
    asyncHandler(bannerController.create)
);

router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateBannerSchema }),
    asyncHandler(bannerController.update)
);

router.patch(
    '/:id/activate',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(bannerController.activate)
);

router.patch(
    '/:id/deactivate',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(bannerController.deactivate)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(bannerController.remove)
);

export default router;
