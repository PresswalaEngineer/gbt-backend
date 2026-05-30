import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema, listQuerySchema, updateStaffSchema } from './staff.validation.js';
import * as staffController from './staff.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
    '/',
    requireRole('ADMIN'),
    validate({ query: listQuerySchema }),
    asyncHandler(staffController.list)
);

router.get(
    '/:id',
    validate({ params: idParamSchema }),
    asyncHandler(staffController.getById)
);

router.patch(
    '/:id',
    validate({ params: idParamSchema, body: updateStaffSchema }),
    asyncHandler(staffController.update)
);

router.delete(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(staffController.remove)
);

export default router;
