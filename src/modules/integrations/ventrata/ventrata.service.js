import { ventrataClient } from '../../../services/integrations/ventrata/client.js';
import {
    normalizeProductsList,
    normalizeShowProduct,
} from '../../../services/integrations/ventrata/normalize.js';
import { mirrorRemoteImage } from '../../../services/integrations/image-mirror.js';
import { logger } from '../../../utils/logger.js';
import { prisma } from '../../../config/db.js';
import { decrypt } from '../../../utils/crypto.js';
import { ApiError } from '../../../utils/api-error.js';

// Ventrata keys are per-vendor. When the admin picks a Ventrata supplier, search
// + import hit THAT vendor's catalogue using its stored (AES-encrypted) key.
// No supplierId → fall back to the global env key (single-vendor / sandbox).
async function resolveSupplierKey(supplierId) {
    if (!supplierId) return undefined;
    const supplier = await prisma.supplier.findUnique({ where: { id: Number(supplierId) } });
    if (!supplier) {
        throw ApiError.badRequest('Supplier not found', { code: 'SUPPLIER_NOT_FOUND' });
    }
    if (supplier.apiType !== 'VENTRATA' || !supplier.apiKey) {
        throw ApiError.badRequest(
            'Selected supplier has no Ventrata API key configured',
            { code: 'SUPPLIER_KEY_MISSING' }
        );
    }
    try {
        return decrypt(supplier.apiKey);
    } catch (cause) {
        logger.warn({ err: cause?.message }, 'failed to decrypt supplier Ventrata key');
        throw ApiError.badRequest('Could not read the supplier API key', {
            code: 'SUPPLIER_KEY_INVALID',
        });
    }
}

function matchesQuery(product, q) {
    if (!q) return true;
    // Split the query into individual words and require EVERY word to appear
    // somewhere in the searchable text. This makes multi-word searches work
    // regardless of word order or punctuation between them — e.g.
    // "Loch Ness Highlands Whisky" matches "Loch Ness, Highlands and Whisky
    // Distillery Day Tour" even though it isn't a contiguous substring.
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const haystack = [
        product.name,
        product.internalName,
        product.reference,
        product.productId,
        product.location,
    ]
        .filter(Boolean)
        .map((field) => String(field).toLowerCase())
        .join(' ');
    return words.every((word) => haystack.includes(word));
}

export async function ping() {
    const products = await ventrataClient.listProducts();
    const list = Array.isArray(products) ? products : [];
    return {
        ok: true,
        productCount: list.length,
        sample: normalizeProductsList(list.slice(0, 3)),
    };
}

export async function searchProducts({ q, perPage, supplierId } = {}) {
    const apiKey = await resolveSupplierKey(supplierId);
    const products = await ventrataClient.listProducts({ apiKey });
    const list = Array.isArray(products) ? products : [];
    const normalized = normalizeProductsList(list);
    const filtered = normalized.filter((product) => matchesQuery(product, q));
    const limit = Number(perPage) > 0 ? Math.min(Number(perPage), 50) : 20;
    return {
        totalCount: filtered.length,
        products: filtered.slice(0, limit),
    };
}

export async function getProduct({ productId, supplierId } = {}) {
    const apiKey = await resolveSupplierKey(supplierId);
    const product = await ventrataClient.getProduct({ productId, apiKey });
    return { product: normalizeShowProduct(product) };
}

async function mirrorAll(urls, folder) {
    const unique = Array.from(new Set(urls.filter(Boolean)));
    const results = await Promise.all(
        unique.map(async (url) => {
            try {
                const mirrored = await mirrorRemoteImage(url, { folder });
                return { source: url, publicUrl: mirrored?.publicUrl ?? null };
            } catch (cause) {
                logger.warn({ err: cause, url }, 'Ventrata image mirror failed');
                return { source: url, publicUrl: null };
            }
        })
    );
    return new Map(results.map(({ source, publicUrl }) => [source, publicUrl]));
}

export async function importProduct({ productId, supplierId } = {}) {
    const { product } = await getProduct({ productId, supplierId });
    if (!product) return { product: null };

    const folder = `ventrata`;
    const sourceUrls = [product.sourceThumbnail, ...product.sourceImages].filter(Boolean);
    const map = await mirrorAll(sourceUrls, folder);

    const mirroredImages = product.sourceImages
        .map((src) => map.get(src))
        .filter(Boolean);
    const mirroredThumbnail =
        (product.sourceThumbnail && map.get(product.sourceThumbnail)) ||
        mirroredImages[0] ||
        '';

    const { sourceImages, sourceThumbnail, ...rest } = product;
    return {
        product: {
            ...rest,
            thumbnail: mirroredThumbnail,
            images: mirroredImages,
        },
    };
}
