import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let transport;

export function getTransport() {
    if (transport) return transport;
    if (!env.MAIL_ENABLED) return null;
    if (!env.MAIL_HOST || !env.MAIL_FROM_EMAIL) {
        logger.warn('MAIL_ENABLED but MAIL_HOST/MAIL_FROM_EMAIL not set — emails will be skipped');
        return null;
    }
    transport = nodemailer.createTransport({
        host: env.MAIL_HOST,
        port: env.MAIL_PORT,
        secure: env.MAIL_SECURE,
        auth: env.MAIL_USER && env.MAIL_PASS ? { user: env.MAIL_USER, pass: env.MAIL_PASS } : undefined,
    });
    return transport;
}

export function getDefaultFrom({ overrideName, overrideEmail } = {}) {
    const email = overrideEmail || env.MAIL_FROM_EMAIL;
    const name = overrideName || env.MAIL_FROM_NAME;
    if (!email) return null;
    return name ? `"${name}" <${email}>` : email;
}
