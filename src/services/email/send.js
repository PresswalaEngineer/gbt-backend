import { prisma } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { getTransport, getDefaultFrom } from './transport.js';

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
    const log = await prisma.emailLog.create({
        data: {
            alertType,
            templateId,
            toEmail,
            toName,
            subject,
            bodyHtml,
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
            html: bodyHtml,
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
