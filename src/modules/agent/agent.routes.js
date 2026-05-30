import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as agentController from './agent.controller.js';
import {
    createAgentSchema,
    updateAgentSchema,
    listAgentSchema,
    idParamSchema,
} from './agent.validation.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: listAgentSchema }), asyncHandler(agentController.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(agentController.getById));
router.post('/', requireRole('ADMIN'), validate({ body: createAgentSchema }), asyncHandler(agentController.create));
router.patch(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: idParamSchema, body: updateAgentSchema }),
    asyncHandler(agentController.update)
);
router.delete(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    asyncHandler(agentController.remove)
);

export default router;
