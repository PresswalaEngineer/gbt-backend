import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import jwt from 'jsonwebtoken';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import { getR2Client, R2_BUCKET, R2_PUBLIC_BASE_URL } from '../../services/storage/r2-client.js';
import {
    LOCAL_PUBLIC_BASE_URL,
    LOCAL_UPLOAD_DIR,
} from '../../services/storage/local-client.js';

const SAFE_NAME_RE = /[^a-z0-9-_.]+/gi;
const LOCAL_TOKEN_AUDIENCE = 'upload:local';

function sanitizeFilename(filename) {
    const ext = path.extname(filename).toLowerCase();
    const base = path
        .basename(filename, ext)
        .toLowerCase()
        .replace(SAFE_NAME_RE, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return { base: base || 'file', ext };
}

function buildKey({ folder, filename }) {
    const { base, ext } = sanitizeFilename(filename);
    const datePart = new Date().toISOString().slice(0, 10);
    const random = crypto.randomBytes(8).toString('hex');
    const safeFolder = (folder || 'uploads').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    return `${safeFolder}/${datePart}/${random}-${base}${ext}`;
}

function assertAllowed({ contentType, size }) {
    if (!env.UPLOAD_ALLOWED_MIME.includes(contentType)) {
        throw ApiError.badRequest(`Content type "${contentType}" is not allowed`, {
            code: 'MIME_NOT_ALLOWED',
            details: { allowed: env.UPLOAD_ALLOWED_MIME },
        });
    }
    if (size > env.UPLOAD_MAX_SIZE_BYTES) {
        throw ApiError.badRequest('File exceeds the maximum allowed size', {
            code: 'FILE_TOO_LARGE',
            details: { maxBytes: env.UPLOAD_MAX_SIZE_BYTES },
        });
    }
}

async function buildR2Upload({ key, contentType, size }) {
    const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
    });

    const uploadUrl = await getSignedUrl(getR2Client(), command, {
        expiresIn: env.R2_PRESIGN_EXPIRES_IN,
    });

    return {
        uploadUrl,
        publicUrl: `${R2_PUBLIC_BASE_URL}/${key}`,
        key,
        bucket: R2_BUCKET,
        expiresIn: env.R2_PRESIGN_EXPIRES_IN,
        headers: { 'Content-Type': contentType },
    };
}

function buildLocalUpload({ key, contentType, size }) {
    const expiresIn = env.R2_PRESIGN_EXPIRES_IN;
    const token = jwt.sign(
        { key, contentType, size },
        env.JWT_ACCESS_SECRET,
        { expiresIn, audience: LOCAL_TOKEN_AUDIENCE }
    );
    const uploadUrl = `${env.PUBLIC_BASE_URL}${env.API_PREFIX}/uploads/local-put?token=${encodeURIComponent(token)}`;

    return {
        uploadUrl,
        publicUrl: `${LOCAL_PUBLIC_BASE_URL}/${key}`,
        key,
        bucket: 'local',
        expiresIn,
        headers: { 'Content-Type': contentType },
    };
}

export async function buildPresignedUpload({ filename, contentType, size, folder }) {
    assertAllowed({ contentType, size });
    const key = buildKey({ folder, filename });

    if (env.STORAGE_DRIVER === 'r2') {
        return buildR2Upload({ key, contentType, size });
    }
    return buildLocalUpload({ key, contentType, size });
}

function resolveKeyFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    if (R2_PUBLIC_BASE_URL && url.startsWith(`${R2_PUBLIC_BASE_URL}/`)) {
        return { driver: 'r2', key: url.slice(R2_PUBLIC_BASE_URL.length + 1) };
    }
    if (LOCAL_PUBLIC_BASE_URL && url.startsWith(`${LOCAL_PUBLIC_BASE_URL}/`)) {
        return { driver: 'local', key: url.slice(LOCAL_PUBLIC_BASE_URL.length + 1) };
    }
    return null;
}

async function deleteOne({ driver, key }) {
    if (!key) return false;
    try {
        if (driver === 'r2') {
            await getR2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
            return true;
        }
        const safeKey = path.normalize(key).replace(/^([./\\])+/, '');
        const targetPath = path.join(LOCAL_UPLOAD_DIR, safeKey);
        if (!targetPath.startsWith(LOCAL_UPLOAD_DIR)) return false;
        await fs.unlink(targetPath).catch((err) => {
            if (err?.code !== 'ENOENT') throw err;
        });
        return true;
    } catch (err) {
        logger.warn({ err, driver, key }, 'storage cleanup failed');
        return false;
    }
}

export async function cleanupUploads({ urls }) {
    const results = await Promise.all(
        (urls ?? []).map(async (url) => {
            const resolved = resolveKeyFromUrl(url);
            if (!resolved) return { url, status: 'skipped' };
            const ok = await deleteOne(resolved);
            return { url, status: ok ? 'deleted' : 'failed' };
        })
    );
    return {
        deleted: results.filter((r) => r.status === 'deleted').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        failed: results.filter((r) => r.status === 'failed').length,
        results,
    };
}

export async function persistLocalUpload({ token, body, contentType }) {
    if (env.STORAGE_DRIVER !== 'local') {
        throw ApiError.badRequest('Local upload endpoint is disabled', {
            code: 'LOCAL_UPLOAD_DISABLED',
        });
    }
    if (!token) {
        throw ApiError.unauthorized('Missing upload token', { code: 'UPLOAD_TOKEN_MISSING' });
    }
    if (!body || !body.length) {
        throw ApiError.badRequest('Empty upload body', { code: 'UPLOAD_EMPTY' });
    }

    let payload;
    try {
        payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { audience: LOCAL_TOKEN_AUDIENCE });
    } catch {
        throw ApiError.unauthorized('Invalid or expired upload token', {
            code: 'UPLOAD_TOKEN_INVALID',
        });
    }

    if (contentType && contentType !== payload.contentType) {
        throw ApiError.badRequest('Content type mismatch with signed token', {
            code: 'UPLOAD_CONTENT_TYPE_MISMATCH',
        });
    }
    if (body.length > env.UPLOAD_MAX_SIZE_BYTES || body.length > payload.size) {
        throw ApiError.badRequest('Upload body exceeds size limit', { code: 'FILE_TOO_LARGE' });
    }

    const safeKey = path.normalize(payload.key).replace(/^([./\\])+/, '');
    const targetPath = path.join(LOCAL_UPLOAD_DIR, safeKey);
    if (!targetPath.startsWith(LOCAL_UPLOAD_DIR)) {
        throw ApiError.badRequest('Invalid storage key', { code: 'UPLOAD_KEY_INVALID' });
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, body);

    return {
        key: payload.key,
        size: body.length,
        publicUrl: `${LOCAL_PUBLIC_BASE_URL}/${payload.key}`,
    };
}
