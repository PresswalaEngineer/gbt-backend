import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import { getR2Client, R2_BUCKET, R2_PUBLIC_BASE_URL } from '../storage/r2-client.js';
import { LOCAL_PUBLIC_BASE_URL, LOCAL_UPLOAD_DIR } from '../storage/local-client.js';

const SAFE_NAME_RE = /[^a-z0-9-_.]+/gi;
const EXT_FROM_MIME = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
};

function sanitizeBase(filename) {
    const ext = path.extname(filename).toLowerCase();
    const base = path
        .basename(filename, ext)
        .toLowerCase()
        .replace(SAFE_NAME_RE, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return { base: base || 'image', ext };
}

function buildKey({ folder, filename, contentType }) {
    const { base, ext: extFromName } = sanitizeBase(filename);
    const ext = extFromName || EXT_FROM_MIME[contentType] || '.jpg';
    const datePart = new Date().toISOString().slice(0, 10);
    const random = crypto.randomBytes(8).toString('hex');
    const safeFolder = (folder || 'integrations').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    return `${safeFolder}/${datePart}/${random}-${base}${ext}`;
}

function deriveFilename(remoteUrl) {
    try {
        const u = new URL(remoteUrl);
        const last = u.pathname.split('/').filter(Boolean).pop() || 'image';
        return last;
    } catch {
        return 'image';
    }
}

export async function mirrorRemoteImage(remoteUrl, { folder = 'integrations' } = {}) {
    if (!remoteUrl) return null;

    let response;
    try {
        response = await fetch(remoteUrl);
    } catch (cause) {
        logger.warn({ err: cause, remoteUrl }, 'mirrorRemoteImage: fetch failed');
        return null;
    }

    if (!response.ok) {
        logger.warn(
            { status: response.status, remoteUrl },
            'mirrorRemoteImage: upstream returned non-2xx'
        );
        return null;
    }

    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (contentType && !env.UPLOAD_ALLOWED_MIME.includes(contentType)) {
        logger.warn(
            { contentType, remoteUrl, allowed: env.UPLOAD_ALLOWED_MIME },
            'mirrorRemoteImage: skipping disallowed MIME'
        );
        return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    if (body.length === 0) return null;
    if (body.length > env.UPLOAD_MAX_SIZE_BYTES) {
        logger.warn(
            { size: body.length, max: env.UPLOAD_MAX_SIZE_BYTES, remoteUrl },
            'mirrorRemoteImage: skipping oversize image'
        );
        return null;
    }

    const filename = deriveFilename(remoteUrl);
    const key = buildKey({ folder, filename, contentType });
    const effectiveContentType = contentType || EXT_FROM_MIME[''] || 'application/octet-stream';

    if (env.STORAGE_DRIVER === 'r2') {
        await getR2Client().send(
            new PutObjectCommand({
                Bucket: R2_BUCKET,
                Key: key,
                Body: body,
                ContentType: effectiveContentType,
                ContentLength: body.length,
            })
        );
        return { publicUrl: `${R2_PUBLIC_BASE_URL}/${key}`, key };
    }

    const safeKey = path.normalize(key).replace(/^([./\\])+/, '');
    const targetPath = path.join(LOCAL_UPLOAD_DIR, safeKey);
    if (!targetPath.startsWith(LOCAL_UPLOAD_DIR)) {
        throw ApiError.internal('Refused to write outside the upload directory', {
            code: 'UPLOAD_KEY_INVALID',
        });
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, body);
    return { publicUrl: `${LOCAL_PUBLIC_BASE_URL}/${safeKey}`, key: safeKey };
}
