import { created, success } from '../../utils/api-response.js';
import * as reservationService from './reservation.service.js';

export async function getCart(req, res) {
    return success(res, await reservationService.getCart(req.cartOwner));
}

export async function addItem(req, res) {
    return created(res, await reservationService.addItem(req.cartOwner, req.body), {
        message: 'Added to cart',
    });
}

export async function updateItem(req, res) {
    return success(res, await reservationService.updateItem(req.cartOwner, req.params.id, req.body), {
        message: 'Cart item updated',
    });
}

export async function removeItem(req, res) {
    return success(res, await reservationService.removeItem(req.cartOwner, req.params.id), {
        message: 'Removed from cart',
    });
}

export async function clearCart(req, res) {
    return success(res, await reservationService.clearCart(req.cartOwner), { message: 'Cart cleared' });
}

export async function migrate(req, res) {
    const owner = { ownerType: 'CUSTOMER', ownerId: String(req.customer.id) };
    return success(res, await reservationService.migrateGuestCart(req.customer.id, req.body.guestId), {
        message: 'Cart migrated',
    });
}

export async function checkout(req, res) {
    const owner = { ownerType: 'CUSTOMER', ownerId: String(req.customer.id) };
    return created(res, await reservationService.checkout(owner, req.body), { message: 'Checkout complete' });
}
