import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { getTransport, getDefaultFrom } from './transport.js';

// Official logo, embedded as a CID inline attachment. Email clients (Gmail etc.)
// can't load localhost URLs and often strip base64 data-URIs, so the reliable
// way to show the logo in the email body is a `cid:` reference backed by an
// inline attachment.
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_CID = 'gbtlogo';
let LOGO_BUFFER = null;
try {
    LOGO_BUFFER = readFileSync(join(__dirname, '../voucher/assets/logo.png'));
} catch {
    LOGO_BUFFER = null;
}

function logoAttachment() {
    if (!LOGO_BUFFER) return null;
    return { filename: 'logo.png', content: LOGO_BUFFER, contentType: 'image/png', cid: LOGO_CID };
}

export async function sendEmail({
    alertType,
    templateId = null,
    toEmail,
    toName = null,
    subject,
    bodyHtml,
    bodyText = null,
    fromName = null,
    fromEmail = null,
    metadata = null,
    attachments = null,
}) {
    const html = bodyHtml;
    const log = await prisma.emailLog.create({
        data: {
            alertType,
            templateId,
            toEmail,
            toName,
            subject,
            bodyHtml: html,
            status: 'QUEUED',
            metadata,
        },
    });

    const transport = getTransport();
    if (!transport) {
        await prisma.emailLog.update({
            where: { id: log.id },
            data: { status: 'SKIPPED', errorMessage: 'Mail transport disabled' },
        });
        logger.info({ alertType, toEmail, subject }, 'email skipped (mail disabled)');
        return { ...log, status: 'SKIPPED' };
    }

    const from = getDefaultFrom({ overrideName: fromName, overrideEmail: fromEmail });
    const logo = logoAttachment();
    const allAttachments = [...(attachments || []), ...(logo ? [logo] : [])];
    try {
        const info = await transport.sendMail({
            from,
            to: toName ? `"${toName}" <${toEmail}>` : toEmail,
            subject,
            html,
            text: bodyText || undefined,
            attachments: allAttachments.length ? allAttachments : undefined,
        });
        const updated = await prisma.emailLog.update({
            where: { id: log.id },
            data: {
                status: 'SENT',
                sentAt: new Date(),
                providerMessageId: info?.messageId ?? null,
            },
        });
        logger.info({ alertType, toEmail, subject, messageId: info?.messageId }, 'email sent');
        return updated;
    } catch (err) {
        const updated = await prisma.emailLog.update({
            where: { id: log.id },
            data: { status: 'FAILED', errorMessage: err?.message?.slice(0, 1000) ?? 'send failed' },
        });
        logger.error({ err, alertType, toEmail, subject }, 'email send failed');
        return updated;
    }
}
