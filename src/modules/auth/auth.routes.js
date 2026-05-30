import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { loginSchema, signupSchema } from './auth.validation.js';
import * as authController from './auth.controller.js';

const router = Router();

router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));

router.post(
    '/signup',
    authLimiter,
    requireAuth,
    requireRole('ADMIN'),
    validate({ body: signupSchema }),
    asyncHandler(authController.adminCreateStaff)
);

router.post('/refresh', authLimiter, asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', requireAuth, asyncHandler(authController.me));

export default router;
