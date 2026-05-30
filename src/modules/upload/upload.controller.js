import { success } from '../../utils/api-response.js';
import * as uploadService from './upload.service.js';

export async function presign(req, res) {
    const result = await uploadService.buildPresignedUpload(req.body);
    return success(res, result, { message: 'Presigned URL generated' });
}

export async function cleanup(req, res) {
    const result = await uploadService.cleanupUploads(req.body);
    return success(res, result, { message: 'Cleanup complete' });
}

export async function localPut(req, res) {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const result = await uploadService.persistLocalUpload({
        token,
        body: req.body,
        contentType: req.headers['content-type'],
    });
    return success(res, result, { message: 'Upload stored' });
}
