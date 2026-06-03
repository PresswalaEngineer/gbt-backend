import { prisma } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { getTransport, getDefaultFrom } from './transport.js';

// Prepend the official Global Bus Tours logo to every outgoing email. Uses a
// hosted URL (email clients block base64), inserted just inside <body> so it
// sits above the template's own header. Applies to all templates centrally.
function withBrandLogo(html) {
    if (!html || typeof html !== 'string') return html;
    const logo =
        `<div style="text-align:center;padding:18px 0 8px;background:#f8f9fb">` +
        `<img src="${env.STOREFRONT_URL}/logo.png" alt="Global Bus Tours" style="height:38px;width:auto;display:inline-block"/>` +
        `</div>`;
    return /<body[^>]*>/i.test(html) ? html.replace(/(<body[^>]*>)/i, `$1${logo}`) : logo + html;
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
    const html = withBrandLogo(bodyHtml);
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
    try {
        const info = await transport.sendMail({
            from,
            to: toName ? `"${toName}" <${toEmail}>` : toEmail,
            subject,
            html,
            text: bodyText || undefined,
            attachments: attachments && attachments.length ? attachments : undefined,
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
