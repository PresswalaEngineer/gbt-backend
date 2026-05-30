import { ApiError } from '../utils/api-error.js';

export const validate = (schemas) => (req, _res, next) => {
    try {
        if (schemas.body) req.body = schemas.body.parse(req.body);
        if (schemas.query) req.query = schemas.query.parse(req.query);
        if (schemas.params) req.params = schemas.params.parse(req.params);
        next();
    } catch (error) {
        if (error?.name === 'ZodError') {
            return next(
                ApiError.badRequest('Validation failed', {
                    code: 'VALIDATION_ERROR',
                    details: error.flatten().fieldErrors,
                })
            );
        }
        next(error);
    }
};
