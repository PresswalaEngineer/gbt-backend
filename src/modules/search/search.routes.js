import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as searchController from './search.controller.js';
import { suggestQuerySchema } from './search.validation.js';

const router = Router();

router.get(
    '/suggest',
    optionalAuth,
    validate({ query: suggestQuerySchema }),
    asyncHandler(searchController.suggest)
);

export default router;
