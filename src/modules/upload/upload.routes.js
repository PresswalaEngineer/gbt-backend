import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { env } from '../../config/env.js';
import { cleanupSchema, presignSchema } from './upload.validation.js';
import * as uploadController from './upload.controller.js';

const uploadLimiter = rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: 30,
    handler: (_req, res) =>
        res
            .status(429)
            .json({ success: false, message: 'Too many upload requests', code: 'RATE_LIMITED' }),
});

const router = Router();

router.put(
    '/local-put',
    express.raw({ type: () => true, limit: env.UPLOAD_MAX_SIZE_BYTES }),
    asyncHandler(uploadController.localPut)
);

router.use(requireAuth);

router.post(
    '/presign',
    uploadLimiter,
    validate({ body: presignSchema }),
    asyncHandler(uploadController.presign)
);

router.post(
    '/cleanup',
    uploadLimiter,
    validate({ body: cleanupSchema }),
    asyncHandler(uploadController.cleanup)
);

export default router;
