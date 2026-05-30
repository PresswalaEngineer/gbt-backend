import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { emitAlert } from '../alert/alert.service.js';

const RELATIONS = {
    country: { select: { id: true, name: true, code: true, currency: true } },
    _count: { select: { bookings: true } },
};

function shape(row) {
    if (!row) return row;
    const { _count, ...rest } = row;
    return { ...rest, bookingsCount: _count?.bookings ?? 0 };
}

export async function listAgents({ search, status, agentStatus, countryId, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(agentStatus ? { agentStatus } : {}),
        ...(countryId ? { countryId } : {}),
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                      { companyName: { contains: search, mode: 'insensitive' } },
                  ],
              }
            : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.agent.findMany({ where, include: RELATIONS, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.agent.count({ where }),
    ]);
    return { items: items.map(shape), page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getAgent(id) {
    const row = await prisma.agent.findUnique({ where: { id }, include: RELATIONS });
    if (!row) throw ApiError.notFound('Agent not found');
    return shape(row);
}

export async function createAgent(payload) {
    const row = await prisma.agent.create({ data: payload, include: RELATIONS });
    emitAlert('NEW_AGENT_SIGNUP', {
        agentId: row.id,
        name: row.name,
        email: row.email,
        companyName: row.companyName,
    }).catch(() => {});
    return shape(row);
}

export async function updateAgent(id, payload) {
    const row = await prisma.agent.update({ where: { id }, data: payload, include: RELATIONS });
    return shape(row);
}

export async function deleteAgent(id) {
    await prisma.agent.delete({ where: { id } });
}
