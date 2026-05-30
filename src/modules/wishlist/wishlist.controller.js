import { success, created } from '../../utils/api-response.js';
import * as wishlistService from './wishlist.service.js';

export async function list(req, res) {
    return success(res, await wishlistService.listWishlist(req.customer.id));
}

export async function add(req, res) {
    return created(res, await wishlistService.addWishlist(req.customer.id, req.body.tourId), {
        message: 'Added to wishlist',
    });
}

export async function remove(req, res) {
    return success(res, await wishlistService.removeWishlist(req.customer.id, req.params.tourId), {
        message: 'Removed from wishlist',
    });
}
