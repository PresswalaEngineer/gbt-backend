import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
import * as alertController from './alert.controller.js';
import {
    alertTypeSchema,
    updateSettingSchema,
    sendTestSchema,
    listLogSchema,
} from './alert.validation.js';

const router = Router();
router.use(requireAuth);

router.get('/settings', asyncHandler(alertController.listSettings));
router.patch(
    '/settings/:alertType',
    requireRole('ADMIN'),
    validate({ params: alertTypeSchema, body: updateSettingSchema }),
    asyncHandler(alertController.updateSetting)
);

router.post(
    '/test',
    requireRole('ADMIN'),
    validate({ body: sendTestSchema }),
    asyncHandler(alertController.sendTest)
);

router.get('/logs', validate({ query: listLogSchema }), asyncHandler(alertController.listLogs));
router.get(
    '/logs/:id',
    validate({ params: z.object({ id: z.coerce.number().int().positive() }) }),
    asyncHandler(alertController.getLog)
);

export default router;
