import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';

const ORDER = [{ orderIndex: 'asc' }, { id: 'asc' }];

export async function listFaqs({ search, page, limit }) {
    const where = search
        ? {
              OR: [
                  { question: { contains: search, mode: 'insensitive' } },
                  { answer: { contains: search, mode: 'insensitive' } },
              ],
          }
        : {};

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.faq.findMany({ where, orderBy: ORDER, skip, take: limit }),
        prisma.faq.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getFaq(id) {
    const faq = await prisma.faq.findUnique({ where: { id } });
    if (!faq) throw ApiError.notFound('FAQ not found');
    return faq;
}

async function nextOrderIndex() {
    const top = await prisma.faq.findFirst({ orderBy: { orderIndex: 'desc' }, select: { orderIndex: true } });
    return (top?.orderIndex ?? -1) + 1;
}

export async function createFaq(payload) {
    const orderIndex = payload.orderIndex ?? (await nextOrderIndex());
    return prisma.faq.create({ data: { ...payload, orderIndex } });
}

export async function replaceFaqs(faqs) {
    return prisma.$transaction(async (tx) => {
        await tx.faq.deleteMany({});
        await tx.faq.createMany({
            data: faqs.map((f, i) => ({ question: f.question, answer: f.answer, orderIndex: i })),
        });
        return tx.faq.findMany({ orderBy: ORDER });
    });
}

export async function updateFaq(id, payload) {
    await getFaq(id);
    return prisma.faq.update({ where: { id }, data: payload });
}

export async function deleteFaq(id) {
    await getFaq(id);
    await prisma.faq.delete({ where: { id } });
}
