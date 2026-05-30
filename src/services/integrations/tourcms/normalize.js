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

    const description =
        asString(tour.description) ||
        asString(tour.summary) ||
        asString(tour.short_description);

    const inclusions =
        asString(tour.includes) ||
        asString(tour.inclusions) ||
        joinList(tour.inclusions_list?.item);

    const exclusions =
        asString(tour.excludes) ||
        asString(tour.exclusions) ||
        joinList(tour.exclusions_list?.item);

    const startTimeRaw = asString(tour.start_time ?? tour.starts);
    const startTime = /^\d{1,2}:\d{2}/.test(startTimeRaw) ? startTimeRaw.slice(0, 5) : '';

    const minPax = asNumber(tour.min_quantity ?? tour.minimum_pax) ?? 1;
    const maxPaxRaw = asNumber(tour.max_quantity ?? tour.maximum_pax);
    const maxPax = maxPaxRaw && maxPaxRaw > 0 ? maxPaxRaw : 99;

    const bookingWindow =
        asString(tour.book_in_advance) ||
        asString(tour.advance_booking) ||
        asString(tour.cut_off_advance) ||
        '';

    const cancellationPolicy =
        asString(tour.cancellation_policy) ||
        asString(tour.refund_policy) ||
        '';

    const meetingPoint =
        asString(tour.meeting_point) ||
        asString(tour.start_location) ||
        asString(tour.location) ||
        '';

    const endingPoint =
        asString(tour.ending_point) ||
        asString(tour.end_location) ||
        asString(tour.finish_location) ||
        meetingPoint;

    const currency = pickCurrency(
        tour.currency,
        tour.currency_code,
        tour.from_price_currency,
        response?.currency
    );
    const fromPriceValue =
        parseMoney(tour.from_price) ??
        parseMoney(tour.from_price_display) ??
        parseMoney(tour.adult_rate);
    const priceTiers = fromPriceValue !== null
        ? [{ tier: 'ADULT', grossPrice: fromPriceValue }]
        : [];

    return {
        apiType: 'TOURCMS',
        apiId: asString(tour.tour_id),
        channelId: asString(tour.channel_id),
        productId: asString(tour.tour_code) || `TCMS-${asString(tour.channel_id) || ''}-${asString(tour.tour_id)}`,
        name: asString(tour.tour_name),
        supplierName: asString(tour.supplier_name) || asString(tour.account_name),
        description,
        inclusions,
        exclusions,
        cancellationPolicy,
        importantNotes:
            asString(tour.important_information) ||
            asString(tour.special_instructions) ||
            '',
        voucherUsage: asString(tour.voucher_usage) || asString(tour.redemption) || '',
        meetingPoint,
        endingPoint,
        duration: asString(tour.duration) || asString(tour.length),
        startTime,
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
