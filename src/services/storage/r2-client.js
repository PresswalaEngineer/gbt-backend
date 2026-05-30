import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

let client = null;

export function getR2Client() {
    if (env.STORAGE_DRIVER !== 'r2') {
        throw new Error('R2 client requested but STORAGE_DRIVER is not "r2"');
    }
    if (!client) {
        client = new S3Client({
            region: 'auto',
            endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: env.R2_ACCESS_KEY_ID,
                secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            },
            forcePathStyle: true,
        });
    }
    return client;
}

export const R2_BUCKET = env.R2_BUCKET;
export const R2_PUBLIC_BASE_URL = env.R2_PUBLIC_BASE_URL;
