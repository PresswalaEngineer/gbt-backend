import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';

const RELATIONS = {
    country: { select: { id: true, name: true, code: true, currency: true } },
    _count: { select: { bookings: true } },
};

function shape(row) {
    if (!row) return row;
    const { _count, ...rest } = row;
    return { ...rest, bookingsCount: _count?.bookings ?? 0 };
}

export async function listCustomers({ search, status, countryId, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(countryId ? { countryId } : {}),
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                      { phone: { contains: search, mode: 'insensitive' } },
                  ],
              }
            : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.customer.findMany({ where, include: RELATIONS, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.customer.count({ where }),
    ]);
    return { items: items.map(shape), page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getCustomer(id) {
    const row = await prisma.customer.findUnique({ where: { id }, include: RELATIONS });
    if (!row) throw ApiError.notFound('Customer not found');
    return shape(row);
}

export async function createCustomer(payload) {
    const row = await prisma.customer.create({ data: payload, include: RELATIONS });
    return shape(row);
}

export async function updateCustomer(id, payload) {
    const row = await prisma.customer.update({ where: { id }, data: payload, include: RELATIONS });
    return shape(row);
}

export async function deleteCustomer(id) {
    await prisma.customer.delete({ where: { id } });
}
