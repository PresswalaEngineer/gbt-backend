import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import * as statsController from './stats.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/overview', asyncHandler(statsController.overview));

export default router;
