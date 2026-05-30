import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { hashPassword } from '../../utils/password.js';

const SAFE_FIELDS = {
    id: true,
    email: true,
    name: true,
    role: true,
    status: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
};

export async function listStaff({ search, role, status, page, limit }) {
    const where = {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                  ],
              }
            : {}),
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.staff.findMany({
            where,
            select: SAFE_FIELDS,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.staff.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getStaff(id) {
    const staff = await prisma.staff.findUnique({ where: { id }, select: SAFE_FIELDS });
    if (!staff) throw ApiError.notFound('Staff not found');
    return staff;
}

export async function updateStaff(id, payload, actor) {
    if (actor.role !== 'ADMIN' && actor.id !== id) {
        throw ApiError.forbidden('Only admins can edit other staff accounts');
    }
    if (actor.role !== 'ADMIN' && (payload.role || payload.status)) {
        throw ApiError.forbidden('Only admins can change role or status');
    }

    const data = { ...payload };
    if (payload.password) data.password = await hashPassword(payload.password);

    return prisma.staff.update({ where: { id }, data, select: SAFE_FIELDS });
}

export async function deleteStaff(id, actor) {
    if (actor.id === id) throw ApiError.badRequest('You cannot delete your own account');
    await prisma.staff.delete({ where: { id } });
}
