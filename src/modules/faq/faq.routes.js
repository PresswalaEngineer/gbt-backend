import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    createFaqSchema,
    idParamSchema,
    listFaqSchema,
    replaceFaqsSchema,
    updateFaqSchema,
} from './faq.validation.js';
import * as faqController from './faq.controller.js';

const router = Router();

router.get('/', optionalAuth, validate({ query: listFaqSchema }), asyncHandler(faqController.list));

router.put(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: replaceFaqsSchema }),
    asyncHandler(faqController.replace)
);

router.get('/:id', optionalAuth, validate({ params: idParamSchema }), asyncHandler(faqController.getById));

router.post(
    '/',
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: createFaqSchema }),
    asyncHandler(faqController.create)
);

router.patch(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateFaqSchema }),
    asyncHandler(faqController.update)
);

router.delete(
    '/:id',
    requireAuth,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(faqController.remove)
);

export default router;
