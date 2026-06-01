import { success } from '../../utils/api-response.js';
import * as paymentService from './payment.service.js';

export async function checkout(req, res) {
    const result = await paymentService.createCheckout(req.params.id, req.customer.id);
    return success(res, result, { message: 'Checkout session created' });
}

export async function checkoutCart(req, res) {
    const { bookingIds, currency } = req.body;
    const result = await paymentService.createCartCheckout(bookingIds, req.customer.id, currency);
    return success(res, result, { message: 'Checkout session created' });
}

export async function confirm(req, res) {
    const { sessionId, paymentIntentId } = req.body;
    const result = sessionId
        ? await paymentService.confirmCheckoutSession(sessionId, req.customer.id)
        : await paymentService.confirmPaidIntent(paymentIntentId, req.customer.id);
    return success(res, result, { message: 'Payment confirmed' });
}
