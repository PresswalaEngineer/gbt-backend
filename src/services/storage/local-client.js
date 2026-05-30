import path from 'node:path';
import { env } from '../../config/env.js';

export const LOCAL_UPLOAD_DIR = path.isAbsolute(env.UPLOAD_LOCAL_DIR)
    ? env.UPLOAD_LOCAL_DIR
    : path.resolve(process.cwd(), env.UPLOAD_LOCAL_DIR);

export const LOCAL_PUBLIC_PATH = env.UPLOAD_LOCAL_PUBLIC_PATH;

export const LOCAL_PUBLIC_BASE_URL = `${env.PUBLIC_BASE_URL}${LOCAL_PUBLIC_PATH}`;
