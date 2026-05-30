import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as customerController from './customer.controller.js';
import {
    createCustomerSchema,
    updateCustomerSchema,
    listCustomerSchema,
    idParamSchema,
} from './customer.validation.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: listCustomerSchema }), asyncHandler(customerController.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(customerController.getById));
router.post('/', requireRole('ADMIN'), validate({ body: createCustomerSchema }), asyncHandler(customerController.create));
router.patch(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateCustomerSchema }),
    asyncHandler(customerController.update)
);
router.delete(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(customerController.remove)
);

export default router;
