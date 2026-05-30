import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';

const ORDER = [{ orderIndex: 'asc' }, { id: 'asc' }];

export async function listDestCats({ search, type, page, limit }) {
    const where = {
        ...(type ? { type } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.destinationCategory.findMany({ where, orderBy: ORDER, skip, take: limit }),
        prisma.destinationCategory.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getDestCat(id) {
    const row = await prisma.destinationCategory.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('Entry not found');
    return row;
}

export async function createDestCat(payload) {
    let { orderIndex } = payload;
    if (orderIndex == null) {
        const top = await prisma.destinationCategory.findFirst({
            orderBy: { orderIndex: 'desc' },
            select: { orderIndex: true },
        });
        orderIndex = (top?.orderIndex ?? -1) + 1;
    }
    return prisma.destinationCategory.create({ data: { ...payload, orderIndex } });
}

export async function updateDestCat(id, payload) {
    await getDestCat(id);
    return prisma.destinationCategory.update({ where: { id }, data: payload });
}

export async function deleteDestCat(id) {
    await getDestCat(id);
    await prisma.destinationCategory.delete({ where: { id } });
}
