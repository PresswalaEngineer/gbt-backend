import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { requireCustomer } from '../../middleware/auth.js';
import { facebookSchema, googleSchema, loginSchema, registerSchema, updateProfileSchema } from './customer-auth.validation.js';
import * as customerAuthController from './customer-auth.controller.js';

const router = Router();

router.post(
    '/register',
    authLimiter,
    validate({ body: registerSchema }),
    asyncHandler(customerAuthController.register)
);
router.post(
    '/login',
    authLimiter,
    validate({ body: loginSchema }),
    asyncHandler(customerAuthController.login)
);
router.post(
    '/google',
    authLimiter,
    validate({ body: googleSchema }),
    asyncHandler(customerAuthController.google)
);
router.post(
    '/facebook',
    authLimiter,
    validate({ body: facebookSchema }),
    asyncHandler(customerAuthController.facebook)
);
router.post('/refresh', authLimiter, asyncHandler(customerAuthController.refresh));
router.post('/logout', asyncHandler(customerAuthController.logout));
router.get('/me', requireCustomer, asyncHandler(customerAuthController.me));
router.patch(
    '/me',
    requireCustomer,
    validate({ body: updateProfileSchema }),
    asyncHandler(customerAuthController.updateProfile)
);

export default router;
