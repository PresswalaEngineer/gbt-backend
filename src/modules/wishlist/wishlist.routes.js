import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireCustomer } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { addWishlistSchema, tourIdParamSchema } from './wishlist.validation.js';
import * as wishlistController from './wishlist.controller.js';

const router = Router();

router.get('/', requireCustomer, asyncHandler(wishlistController.list));
router.post(
    '/',
    requireCustomer,
    validate({ body: addWishlistSchema }),
    asyncHandler(wishlistController.add)
);
router.delete(
    '/:tourId',
    requireCustomer,
    validate({ params: tourIdParamSchema }),
    asyncHandler(wishlistController.remove)
);

export default router;
