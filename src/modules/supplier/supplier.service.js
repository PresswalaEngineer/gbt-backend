import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { emitAlert } from '../alert/alert.service.js';

const RELATIONS = {
    country: { select: { id: true, name: true, code: true, currency: true } },
    cities: { select: { id: true, name: true, countryId: true }, orderBy: { name: 'asc' } },
    contracts: { orderBy: { createdAt: 'desc' } },
    _count: { select: { tours: true, contracts: true } },
};

function shapeSupplier(row) {
    if (!row) return row;
    const { _count, apiKey, ...rest } = row;
    return {
        ...rest,
        apiKey: apiKey ? decrypt(apiKey) : null,
        toursCount: _count?.tours ?? 0,
        contractsCount: _count?.contracts ?? 0,
    };
}

async function ensureCountryExists(countryId) {
    if (countryId === undefined || countryId === null) return;
    const country = await prisma.country.findUnique({ where: { id: countryId } });
    if (!country) throw ApiError.badRequest('Country does not exist');
}

async function ensureCitiesValid(countryId, cityIds) {
    if (!Array.isArray(cityIds) || !cityIds.length) return;
    const cities = await prisma.city.findMany({
        where: { id: { in: cityIds } },
        select: { id: true, countryId: true, name: true },
    });
    if (cities.length !== cityIds.length) {
        const missing = cityIds.filter((id) => !cities.find((c) => c.id === id));
        throw ApiError.badRequest(`Unknown city ids: ${missing.join(', ')}`);
    }
    if (countryId) {
        const wrong = cities.filter((c) => c.countryId !== countryId);
        if (wrong.length) {
            throw ApiError.badRequest(
                `Cities not in selected country: ${wrong.map((c) => c.name).join(', ')}`
            );
        }
    }
}

function splitCitiesAndApiKey(payload) {
    const { cityIds, apiKey, ...rest } = payload;
    return { fields: rest, cityIds, apiKey };
}

export async function listSuppliers({ search, countryId, cityId, status, hasApi, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(countryId ? { countryId } : {}),
        ...(hasApi !== undefined ? { hasApi } : {}),
        ...(cityId ? { cities: { some: { id: cityId } } } : {}),
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { bookingEmail: { contains: search, mode: 'insensitive' } },
                      { phone: { contains: search, mode: 'insensitive' } },
                      { country: { name: { contains: search, mode: 'insensitive' } } },
                  ],
              }
            : {}),
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.supplier.findMany({
            where,
            include: RELATIONS,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.supplier.count({ where }),
    ]);

    return {
        items: items.map(shapeSupplier),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getSupplier(id) {
    const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: RELATIONS,
    });
    if (!supplier) throw ApiError.notFound('Supplier not found');
    return shapeSupplier(supplier);
}

export async function createSupplier(payload) {
    const { fields, cityIds, apiKey } = splitCitiesAndApiKey(payload);
    await ensureCountryExists(fields.countryId);
    await ensureCitiesValid(fields.countryId, cityIds);

    const supplier = await prisma.supplier.create({
        data: {
            ...fields,
            apiKey: apiKey ? encrypt(apiKey) : null,
            cities: cityIds?.length ? { connect: cityIds.map((id) => ({ id })) } : undefined,
        },
        include: RELATIONS,
    });
    emitAlert('NEW_SUPPLIER_CREATED', {
        name: supplier.name,
        country: supplier.country?.name ?? '',
        bookingEmail: supplier.bookingEmail,
    }).catch(() => {});
    return shapeSupplier(supplier);
}

export async function updateSupplier(id, payload) {
    const { fields, cityIds, apiKey } = splitCitiesAndApiKey(payload);

    const existing = await prisma.supplier.findUnique({
        where: { id },
        select: { countryId: true },
    });
    if (!existing) throw ApiError.notFound('Supplier not found');

    const effectiveCountryId = fields.countryId ?? existing.countryId;
    if (fields.countryId) await ensureCountryExists(fields.countryId);
    if (Array.isArray(cityIds)) await ensureCitiesValid(effectiveCountryId, cityIds);

    const data = { ...fields };
    if (apiKey !== undefined) {
        data.apiKey = apiKey ? encrypt(apiKey) : null;
    }
    if (Array.isArray(cityIds)) {
        data.cities = { set: cityIds.map((cityId) => ({ id: cityId })) };
    }

    const supplier = await prisma.supplier.update({
        where: { id },
        data,
        include: RELATIONS,
    });
    return shapeSupplier(supplier);
}

export async function deleteSupplier(id) {
    const tourCount = await prisma.tour.count({ where: { supplierId: id } });
    if (tourCount > 0) {
        throw ApiError.conflict(
            `Cannot delete supplier — ${tourCount} tour(s) reference it. Reassign or remove those tours first.`,
            { code: 'SUPPLIER_HAS_TOURS' }
        );
    }
    await prisma.supplier.delete({ where: { id } });
}

export async function addContract(supplierId, payload) {
    const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true },
    });
    if (!supplier) throw ApiError.notFound('Supplier not found');

    return prisma.supplierContract.create({
        data: {
            ...payload,
            validFrom: payload.validFrom ? new Date(payload.validFrom) : null,
            validTo: payload.validTo ? new Date(payload.validTo) : null,
            supplierId,
        },
    });
}

export async function removeContract(supplierId, contractId) {
    const contract = await prisma.supplierContract.findUnique({
        where: { id: contractId },
        select: { id: true, supplierId: true },
    });
    if (!contract || contract.supplierId !== supplierId) {
        throw ApiError.notFound('Contract not found for this supplier');
    }
    await prisma.supplierContract.delete({ where: { id: contractId } });
}
