import { prisma } from '../../config/db.js';
import { success } from '../../utils/api-response.js';
import * as alertService from './alert.service.js';

export async function listSettings(_req, res) {
    return success(res, await alertService.listSettings());
}

export async function updateSetting(req, res) {
    const updated = await alertService.updateSetting(req.params.alertType, req.body);
    return success(res, updated, { message: 'Alert setting updated' });
}

export async function sendTest(req, res) {
    const log = await alertService.sendTest(req.body.alertType, req.body.toEmail);
    return success(res, log, { message: 'Test email queued' });
}

export async function listLogs(req, res) {
    const { alertType, status, search, page, limit } = req.query;
    const where = {
        ...(alertType ? { alertType } : {}),
        ...(status ? { status } : {}),
        ...(search
            ? {
                  OR: [
                      { toEmail: { contains: search, mode: 'insensitive' } },
                      { subject: { contains: search, mode: 'insensitive' } },
                  ],
              }
            : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.emailLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                alertType: true,
                toEmail: true,
                toName: true,
                subject: true,
                status: true,
                errorMessage: true,
                providerMessageId: true,
                sentAt: true,
                createdAt: true,
            },
        }),
        prisma.emailLog.count({ where }),
    ]);
    return success(res, items, {
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
}

export async function getLog(req, res) {
    const id = Number(req.params.id);
    const log = await prisma.emailLog.findUnique({ where: { id } });
    return success(res, log);
}
