import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { extractPlaceholders } from '../../services/email/render.js';
import { ensureAllAlertDefaults } from '../alert/alert.service.js';

export async function listTemplates({ isActive, page, limit }) {
    await ensureAllAlertDefaults();
    const where = {
        ...(isActive !== undefined ? { isActive } : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.emailTemplate.findMany({ where, orderBy: { alertType: 'asc' }, skip, take: limit }),
        prisma.emailTemplate.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getTemplate(id) {
    const tpl = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!tpl) throw ApiError.notFound('Email template not found');
    return tpl;
}

export async function updateTemplate(id, payload) {
    const data = { ...payload };
    if (data.subject || data.bodyHtml) {
        const existing = await prisma.emailTemplate.findUnique({ where: { id } });
        if (!existing) throw ApiError.notFound('Email template not found');
        data.placeholders = extractPlaceholders(
            data.subject ?? existing.subject,
            data.bodyHtml ?? existing.bodyHtml
        );
    }
    return prisma.emailTemplate.update({ where: { id }, data });
}
