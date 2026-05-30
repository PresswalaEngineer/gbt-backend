export function success(res, data = null, { status = 200, message, meta } = {}) {
    return res.status(status).json({
        success: true,
        message: message ?? null,
        data,
        meta: meta ?? null,
    });
}

export function created(res, data, options = {}) {
    return success(res, data, { ...options, status: 201 });
}

export function noContent(res) {
    return res.status(204).end();
}
