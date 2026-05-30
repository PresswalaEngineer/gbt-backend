import { Router } from 'express';
import { asyncHandler } from '../../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import {
    searchProductsQuerySchema,
    supplierQuerySchema,
    productParamsSchema,
} from './ventrata.validation.js';
import * as ventrataController from './ventrata.controller.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/ping', asyncHandler(ventrataController.ping));

router.get(
    '/products/search',
    validate({ query: searchProductsQuerySchema }),
    asyncHandler(ventrataController.search)
);

router.get(
    '/products/:productId',
    validate({ params: productParamsSchema, query: supplierQuerySchema }),
    asyncHandler(ventrataController.show)
);

router.post(
    '/products/:productId/import',
    validate({ params: productParamsSchema, query: supplierQuerySchema }),
    asyncHandler(ventrataController.importProduct)
);

export default router;
