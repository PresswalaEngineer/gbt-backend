export class ApiError extends Error {
    constructor(statusCode, message, { code, details } = {}) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code ?? null;
        this.details = details ?? null;
        this.isOperational = true;
        Error.captureStackTrace?.(this, this.constructor);
    }

    static badRequest(message = 'Bad request', extra) {
        return new ApiError(400, message, extra);
    }
    static unauthorized(message = 'Unauthorized', extra) {
        return new ApiError(401, message, extra);
    }
    static forbidden(message = 'Forbidden', extra) {
        return new ApiError(403, message, extra);
    }
    static notFound(message = 'Not found', extra) {
        return new ApiError(404, message, extra);
    }
    static conflict(message = 'Conflict', extra) {
        return new ApiError(409, message, extra);
    }
    static unprocessable(message = 'Unprocessable entity', extra) {
        return new ApiError(422, message, extra);
    }
    static tooMany(message = 'Too many requests', extra) {
        return new ApiError(429, message, extra);
    }
    static internal(message = 'Internal server error', extra) {
        return new ApiError(500, message, extra);
    }
    static badGateway(message = 'Upstream request failed', extra) {
        return new ApiError(502, message, extra);
    }
    static serviceUnavailable(message = 'Service unavailable', extra) {
        return new ApiError(503, message, extra);
    }
}
