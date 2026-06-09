function asArray(value) {
    if (value === undefined || value === null || value === '') return [];
    return Array.isArray(value) ? value : [value];
}

function asString(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return '';
    return String(value).trim();
}

function asNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function parseMoney(value) {
    if (value === undefined || value === null) return null;
    const cleaned = String(value).replace(/[^0-9.\-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) && num >= 0 ? num : null;
}

function pickCurrency(...candidates) {
    for (const candidate of candidates) {
        const code = asString(candidate);
        if (code && /^[A-Z]{3}$/i.test(code)) return code.toUpperCase();
    }
    return null;
}

function pickImageUrl(image) {
    if (!image) return null;
    if (typeof image === 'string') return image;
    return image.url_large || image.url || image.url_medium || image.url_thumbnail || null;
}

export function normalizeSearchTours(response) {
    const tours = asArray(response?.tour);
    return tours.map((tour) => ({
        tourId: asString(tour.tour_id),
        channelId: asString(tour.channel_id ?? response?.channel_id),
        name: asString(tour.tour_name),
        location: [asString(tour.start_location), asString(tour.country)]
            .filter(Boolean)
            .join(', '),
        fromPriceDisplay: asString(tour.from_price_display ?? tour.from_price),
        thumbnailUrl: pickImageUrl(tour.image) || asString(tour.thumbnail) || null,
    }));
}

function joinList(value) {
    const list = asArray(value).map(asString).filter(Boolean);
    return list.length ? list.map((item) => `• ${item}`).join('\n') : '';
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
    euro: '€',
    pound: '£',
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

// TourCMS placeholder values that should read as "not provided".
function meaningful(value) {
    const text = asString(value);
    return /^(tbc|tba|n\/?a|-+)$/i.test(text) ? '' : text;
}

// TourCMS `inc` / `ex` come as HTML <ul><li> lists — turn into bullet lines.
function htmlList(html) {
    const source = String(html || '');
    const items = [...source.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((m) => htmlText(m[1]))
        .filter(Boolean);
    if (items.length) return items.map((item) => `• ${item}`).join('\n');
    return meaningful(htmlText(source));
}

// `itinerary` items come as <li><strong>Title</strong> description</li> —
// collapse to the admin form's "Title — description" line format.
function htmlItinerary(html) {
    const source = String(html || '');
    const items = [...source.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
    const lines = items
        .map((item) => {
            const strong = item.match(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/i);
            const title = strong ? htmlText(strong[2]) : '';
            const rest = htmlText(strong ? item.replace(strong[0], ' ') : item);
            if (title && rest) return `${title} — ${rest}`;
            return title || rest;
        })
        .filter(Boolean);
    if (lines.length) return lines.join('\n');
    return meaningful(htmlText(source));
}

// cancellation_policy: {policy: {name: "24 hours before", type: "h"|"d", value: 24}}
function parseCancellationPolicy(tour) {
    const policy = tour?.cancellation_policy?.policy ?? tour?.cancellation_policy;
    if (policy && typeof policy === 'object') {
        const value = asNumber(policy.value);
        const type = String(policy.type || '').toLowerCase();
        if (value && value > 0) {
            const hours = type === 'd' ? value * 24 : value;
            const window = type === 'd'
                ? `${value} day${value === 1 ? '' : 's'}`
                : `${value} hour${value === 1 ? '' : 's'}`;
            return {
                text: `For a full refund, cancel at least ${window} before the start of the experience.`,
                hours,
            };
        }
        const name = asString(policy.name);
        if (name) return { text: name, hours: null };
    }
    const text = meaningful(tour?.cancellation_policy) || meaningful(tour?.refund_policy);
    return { text, hours: null };
}

// start_time is "HH:MM", or "MULTI" with the real times listed per departure
// type in tour_departure_structure.
function extractStartTimes(tour) {
    const times = new Set();
    const direct = asString(tour?.start_time ?? tour?.starts);
    if (/^\d{1,2}:\d{2}/.test(direct)) times.add(direct.slice(0, 5).padStart(5, '0'));
    const types = asArray(tour?.tour_departure_structure?.departure_types?.type);
    for (const type of types) {
        if (type?.active !== undefined && !Number(type.active)) continue;
        for (const field of asArray(type?.fields?.field)) {
            if (asString(field?.name) !== 'start_time') continue;
            const value = asString(field?.value);
            if (/^\d{1,2}:\d{2}$/.test(value)) times.add(value.padStart(5, '0'));
        }
    }
    return [...times].sort();
}

const AGECAT_TO_TIER = { a: 'ADULT', c: 'CHILD', i: 'INFANT', s: 'SENIOR' };

// new_booking.people_selection.rate[] carries per-tier from-prices —
// far richer than the single tour-level from_price.
function extractPriceTiers(tour) {
    const rates = asArray(tour?.new_booking?.people_selection?.rate);
    const seen = new Map();
    for (const rate of rates) {
        const tier = AGECAT_TO_TIER[String(rate?.agecat || '').toLowerCase()];
        if (!tier || seen.has(tier)) continue;
        const grossPrice = parseMoney(rate?.from_price);
        if (grossPrice === null) continue;
        seen.set(tier, { tier, grossPrice });
    }
    if (seen.size) return [...seen.values()];
    const fromPriceValue =
        parseMoney(tour?.from_price) ??
        parseMoney(tour?.from_price_display) ??
        parseMoney(tour?.adult_rate);
    return fromPriceValue !== null ? [{ tier: 'ADULT', grossPrice: fromPriceValue }] : [];
}

export function normalizeShowTour(response) {
    const tour = response?.tour ?? response;
    if (!tour || typeof tour !== 'object') return null;

    const images = asArray(tour.images?.image)
        .map((image) => pickImageUrl(image))
        .filter(Boolean);

    const thumbnail =
        pickImageUrl(tour.images?.image?.[0] ?? tour.images?.image) ||
        pickImageUrl(tour.image) ||
        images[0] ||
        '';

    // TourCMS content lives in shortdesc / longdesc / summary / itinerary /
    // inc / ex — sandbox placeholders ("TBC") are filtered by meaningful().
    const description =
        meaningful(tour.longdesc) ||
        meaningful(tour.shortdesc) ||
        meaningful(tour.description) ||
        meaningful(tour.summary) ||
        meaningful(tour.short_description);

    const summary = meaningful(tour.summary);
    const highlights =
        summary && summary !== description ? `• ${summary}` : '';

    const itinerary = htmlItinerary(tour.itinerary);

    const inclusions =
        htmlList(tour.inc) ||
        htmlList(tour.includes) ||
        htmlList(tour.inclusions) ||
        joinList(tour.inclusions_list?.item);

    const exclusions =
        htmlList(tour.ex) ||
        htmlList(tour.excludes) ||
        htmlList(tour.exclusions) ||
        joinList(tour.exclusions_list?.item);

    const startTimes = extractStartTimes(tour);
    const startTime = startTimes[0] || '';

    const minPax = asNumber(tour.min_booking_size ?? tour.min_quantity ?? tour.minimum_pax) ?? 1;
    const maxPaxRaw = asNumber(tour.max_booking_size ?? tour.max_quantity ?? tour.maximum_pax);
    const maxPax = maxPaxRaw && maxPaxRaw > 0 ? maxPaxRaw : 99;

    const bookingWindow =
        asString(tour.book_in_advance) ||
        asString(tour.advance_booking) ||
        asString(tour.cut_off_advance) ||
        '';

    const { text: cancellationPolicy, hours: freeCancellationHours } =
        parseCancellationPolicy(tour);

    const pickupInfo = meaningful(tour.pick);
    const importantNotes = [
        meaningful(tour.essential) ||
            meaningful(tour.important_information) ||
            meaningful(tour.special_instructions),
        meaningful(tour.restrictions),
        pickupInfo ? `Pickup: ${pickupInfo}` : '',
    ]
        .filter(Boolean)
        .join('\n');

    const meetingPoint =
        meaningful(tour.meeting_point) ||
        meaningful(tour.geocode_start_point?.label) ||
        meaningful(tour.start_location) ||
        meaningful(tour.location) ||
        '';

    const endingPoint =
        meaningful(tour.ending_point) ||
        meaningful(tour.geocode_end_point?.label) ||
        meaningful(tour.end_location) ||
        meaningful(tour.finish_location) ||
        meetingPoint;

    const currency = pickCurrency(
        tour.sale_currency,
        tour.currency,
        tour.currency_code,
        tour.from_price_currency,
        response?.currency
    );
    const priceTiers = extractPriceTiers(tour);

    return {
        apiType: 'TOURCMS',
        apiId: asString(tour.tour_id),
        channelId: asString(tour.channel_id),
        productId: asString(tour.tour_code) || `TCMS-${asString(tour.channel_id) || ''}-${asString(tour.tour_id)}`,
        name: asString(tour.tour_name),
        supplierName: asString(tour.supplier_name) || asString(tour.account_name),
        description,
        highlights,
        itinerary,
        inclusions,
        exclusions,
        cancellationPolicy,
        freeCancellationHours,
        importantNotes,
        voucherUsage: asString(tour.voucher_usage) || asString(tour.redemption) || '',
        meetingPoint,
        endingPoint,
        duration: meaningful(tour.duration_desc) || asString(tour.duration) || asString(tour.length),
        startTime,
        startTimes,
        bookingWindow,
        minPax,
        maxPax,
        instantConfirmation: asString(tour.instant_confirm).toLowerCase() === 'yes' ||
            asString(tour.instant_confirm) === '1',
        thumbnail,
        images,
        sourceImages: images,
        sourceThumbnail: thumbnail,
        rawTourCode: asString(tour.tour_code),
        currency,
        priceTiers,
    };
}
