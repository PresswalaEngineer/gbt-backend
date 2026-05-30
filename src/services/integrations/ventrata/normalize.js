function asString(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return '';
    return String(value).trim();
}

function asNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

export function octoMoneyToMajor(value) {
    if (value === undefined || value === null) return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num) / 100;
}

const UNIT_TYPE_TO_TIER = {
    ADULT: 'ADULT',
    CHILD: 'CHILD',
    INFANT: 'INFANT',
    SENIOR: 'SENIOR',
    FAMILY: 'FAMILY',
    YOUTH: 'CHILD',
    STUDENT: 'CHILD',
};

function pickUnitTier(unit) {
    const type = String(unit?.type || '').toUpperCase();
    if (UNIT_TYPE_TO_TIER[type]) return UNIT_TYPE_TO_TIER[type];
    const id = String(unit?.id || '').toUpperCase();
    for (const [key, tier] of Object.entries(UNIT_TYPE_TO_TIER)) {
        if (id.includes(key)) return tier;
    }
    return null;
}

export function extractPriceTiers(product) {
    const options = Array.isArray(product?.options) ? product.options : [];
    const seen = new Map();
    for (const option of options) {
        const units = Array.isArray(option?.units) ? option.units : [];
        for (const unit of units) {
            const tier = pickUnitTier(unit);
            if (!tier || seen.has(tier)) continue;
            const fromBase = unit.pricingFrom?.[0]?.original ?? unit.pricingFrom?.[0]?.retail;
            const fromOption = option.pricingFrom?.[0]?.original ?? option.pricingFrom?.[0]?.retail;
            const grossMinor = fromBase ?? fromOption;
            const grossPrice = octoMoneyToMajor(grossMinor);
            if (grossPrice === null) continue;
            seen.set(tier, { tier, grossPrice });
        }
    }
    return Array.from(seen.values());
}

export function pickProductCurrency(product) {
    const candidates = [
        product?.defaultCurrency,
        product?.availableCurrencies?.[0],
        product?.options?.[0]?.units?.[0]?.pricingFrom?.[0]?.currency,
        product?.options?.[0]?.pricingFrom?.[0]?.currency,
    ];
    for (const candidate of candidates) {
        const code = String(candidate || '').toUpperCase();
        if (/^[A-Z]{3}$/.test(code)) return code;
    }
    return null;
}

function pickUrl(image) {
    if (!image) return null;
    if (typeof image === 'string') return image;
    return (
        image.url ||
        image.original ||
        image.large ||
        image.medium ||
        image.small ||
        image.thumbnail ||
        null
    );
}

function asUrlList(value) {
    if (!value) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.map(pickUrl).filter(Boolean);
}

function joinList(value) {
    if (!value) return '';
    const list = Array.isArray(value) ? value : [value];
    return list.map(asString).filter(Boolean).map((item) => `• ${item}`).join('\n');
}

export function normalizeProductsList(products = []) {
    const list = Array.isArray(products) ? products : [];
    return list.map((product) => ({
        productId: asString(product.id),
        reference: asString(product.reference),
        internalName: asString(product.internalName),
        name: asString(product.title) || asString(product.internalName),
        location: asString(product.location) || asString(product.timeZone),
        thumbnailUrl: pickUrl(product.coverImageUrl) || pickUrl(product.bannerImageUrl) || null,
        instantConfirmation: Boolean(product.instantConfirmation),
    }));
}

function normalizeOptions(options = []) {
    const list = Array.isArray(options) ? options : [];
    return list.map((option) => ({
        name: asString(option.title) || asString(option.internalName) || asString(option.reference) || asString(option.id),
        code: asString(option.reference) || '',
        externalId: asString(option.id),
    }));
}

export function normalizeShowProduct(product) {
    if (!product || typeof product !== 'object') return null;

    const sourceImages = asUrlList(product.galleryImages);
    const sourceThumbnail =
        pickUrl(product.coverImageUrl) ||
        pickUrl(product.bannerImageUrl) ||
        sourceImages[0] ||
        '';

    const description =
        asString(product.description) || asString(product.shortDescription);

    const inclusions =
        asString(product.inclusions) || joinList(product.included);
    const exclusions =
        asString(product.exclusions) || joinList(product.excluded);

    const cancellationPolicy =
        asString(product.cancellationPolicy) ||
        asString(product.cancellationCutoff) ||
        '';

    const importantNotes =
        asString(product.importantInformation) ||
        asString(product.requirements) ||
        '';

    const voucherUsage =
        asString(product.redemptionInstructions) ||
        asString(product.deliveryInstructions) ||
        '';

    const meetingPointRaw =
        asString(product.meetingPoint) ||
        asString(product.startLocation) ||
        asString(product.location) ||
        '';
    const endingPointRaw =
        asString(product.endingPoint) ||
        asString(product.endLocation) ||
        meetingPointRaw;

    const duration = asString(product.duration) || asString(product.durationLabel);

    const options = normalizeOptions(product.options);

    const minPaxRaw = asNumber(
        product.minUnits ?? product.minQuantity ?? product.options?.[0]?.restrictions?.minUnits
    );
    const maxPaxRaw = asNumber(
        product.maxUnits ?? product.maxQuantity ?? product.options?.[0]?.restrictions?.maxUnits
    );
    const minPax = minPaxRaw && minPaxRaw > 0 ? minPaxRaw : 1;
    const maxPax = maxPaxRaw && maxPaxRaw > 0 ? maxPaxRaw : 99;

    const productId =
        asString(product.reference) ||
        `VTRT-${asString(product.id)}`;

    return {
        apiType: 'VENTRATA',
        apiId: asString(product.id),
        productId,
        name: asString(product.title) || asString(product.internalName),
        supplierName: asString(product.supplierName) || asString(product.vendor) || '',
        description,
        inclusions,
        exclusions,
        cancellationPolicy,
        importantNotes,
        voucherUsage,
        meetingPoint: meetingPointRaw,
        endingPoint: endingPointRaw,
        duration,
        startTime: '',
        bookingWindow: asString(product.bookingCutoff) || '',
        minPax,
        maxPax,
        instantConfirmation: Boolean(product.instantConfirmation),
        thumbnail: sourceThumbnail,
        images: sourceImages,
        sourceImages,
        sourceThumbnail,
        options,
        currency: pickProductCurrency(product),
        priceTiers: extractPriceTiers(product),
    };
}
