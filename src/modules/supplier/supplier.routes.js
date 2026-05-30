import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    contractIdParamSchema,
    createContractSchema,
    createSupplierSchema,
    idParamSchema,
    listSupplierSchema,
    updateSupplierSchema,
} from './supplier.validation.js';
import * as supplierController from './supplier.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listSupplierSchema }), asyncHandler(supplierController.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(supplierController.getById));

router.post(
    '/',
    requireRole('ADMIN'),
    validate({ body: createSupplierSchema }),
    asyncHandler(supplierController.create)
);

router.patch(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateSupplierSchema }),
    asyncHandler(supplierController.update)
);

router.delete(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(supplierController.remove)
);

router.post(
    '/:id/contracts',
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: createContractSchema }),
    asyncHandler(supplierController.addContract)
);

router.delete(
    '/:id/contracts/:contractId',
    requireRole('ADMIN'),
    validate({ params: contractIdParamSchema }),
    asyncHandler(supplierController.removeContract)
);

export default router;
