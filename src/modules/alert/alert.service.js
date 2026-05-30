import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { sendEmail } from '../../services/email/send.js';
import { renderTemplate, extractPlaceholders } from '../../services/email/render.js';
import { ALERT_TYPES, DEFAULT_TEMPLATES } from './alert.defaults.js';

async function ensureTemplate(alertType) {
    const existing = await prisma.emailTemplate.findUnique({ where: { alertType } });
    if (existing) return existing;
    const seed = DEFAULT_TEMPLATES[alertType];
    if (!seed) return null;
    return prisma.emailTemplate.create({
        data: {
            alertType,
            name: seed.name,
            subject: seed.subject,
            bodyHtml: seed.bodyHtml,
            placeholders: extractPlaceholders(seed.subject, seed.bodyHtml),
            description: seed.description ?? null,
            isActive: true,
        },
    });
}

async function ensureSetting(alertType) {
    const existing = await prisma.alertSetting.findUnique({ where: { alertType } });
    if (existing) return existing;
    return prisma.alertSetting.create({ data: { alertType, enabled: true, recipients: [] } });
}

export async function ensureAllAlertDefaults() {
    for (const alertType of ALERT_TYPES) {
        await ensureTemplate(alertType);
        await ensureSetting(alertType);
    }
}

export async function emitAlert(alertType, payload = {}, { recipients, attachments } = {}) {
    if (!ALERT_TYPES.includes(alertType)) {
        logger.warn({ alertType }, 'emitAlert called with unknown alert type');
        return [];
    }
    const setting = await ensureSetting(alertType);
    if (!setting.enabled) {
        logger.info({ alertType }, 'alert disabled, skipping');
        return [];
    }

    const tpl = await ensureTemplate(alertType);
    if (!tpl || !tpl.isActive) {
        logger.warn({ alertType }, 'no active template, skipping');
        return [];
    }

    const adminRecipients = (recipients && recipients.length ? recipients : setting.recipients) ?? [];
    const finalRecipients = adminRecipients.length ? adminRecipients : env.ALERT_DEFAULT_RECIPIENTS ?? [];

    const subject = renderTemplate(tpl.subject, payload);
    const bodyHtml = renderTemplate(tpl.bodyHtml, payload);
    const bodyText = tpl.bodyText ? renderTemplate(tpl.bodyText, payload) : null;

    const targets = [];
    if (alertType === 'BOOKING_CONFIRMATION' || alertType === 'BOOKING_CANCELLED') {
        if (payload.leadGuestEmail) {
            targets.push({ email: payload.leadGuestEmail, name: payload.leadGuestName });
        }
    }
    for (const r of finalRecipients) {
        if (r) targets.push({ email: r });
    }

    if (!targets.length) {
        logger.info({ alertType }, 'no recipients configured, skipping');
        return [];
    }

    const sent = [];
    for (const target of targets) {
        const log = await sendEmail({
            alertType,
            templateId: tpl.id,
            toEmail: target.email,
            toName: target.name ?? null,
            subject,
            bodyHtml,
            bodyText,
            fromEmail: tpl.fromEmail,
            fromName: tpl.fromName,
            metadata: { payload },
            // Attach the voucher PDF only to the guest's copy, not admin BCCs.
            attachments: target.email === payload.leadGuestEmail ? attachments : null,
        });
        sent.push(log);
    }
    return sent;
}

export async function listSettings() {
    await ensureAllAlertDefaults();
    return prisma.alertSetting.findMany({ orderBy: { alertType: 'asc' } });
}

export async function updateSetting(alertType, { enabled, recipients }) {
    if (!ALERT_TYPES.includes(alertType)) throw ApiError.badRequest('Unknown alert type');
    const data = {};
    if (enabled !== undefined) data.enabled = enabled;
    if (recipients !== undefined) data.recipients = recipients;
    return prisma.alertSetting.upsert({
        where: { alertType },
        update: data,
        create: { alertType, enabled: enabled ?? true, recipients: recipients ?? [] },
    });
}

export async function sendTest(alertType, toEmail) {
    if (!ALERT_TYPES.includes(alertType)) throw ApiError.badRequest('Unknown alert type');
    const tpl = await ensureTemplate(alertType);
    if (!tpl) throw ApiError.notFound('Template not found');

    const samplePayload = {
        leadGuestName: 'Test User',
        referenceNumber: 'BK-TEST-0001',
        tourName: 'Test Tour',
        travelDate: new Date().toISOString().slice(0, 10),
        paxCount: 2,
        totalAmount: '199.00',
        currency: 'USD',
        amount: '199.00',
        reason: 'Card declined',
        date: new Date().toISOString().slice(0, 10),
        confirmedCount: 5,
        cancelledCount: 1,
        pendingCount: 2,
        revenue: 'USD 1,250.00',
        name: 'Test Agent',
        email: 'agent@example.com',
        companyName: 'Test Travels',
        country: 'United States',
        bookingEmail: 'bookings@example.com',
        code: 'TESTCODE',
        endDate: new Date().toISOString().slice(0, 10),
    };

    const subject = renderTemplate(tpl.subject, samplePayload);
    const bodyHtml = renderTemplate(tpl.bodyHtml, samplePayload);

    return sendEmail({
        alertType,
        templateId: tpl.id,
        toEmail,
        subject: `[TEST] ${subject}`,
        bodyHtml,
        metadata: { test: true },
    });
}
