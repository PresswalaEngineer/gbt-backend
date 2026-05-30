import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as emailTemplateController from './email-template.controller.js';
import {
    listTemplateSchema,
    updateTemplateSchema,
    idParamSchema,
} from './email-template.validation.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: listTemplateSchema }), asyncHandler(emailTemplateController.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(emailTemplateController.getById));
router.patch(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateTemplateSchema }),
    asyncHandler(emailTemplateController.update)
);

export default router;
