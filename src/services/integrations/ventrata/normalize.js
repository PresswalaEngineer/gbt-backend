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

// Multiday products price per occupancy — map unit names/types onto the
// multiday tier vocabulary.
function pickMultidayUnitTier(unit) {
    const label = `${String(unit?.internalName || '')} ${String(unit?.reference || '')}`;
    const type = String(unit?.type || '').toUpperCase();
    if (type === 'CHILD' || type === 'YOUTH' || type === 'STUDENT' || /child/i.test(label)) {
        return /without\s*bed|no\s*bed/i.test(label) ? 'CHILD_WITHOUT_BED' : 'CHILD_WITH_BED';
    }
    if (type === 'INFANT') return 'CHILD_WITHOUT_BED';
    if (/triple|3\s*pax/i.test(label)) return 'PAX_3';
    if (/double|twin|2\s*pax/i.test(label)) return 'PAX_2';
    if (/single|1\s*pax|solo/i.test(label)) return 'PAX_1';
    if (type === 'ADULT' || type === 'SENIOR') return 'PAX_1';
    return null;
}

// Single vs multiday from the option duration (e.g. "12 hours" vs 3 days).
export function detectTourType(product) {
    const option = Array.isArray(product?.options) ? product.options[0] : null;
    const amount = asNumber(option?.durationAmount);
    const unit = String(option?.durationUnit || '').toLowerCase();
    if (unit.startsWith('day') && amount && amount > 1) {
        return { tourType: 'MULTI_DAY', durationDays: Math.round(amount) };
    }
    const labelMatch = String(option?.duration || product?.duration || '').match(/(\d+)\s*-?\s*day/i);
    if (labelMatch && Number(labelMatch[1]) > 1) {
        return { tourType: 'MULTI_DAY', durationDays: Number(labelMatch[1]) };
    }
    return { tourType: 'SINGLE_DAY', durationDays: null };
}

// Each pricingFrom is an array with one entry per available currency. Pick the
// entry matching the product currency — NOT [0], which is whatever currency the
// vendor listed first (usually USD) and would put USD numbers on a GBP tour.
function pickPricingEntry(pricingFrom, currency) {
    const list = Array.isArray(pricingFrom) ? pricingFrom : [];
    if (!list.length) return null;
    const cur = String(currency || '').toUpperCase();
    return list.find((e) => String(e?.currency || '').toUpperCase() === cur) || list[0];
}

export function extractPriceTiers(product, tourType, currency) {
    const multiday = tourType === 'MULTI_DAY';
    const options = Array.isArray(product?.options) ? product.options : [];
    const seen = new Map();
    for (const option of options) {
        const units = Array.isArray(option?.units) ? option.units : [];
        for (const unit of units) {
            const tier = multiday ? pickMultidayUnitTier(unit) : pickUnitTier(unit);
            if (!tier || seen.has(tier)) continue;
            const entry =
                pickPricingEntry(unit.pricingFrom, currency) ||
                pickPricingEntry(option.pricingFrom, currency);
            if (!entry) continue;
            // OCTO pricing: retail = customer-facing gross, net = supplier nett,
            // original = the slashed/"was" price (only when it exceeds gross).
            const grossPrice = octoMoneyToMajor(entry.retail) ?? octoMoneyToMajor(entry.original);
            if (grossPrice === null) continue;
            const nettPrice = octoMoneyToMajor(entry.net);
            const originalRaw = octoMoneyToMajor(entry.original);
            const originalPrice = originalRaw != null && originalRaw > grossPrice ? originalRaw : null;
            seen.set(tier, { tier, grossPrice, nettPrice, originalPrice });
        }
    }
    return Array.from(seen.values());
}

// When the vendor gives both gross (retail) and nett, the tour is commissionable
// — surface the mode + commission % so the admin form prefills coherently.
export function derivePricingMeta(tiers) {
    const ref = (tiers || []).find(
        (t) => t.nettPrice != null && t.grossPrice > 0 && t.nettPrice < t.grossPrice
    );
    if (!ref) return { pricingMode: null, commissionPercent: null };
    const commission = ((ref.grossPrice - ref.nettPrice) / ref.grossPrice) * 100;
    return { pricingMode: 'COMMISSIONABLE', commissionPercent: Math.round(commission * 100) / 100 };
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

const HTML_ENTITIES = {
    amp: '&',
    nbsp: ' ',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    rsquo: '’',
    lsquo: '‘',
    ldquo: '“',
    rdquo: '”',
    ndash: '–',
    mdash: '—',
};

function decodeEntities(text) {
    return String(text).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, entity) => {
        if (HTML_ENTITIES[entity] !== undefined) return HTML_ENTITIES[entity];
        if (entity.startsWith('#')) {
            const code = entity[1] === 'x' || entity[1] === 'X'
                ? parseInt(entity.slice(2), 16)
                : Number(entity.slice(1));
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return match;
    });
}

function htmlText(html) {
    return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

// Ventrata's product `description` is rich HTML carrying the portal's
// "Departure & Return", "What to Expect", "Additional Info" and
// "Cancellation Policy" sections (headings come as <h1-4> or <button> labels).
// Split on those markers so each section can land in its own tour field.
function splitDescriptionSections(html) {
    const source = String(html || '');
    const headingRe = /<(h[1-4]|button)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    const sections = [];
    let current = { title: '', start: 0 };
    let match;
    while ((match = headingRe.exec(source))) {
        sections.push({ title: current.title, html: source.slice(current.start, match.index) });
        current = { title: htmlText(match[2]), start: match.index + match[0].length };
    }
    sections.push({ title: current.title, html: source.slice(current.start) });
    return sections.filter((section) => section.title || htmlText(section.html));
}

function listItems(html) {
    return [...String(html || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((m) => htmlText(m[1]))
        .filter(Boolean);
}

function paragraphTexts(html) {
    return [...String(html || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((m) => htmlText(m[1]))
        .filter(Boolean);
}

function to24Hour(text) {
    const m = String(text).match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i);
    if (!m) return '';
    let hours = Number(m[1]);
    const meridiem = (m[3] || '').toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (hours > 23) return '';
    return `${String(hours).padStart(2, '0')}:${m[2]}`;
}

// "What to Expect" is a sequence of "Pass By:/Stop At: <place>" markers each
// followed by a narrative paragraph — collapse each pair into one itinerary
// line in the admin form's "Title — description" format.
function extractItinerary(sectionHtml) {
    const lines = [];
    let pendingTitle = null;
    for (const para of paragraphTexts(sectionHtml)) {
        const marker = para.match(/^(Pass By|Stop At)\s*:?\s*(.+)$/i);
        if (marker) {
            if (pendingTitle) lines.push(pendingTitle);
            pendingTitle = `${marker[1]}: ${marker[2].trim()}`;
        } else if (pendingTitle) {
            lines.push(`${pendingTitle} — ${para}`);
            pendingTitle = null;
        }
    }
    if (pendingTitle) lines.push(pendingTitle);
    return lines.join('\n');
}

function extractStartTimes(product) {
    const times = new Set();
    const options = Array.isArray(product?.options) ? product.options : [];
    for (const option of options) {
        const list = Array.isArray(option?.availabilityLocalStartTimes)
            ? option.availabilityLocalStartTimes
            : [];
        for (const time of list) {
            const normalized = String(time).slice(0, 5);
            if (/^\d{2}:\d{2}$/.test(normalized)) times.add(normalized);
        }
    }
    return [...times].sort();
}

function freeCancellationHoursFrom(policyText, option) {
    const text = String(policyText || '');
    const hourMatch = text.match(/at least\s+(\d+)\s*hours?/i);
    if (hourMatch) return Number(hourMatch[1]);
    const dayMatch = text.match(/at least\s+(\d+)\s*days?/i);
    if (dayMatch) return Number(dayMatch[1]) * 24;
    const amount = asNumber(option?.cancellationCutoffAmount);
    if (amount && amount > 0) {
        const unit = String(option?.cancellationCutoffUnit || 'hour').toLowerCase();
        return unit.startsWith('day') ? amount * 24 : amount;
    }
    return null;
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

    const firstOption = Array.isArray(product.options) ? product.options[0] : null;

    // Break the rich description HTML into the portal's labelled sections.
    const sections = splitDescriptionSections(product.description);
    const findSection = (re) => sections.find((s) => re.test(s.title));
    const departureSection = findSection(/departure/i);
    const expectSection = findSection(/what to expect/i);
    const additionalSection = findSection(/additional info/i);
    const cancellationSection = findSection(/cancellation/i);
    const introSection = sections.find((s) => !s.title && htmlText(s.html));

    const description =
        asString(product.shortDescription) ||
        (introSection ? htmlText(introSection.html) : '') ||
        htmlText(product.description);

    const inclusions =
        joinList(product.inclusions) || joinList(product.included);
    const exclusions =
        joinList(product.exclusions) || joinList(product.excluded);

    const itinerary = expectSection ? extractItinerary(expectSection.html) : '';

    // Highlights: a dedicated field when populated, otherwise Ventrata mirrors
    // marketplace highlights as FAQ entries with empty answers.
    const faqs = Array.isArray(product.faqs) ? product.faqs : [];
    const highlights =
        joinList(product.highlights) ||
        joinList(faqs.filter((f) => !asString(f?.answer)).map((f) => asString(f?.question)));

    const cancellationPolicy =
        asString(product.cancellationPolicy) ||
        (cancellationSection ? paragraphTexts(cancellationSection.html).join('\n') : '') ||
        '';
    const freeCancellationHours = freeCancellationHoursFrom(cancellationPolicy, firstOption);

    const additionalInfo = additionalSection
        ? joinList(listItems(additionalSection.html))
        : '';
    const importantNotes =
        asString(product.importantInformation) ||
        asString(product.requirements) ||
        additionalInfo;

    const voucherUsage =
        asString(product.redemptionInstructions) ||
        asString(product.deliveryInstructions) ||
        asString(product.usageInstructions) ||
        '';

    // Departure & Return bullets: address, departure time, return note.
    const departureBullets = departureSection ? listItems(departureSection.html) : [];
    const departureAddress = departureBullets.find((b) => !to24Hour(b) && !/return/i.test(b)) || '';
    const departureTime = to24Hour(departureBullets.find((b) => to24Hour(b)) || '');
    const returnNote = departureBullets.find((b) => /return/i.test(b)) || '';

    const meetingPointRaw =
        asString(firstOption?.meetingPoint) ||
        departureAddress ||
        asString(product.meetingPoint) ||
        asString(product.startLocation) ||
        asString(product.address) ||
        asString(product.location) ||
        '';
    const endingPointRaw =
        asString(product.endingPoint) ||
        asString(product.endLocation) ||
        returnNote ||
        meetingPointRaw;

    // Hotel pickup points become selectable meeting points when offered.
    const pickupPoints = Array.isArray(firstOption?.pickupPoints) ? firstOption.pickupPoints : [];
    const meetingPoints = firstOption?.pickupAvailable
        ? pickupPoints
              .map((point) => {
                  const name = asString(point?.name);
                  const address = asString(point?.address);
                  if (!name) return '';
                  return address && address !== name ? `${name} — ${address}` : name;
              })
              .filter(Boolean)
              .slice(0, 50)
        : [];

    const startTimes = extractStartTimes(product);
    const startTime = startTimes[0] || departureTime || '';

    const duration =
        asString(product.duration) ||
        asString(product.durationLabel) ||
        asString(firstOption?.duration);

    const { tourType, durationDays } = detectTourType(product);

    const currency = pickProductCurrency(product);
    const priceTiers = extractPriceTiers(product, tourType, currency);
    const { pricingMode, commissionPercent } = derivePricingMeta(priceTiers);
    const timeZone = asString(product.timeZone) || null;

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
        highlights,
        itinerary,
        inclusions,
        exclusions,
        cancellationPolicy,
        freeCancellationHours,
        importantNotes,
        voucherUsage,
        meetingPoint: meetingPointRaw,
        meetingPoints,
        endingPoint: endingPointRaw,
        duration,
        tourType,
        durationDays,
        timeZone,
        startTime,
        startTimes,
        bookingWindow: asString(product.bookingCutoff) || '',
        minPax,
        maxPax,
        instantConfirmation: Boolean(product.instantConfirmation),
        thumbnail: sourceThumbnail,
        images: sourceImages,
        sourceImages,
        sourceThumbnail,
        options,
        currency,
        pricingMode,
        commissionPercent,
        priceTiers,
    };
}
