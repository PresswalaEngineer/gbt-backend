import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/api-error.js';
import { logger } from '../../../utils/logger.js';

const USER_AGENT = 'gbt-admin/1.0 (+Ventrata OCTO integration)';

function ensureConfigured() {
    if (!env.VENTRATA_API_KEY) {
        throw ApiError.serviceUnavailable('Ventrata integration is not configured', {
            code: 'VENTRATA_NOT_CONFIGURED',
            details: { missing: ['VENTRATA_API_KEY'] },
        });
    }
}

function bubbleUpstreamError(parsed, statusCode) {
    const errorCode = parsed?.errorCode || parsed?.error || 'UPSTREAM_ERROR';
    const message =
        parsed?.errorMessage ||
        parsed?.message ||
        (typeof parsed === 'string' ? parsed : null) ||
        `Ventrata upstream returned ${statusCode}`;
    throw ApiError.badGateway(message, {
        code: 'VENTRATA_UPSTREAM_ERROR',
        details: { statusCode, errorCode, upstream: parsed ?? null },
    });
}

export async function ventrataRequest({ verb = 'GET', path, body, apiKey, env: octoEnv }) {
    ensureConfigured();
    if (!path || !path.startsWith('/')) {
        throw ApiError.internal('Ventrata request path must start with "/"', {
            code: 'VENTRATA_BAD_PATH',
        });
    }

    const url = `${env.VENTRATA_BASE_URL}${path}`;
    const effectiveKey = apiKey || env.VENTRATA_API_KEY;
    const effectiveEnv = octoEnv || env.VENTRATA_OCTO_ENV;

    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${effectiveKey}`,
        'Octo-Capabilities': env.VENTRATA_OCTO_CAPABILITIES.join(', '),
        'Octo-Env': effectiveEnv,
        'User-Agent': USER_AGENT,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(url, {
        method: verb,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    }).catch((cause) => {
        logger.error({ err: cause, url }, 'Ventrata network error');
        throw ApiError.badGateway('Could not reach Ventrata', {
            code: 'VENTRATA_NETWORK_ERROR',
            details: { url, cause: cause?.message },
        });
    });

    const text = await response.text();
    let parsed;
    if (text) {
        try {
            parsed = JSON.parse(text);
        } catch (cause) {
            throw ApiError.badGateway('Ventrata returned invalid JSON', {
                code: 'VENTRATA_PARSE_ERROR',
                details: { statusCode: response.status, body: text.slice(0, 400) },
            });
        }
    }

    if (!response.ok) {
        bubbleUpstreamError(parsed, response.status);
    }

    return parsed ?? null;
}

export const ventrataClient = {
    listProducts: ({ apiKey } = {}) =>
        ventrataRequest({ path: '/products', apiKey }),
    getProduct: ({ productId, apiKey }) =>
        ventrataRequest({
            path: `/products/${encodeURIComponent(productId)}`,
            apiKey,
        }),
    checkAvailability: ({ apiKey, payload }) =>
        ventrataRequest({
            verb: 'POST',
            path: '/availability',
            apiKey,
            body: payload,
        }),
    createBooking: ({ apiKey, payload }) =>
        ventrataRequest({
            verb: 'POST',
            path: '/bookings',
            apiKey,
            body: payload,
        }),
    confirmBooking: ({ apiKey, uuid, payload }) =>
        ventrataRequest({
            verb: 'POST',
            path: `/bookings/${encodeURIComponent(uuid)}/confirm`,
            apiKey,
            body: payload,
        }),
    cancelBooking: ({ apiKey, uuid, payload }) =>
        ventrataRequest({
            verb: 'DELETE',
            path: `/bookings/${encodeURIComponent(uuid)}`,
            apiKey,
            body: payload ?? undefined,
        }),
};
