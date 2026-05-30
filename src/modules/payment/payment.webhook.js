import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { getStripe } from '../../services/payments/stripe-client.js';
import { handleStripeEvent } from './payment.service.js';

// Raw-body Express handler. Mounted in app.js BEFORE express.json() so the
// Stripe signature can be verified against the unparsed payload.
export async function stripeWebhookHandler(req, res) {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
        return res
            .status(503)
            .json({ success: false, message: 'Stripe is not configured', code: 'STRIPE_NOT_CONFIGURED' });
    }

    const signature = req.headers['stripe-signature'];
    let event;
    try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        logger.warn({ err: err?.message }, 'stripe webhook signature verification failed');
        return res.status(400).json({ success: false, message: `Webhook Error: ${err?.message}` });
    }

    try {
        await handleStripeEvent(event);
    } catch (err) {
        // We logged it; still ack with 200 so Stripe stops retrying an error we own.
        logger.error({ err: err?.message, type: event.type }, 'stripe webhook handler error');
    }

    return res.json({ received: true });
}
