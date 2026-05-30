import { ApiError } from '../../utils/api-error.js';

// Resolves the cart owner for a request. Runs AFTER optionalAuth. A logged-in
// customer always wins over any X-Guest-Id header (so a guest id can't be used to
// hijack a customer's cart). Guests are identified by the X-Guest-Id header that
// the storefront always sends (persisted in a cookie + localStorage).
export function resolveOwner(req, _res, next) {
    if (req.customer?.id) {
        req.cartOwner = { ownerType: 'CUSTOMER', ownerId: String(req.customer.id) };
        return next();
    }
    const guestId = req.headers['x-guest-id'];
    if (typeof guestId === 'string' && guestId.trim()) {
        req.cartOwner = { ownerType: 'GUEST', ownerId: guestId.trim() };
        return next();
    }
    return next(ApiError.badRequest('Guest identifier required', { code: 'GUEST_ID_REQUIRED' }));
}
