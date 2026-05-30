import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';

let stripeInstance = null;

export function isStripeConfigured() {
    return Boolean(env.STRIPE_SECRET_KEY);
}

// Lazily instantiated — the API boots without Stripe keys; this only throws when
// a payment endpoint is actually hit while unconfigured (mirrors TourCMS/Ventrata).
export function getStripe() {
    if (!env.STRIPE_SECRET_KEY) {
        throw ApiError.serviceUnavailable('Payments are not configured', {
            code: 'STRIPE_NOT_CONFIGURED',
        });
    }
    if (!stripeInstance) {
        stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
            apiVersion: '2024-06-20',
        });
    }
    return stripeInstance;
}
