import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';
import { isProd } from '../config/env.js';

export function notFoundHandler(req, res, next) {
    next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, _next) {
    let statusCode = 500;
    let message = 'Internal server error';
    let code = null;
    let details = null;

    if (err instanceof ApiError) {
        statusCode = err.statusCode;
        message = err.message;
        code = err.code;
        details = err.details;
    } else if (err?.name === 'ZodError') {
        statusCode = 400;
        message = 'Validation failed';
        code = 'VALIDATION_ERROR';
        details = err.flatten().fieldErrors;
    } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            statusCode = 409;
            message = 'Duplicate entry';
            code = 'UNIQUE_VIOLATION';
            details = { fields: err.meta?.target ?? null };
        } else if (err.code === 'P2025') {
            statusCode = 404;
            message = 'Record not found';
            code = 'NOT_FOUND';
        } else {
            statusCode = 400;
            message = 'Database request failed';
            code = err.code;
        }
    } else if (err instanceof Prisma.PrismaClientValidationError) {
        statusCode = 400;
        message = 'Invalid database input';
        code = 'PRISMA_VALIDATION';
    }

    if (statusCode >= 500) {
        logger.error({ err, path: req.originalUrl }, 'Unhandled error');
    } else {
        logger.warn({ err: { message: err.message, code }, path: req.originalUrl }, 'Handled error');
    }

    res.status(statusCode).json({
        success: false,
        message,
        code,
        details,
        ...(isProd ? {} : { stack: err.stack }),
    });
}
