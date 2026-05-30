#!/usr/bin/env node
import { setTimeout as sleep } from 'node:timers/promises';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:4000/api/v1';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@gbt.local';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'ChangeMe!2026';

let accessToken = null;
let cookieJar = '';
let pass = 0;
let fail = 0;
const failures = [];

const c = {
    g: (s) => `\x1b[32m${s}\x1b[0m`,
    r: (s) => `\x1b[31m${s}\x1b[0m`,
    d: (s) => `\x1b[2m${s}\x1b[0m`,
    y: (s) => `\x1b[33m${s}\x1b[0m`,
};

async function step(label, fn) {
    process.stdout.write(`  ${label} … `);
    try {
        const result = await fn();
        pass += 1;
        console.log(c.g('ok'));
        return result;
    } catch (err) {
        fail += 1;
        failures.push({ label, message: err?.message || String(err) });
        console.log(c.r('FAIL'));
        console.log(c.d(`    ${err?.message || err}`));
        return null;
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function call(method, path, { body, expect = 200, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (cookieJar) headers.Cookie = cookieJar;
    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let parsed = null;
    if (text) {
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = { raw: text.slice(0, 200) };
        }
    }
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        const refresh = setCookie.split(',').find((c) => c.includes('gbt_refresh_token'));
        if (refresh) cookieJar = refresh.split(';')[0];
    }
    if (response.status !== expect) {
        throw new Error(
            `${method} ${path} expected ${expect}, got ${response.status}: ${JSON.stringify(parsed)?.slice(0, 200)}`
        );
    }
    return parsed;
}

async function main() {
    console.log(c.d(`Hitting ${BASE_URL} as ${ADMIN_EMAIL}\n`));

    console.log(c.y('Health'));
    await step('GET /health', async () => {
        const r = await call('GET', '/health', { auth: false });
        assert(r.status === 'ok', 'status not ok');
    });

    console.log(c.y('\nAuth'));
    await step('POST /auth/login', async () => {
        const r = await call('POST', '/auth/login', {
            body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
            auth: false,
        });
        assert(r.success === true, 'envelope.success !== true');
        accessToken = r.data?.accessToken;
        assert(accessToken, 'no accessToken returned');
    });
    await step('GET /auth/me', async () => {
        const r = await call('GET', '/auth/me');
        assert(r.data?.email === ADMIN_EMAIL, 'me.email mismatch');
        assert(r.data?.role === 'ADMIN', 'me.role !== ADMIN');
    });
    await step('POST /auth/login (wrong password) → 401', async () => {
        await call('POST', '/auth/login', {
            body: { email: ADMIN_EMAIL, password: 'wrong' },
            expect: 401,
            auth: false,
        });
    });
    await step('GET /auth/me without bearer → 401', async () => {
        const tmp = accessToken;
        accessToken = null;
        try {
            await call('GET', '/auth/me', { auth: false, expect: 401 });
        } finally {
            accessToken = tmp;
        }
    });
    await step('POST /auth/refresh rotates token', async () => {
        const r = await call('POST', '/auth/refresh', { auth: false });
        assert(r.data?.accessToken, 'no rotated accessToken');
        accessToken = r.data.accessToken;
    });

    console.log(c.y('\nCountry CRUD'));
    let countryId = null;
    const rand2 = () => String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const countryCode = `Z${rand2()}`;
    await step('POST /countries', async () => {
        const r = await call('POST', '/countries', {
            body: {
                code: countryCode,
                name: `Smoketown ${countryCode}`,
                currency: 'USD',
                status: 'ACTIVE',
            },
            expect: 201,
        });
        countryId = r.data?.id;
        assert(countryId, 'no country id');
    });
    await step('GET /countries (list)', async () => {
        const r = await call('GET', '/countries?limit=5');
        assert(Array.isArray(r.data), 'list not array');
    });
    await step('GET /countries/:id', async () => {
        const r = await call('GET', `/countries/${countryId}`);
        assert(r.data?.id === countryId, 'id mismatch');
    });
    await step('PATCH /countries/:id', async () => {
        const r = await call('PATCH', `/countries/${countryId}`, {
            body: { subtitle: 'updated by smoke test' },
        });
        assert(r.data?.subtitle === 'updated by smoke test', 'subtitle not saved');
    });
    await step('POST /countries with duplicate code → 409', async () => {
        await call('POST', '/countries', {
            body: { code: countryCode, name: 'duplicate', currency: 'USD' },
            expect: 409,
        });
    });
    await step('POST /countries with bad payload → 400', async () => {
        await call('POST', '/countries', {
            body: { code: '', name: '', currency: '' },
            expect: 400,
        });
    });

    console.log(c.y('\nCity CRUD'));
    let cityId = null;
    await step('POST /cities', async () => {
        const r = await call('POST', '/cities', {
            body: {
                name: `Smokecity ${Date.now()}`,
                countryId,
                status: 'ACTIVE',
            },
            expect: 201,
        });
        cityId = r.data?.id;
        assert(cityId, 'no city id');
    });
    await step('PATCH /cities/:id', async () => {
        await call('PATCH', `/cities/${cityId}`, { body: { population: '99999' } });
    });

    console.log(c.y('\nCategory CRUD'));
    let categoryId = null;
    await step('POST /categories', async () => {
        const r = await call('POST', '/categories', {
            body: { name: `Smokecat ${Date.now()}`, status: 'ACTIVE' },
            expect: 201,
        });
        categoryId = r.data?.id;
    });

    console.log(c.y('\nAttraction CRUD'));
    let attractionId = null;
    await step('POST /attractions', async () => {
        const r = await call('POST', '/attractions', {
            body: {
                name: `Smoke Attraction ${Date.now()}`,
                cityId,
                categoryId,
                bannerHeading: 'Smoke banner',
                status: 'ACTIVE',
            },
            expect: 201,
        });
        attractionId = r.data?.id;
    });

    console.log(c.y('\nSupplier CRUD'));
    let supplierId = null;
    let contractId = null;
    await step('POST /suppliers', async () => {
        const r = await call('POST', '/suppliers', {
            body: {
                name: `Smoke Supplier ${Date.now()}`,
                countryId,
                cityIds: [cityId],
                bookingEmail: `smoke-${Date.now()}@suppliers.example`,
                phone: '+1 555 0100',
                paymentMode: 'POSTPAID',
                currency: 'USD',
                hasApi: false,
                status: 'ACTIVE',
            },
            expect: 201,
        });
        supplierId = r.data?.id;
        assert(supplierId, 'no supplier id');
        assert(r.data?.cities?.length === 1, 'cities not connected');
    });
    await step('GET /suppliers (list)', async () => {
        const r = await call('GET', '/suppliers?limit=5');
        assert(Array.isArray(r.data), 'list not array');
    });
    await step('GET /suppliers/:id', async () => {
        const r = await call('GET', `/suppliers/${supplierId}`);
        assert(r.data?.id === supplierId, 'id mismatch');
    });
    await step('PATCH /suppliers/:id', async () => {
        const r = await call('PATCH', `/suppliers/${supplierId}`, {
            body: { phone: '+1 555 0199' },
        });
        assert(r.data?.phone === '+1 555 0199', 'phone not updated');
    });
    await step('POST /suppliers rejects hasApi without apiKey → 400', async () => {
        await call('POST', '/suppliers', {
            body: {
                name: `Smoke Bad ${Date.now()}`,
                countryId,
                cityIds: [],
                bookingEmail: 'bad@x.example',
                currency: 'USD',
                hasApi: true,
                apiType: 'VENTRATA',
            },
            expect: 400,
        });
    });
    await step('POST /suppliers/:id/contracts', async () => {
        const r = await call('POST', `/suppliers/${supplierId}/contracts`, {
            body: {
                type: 'RATE_SHEET',
                label: 'Q1 2026 Rates',
                fileUrl: 'https://example.com/rates-q1-2026.pdf',
                validFrom: '2026-01-01',
                validTo: '2026-03-31',
            },
            expect: 201,
        });
        contractId = r.data?.id;
        assert(contractId, 'no contract id');
    });
    await step('DELETE /suppliers/:id/contracts/:contractId', async () => {
        await call('DELETE', `/suppliers/${supplierId}/contracts/${contractId}`, {
            expect: 204,
        });
    });

    console.log(c.y('\nTour CRUD + pricing'));
    let tourId = null;
    const tourPayloadBase = {
        name: `Smoke Tour ${Date.now()}`,
        productId: `SMK-${Date.now()}`,
        apiType: 'NONE',
        countryId,
        cityId,
        categoryId,
        attractionId,
        supplierId,
        meetingPoint: 'Smoke Station, Platform 1',
        endingPoint: 'Smoke Station, Platform 1',
        startTime: '09:00',
        bookingWindow: '24 hours',
        minPax: 1,
        maxPax: 50,
    };
    await step('POST /tours rejects manual tour without supplier → 400', async () => {
        const { supplierId: _omit, ...noSupplier } = tourPayloadBase;
        await call('POST', '/tours', {
            body: {
                ...noSupplier,
                productId: `SMK-NOSUP-${Date.now()}`,
            },
            expect: 400,
        });
    });
    await step('POST /tours (SINGLE_DAY, with pricing)', async () => {
        const r = await call('POST', '/tours', {
            body: {
                ...tourPayloadBase,
                tourType: 'SINGLE_DAY',
                pricingMode: 'NETT',
                marginPercent: 15,
                currency: 'USD',
                priceTiers: [
                    { tier: 'ADULT', nettPrice: 30, grossPrice: 34.5 },
                    { tier: 'CHILD', nettPrice: 18, grossPrice: 20.7, originalPrice: 25 },
                ],
                options: [{ name: 'Adult Ticket', code: 'AD', externalId: 'OPT-ADULT' }],
            },
            expect: 201,
        });
        tourId = r.data?.id;
        assert(tourId, 'no tour id');
        assert(r.data.priceTiers?.length === 2, 'priceTiers not persisted');
        assert(r.data.currency === 'USD', 'currency not persisted');
    });
    await step('PATCH /tours/:id replaces priceTiers atomically', async () => {
        const r = await call('PATCH', `/tours/${tourId}`, {
            body: {
                priceTiers: [
                    { tier: 'ADULT', grossPrice: 40 },
                    { tier: 'INFANT', grossPrice: 0 },
                ],
            },
        });
        assert(r.data.priceTiers?.length === 2, 'tiers not replaced');
        assert(
            r.data.priceTiers.some((t) => t.tier === 'INFANT'),
            'INFANT tier missing after replace'
        );
        assert(
            !r.data.priceTiers.some((t) => t.tier === 'CHILD'),
            'old CHILD tier still present'
        );
    });
    await step('PATCH /tours/:id flips to MULTI_DAY with pax tiers', async () => {
        const r = await call('PATCH', `/tours/${tourId}`, {
            body: {
                tourType: 'MULTI_DAY',
                durationDays: 3,
                priceTiers: [
                    { tier: 'PAX_1', grossPrice: 800 },
                    { tier: 'PAX_2', grossPrice: 600 },
                    { tier: 'CHILD_WITH_BED', grossPrice: 300 },
                ],
            },
        });
        assert(r.data.tourType === 'MULTI_DAY', 'tourType not switched');
        assert(r.data.priceTiers?.length === 3, 'multi-day tiers not persisted');
    });
    await step('POST /tours rejects negative price → 400', async () => {
        await call('POST', '/tours', {
            body: {
                ...tourPayloadBase,
                productId: `SMK-NEG-${Date.now()}`,
                priceTiers: [{ tier: 'ADULT', grossPrice: -5 }],
            },
            expect: 400,
        });
    });
    await step('POST /tours rejects originalPrice < grossPrice → 400', async () => {
        await call('POST', '/tours', {
            body: {
                ...tourPayloadBase,
                productId: `SMK-ORIG-${Date.now()}`,
                priceTiers: [{ tier: 'ADULT', grossPrice: 50, originalPrice: 40 }],
            },
            expect: 400,
        });
    });
    await step('POST /tours rejects duplicate tier → 400', async () => {
        await call('POST', '/tours', {
            body: {
                ...tourPayloadBase,
                productId: `SMK-DUP-${Date.now()}`,
                priceTiers: [
                    { tier: 'ADULT', grossPrice: 30 },
                    { tier: 'ADULT', grossPrice: 35 },
                ],
            },
            expect: 400,
        });
    });
    await step('POST /tours rejects PAX tier on SINGLE_DAY → 400', async () => {
        await call('POST', '/tours', {
            body: {
                ...tourPayloadBase,
                productId: `SMK-MIX-${Date.now()}`,
                tourType: 'SINGLE_DAY',
                priceTiers: [{ tier: 'PAX_2', grossPrice: 500 }],
            },
            expect: 400,
        });
    });
    await step('POST /tours rejects ADULT tier on MULTI_DAY → 400', async () => {
        await call('POST', '/tours', {
            body: {
                ...tourPayloadBase,
                productId: `SMK-MIX2-${Date.now()}`,
                tourType: 'MULTI_DAY',
                priceTiers: [{ tier: 'ADULT', grossPrice: 30 }],
            },
            expect: 400,
        });
    });
    await step('POST /tours rejects city not in selected country → 400', async () => {
        await call('POST', '/tours', {
            body: {
                ...tourPayloadBase,
                productId: `SMK-MISMATCH-${Date.now()}`,
                cityId: 1,
                countryId: 999_999,
            },
            expect: 400,
        });
    });
    await step('GET /tours (list)', async () => {
        const r = await call('GET', '/tours?limit=5');
        assert(Array.isArray(r.data), 'list not array');
    });
    await step('GET /tours/:id (with pricing)', async () => {
        const r = await call('GET', `/tours/${tourId}`);
        assert(r.data?.priceTiers?.length === 3, 'tiers missing on GET');
    });

    // Reset the tour back to a SINGLE_DAY shape so booking smoke tests have predictable pricing
    await step('PATCH /tours/:id back to SINGLE_DAY for booking smoke', async () => {
        const r = await call('PATCH', `/tours/${tourId}`, {
            body: {
                tourType: 'SINGLE_DAY',
                priceTiers: [
                    { tier: 'ADULT', nettPrice: 30, grossPrice: 50 },
                    { tier: 'CHILD', nettPrice: 18, grossPrice: 30 },
                    { tier: 'INFANT', grossPrice: 0 },
                ],
            },
        });
        assert(r.data.tourType === 'SINGLE_DAY');
    });

    console.log(c.y('\nCustomer CRUD'));
    let customerId = null;
    await step('POST /customers', async () => {
        const r = await call('POST', '/customers', {
            body: {
                name: `Smoke Customer ${Date.now()}`,
                email: `smoke-${Date.now()}@example.com`,
            },
            expect: 201,
        });
        customerId = r.data?.id;
        assert(customerId, 'no customer id');
    });
    await step('GET /customers (list)', async () => {
        const r = await call('GET', '/customers?limit=5');
        assert(Array.isArray(r.data), 'list not array');
    });

    console.log(c.y('\nAgent CRUD'));
    let agentId = null;
    await step('POST /agents', async () => {
        const r = await call('POST', '/agents', {
            body: {
                name: `Smoke Agent ${Date.now()}`,
                email: `agent-${Date.now()}@example.com`,
                companyName: 'Smoke Travels',
                commissionPercent: 10,
            },
            expect: 201,
        });
        agentId = r.data?.id;
        assert(agentId, 'no agent id');
    });

    console.log(c.y('\nExchange Rate CRUD'));
    let rateId = null;
    const fromCur = 'XAA';
    const toCur = 'XBB';
    await step('POST /exchange-rates', async () => {
        const r = await call('POST', '/exchange-rates', {
            body: { fromCurrency: fromCur, toCurrency: toCur, rate: 1.5 },
            expect: 201,
        });
        rateId = r.data?.id;
        assert(rateId, 'no rate id');
    });
    await step('POST /exchange-rates rejects same from/to → 400', async () => {
        await call('POST', '/exchange-rates', {
            body: { fromCurrency: 'YYY', toCurrency: 'YYY', rate: 1 },
            expect: 400,
        });
    });

    console.log(c.y('\nCoupon CRUD + apply'));
    let couponId = null;
    const couponCode = `SMOKE${Date.now()}`;
    await step('POST /coupons', async () => {
        const r = await call('POST', '/coupons', {
            body: {
                name: 'Smoke 10%',
                code: couponCode,
                discountType: 'PERCENTAGE',
                discountAmount: 10,
                startDate: '2026-01-01',
                endDate: '2030-01-01',
                eligibility: 'ALL',
            },
            expect: 201,
        });
        couponId = r.data?.id;
        assert(couponId, 'no coupon id');
        assert(r.data.code === couponCode.toUpperCase(), 'code not uppercased');
    });
    await step('POST /coupons/apply applies % discount', async () => {
        const r = await call('POST', '/coupons/apply', {
            body: { code: couponCode, tourId, amount: 100 },
        });
        assert(r.data.discountValue === 10, 'discount value mismatch');
        assert(r.data.finalAmount === 90, 'final amount mismatch');
    });
    await step('POST /coupons/apply rejects expired-equivalent (unknown) → 404', async () => {
        await call('POST', '/coupons/apply', {
            body: { code: 'NOPE-NOT-FOUND', tourId, amount: 100 },
            expect: 404,
        });
    });

    console.log(c.y('\nBooking flow'));
    let bookingId = null;
    let bookingRef = null;
    await step('POST /bookings/quote returns pricing', async () => {
        const r = await call('POST', '/bookings/quote', {
            body: { tourId, paxBreakdown: { ADULT: 2, CHILD: 1 }, couponCode },
        });
        assert(r.data?.gross > 0, 'no gross in quote');
        assert(r.data?.discount?.discountValue > 0, 'coupon not applied to quote');
    });
    await step('POST /bookings creates a booking', async () => {
        const r = await call('POST', '/bookings', {
            body: {
                tourId,
                leadGuestName: 'Smoke Guest',
                leadGuestEmail: `guest-${Date.now()}@example.com`,
                paxBreakdown: { ADULT: 2, CHILD: 1 },
                travelDate: '2026-12-15',
                couponCode,
            },
            expect: 201,
        });
        bookingId = r.data?.id;
        bookingRef = r.data?.referenceNumber;
        assert(bookingId, 'no booking id');
        assert(bookingRef && /^BK-\d{8}-/.test(bookingRef), 'bad reference number');
        assert(r.data.couponCode === couponCode.toUpperCase(), 'coupon not attached');
    });
    await step('POST /bookings rejects PAX_1 on SINGLE_DAY → 400', async () => {
        await call('POST', '/bookings', {
            body: {
                tourId,
                leadGuestName: 'X',
                leadGuestEmail: 'x@example.com',
                paxBreakdown: { PAX_1: 1 },
                travelDate: '2026-12-15',
            },
            expect: 400,
        });
    });
    await step('POST /bookings/:id/payments records a payment', async () => {
        const r = await call('POST', `/bookings/${bookingId}/payments`, {
            body: { amount: 100, currency: 'USD', status: 'PAID' },
            expect: 201,
        });
        assert(r.data.paymentStatus === 'PAID', 'paymentStatus not flipped');
    });
    await step('POST /bookings/:id/refund partial refund', async () => {
        const r = await call('POST', `/bookings/${bookingId}/refund`, {
            body: { amount: 50, notes: 'Partial' },
        });
        assert(r.data.paymentStatus === 'PARTIAL_REFUND' || r.data.paymentStatus === 'REFUNDED', 'refund not recorded');
    });
    await step('POST /bookings/:id/cancel cancels with reason', async () => {
        const r = await call('POST', `/bookings/${bookingId}/cancel`, {
            body: { reason: 'Smoke test cancel' },
        });
        assert(r.data.status === 'CANCELLED', 'not cancelled');
    });

    console.log(c.y('\nAlerts + Email Templates'));
    await step('GET /alerts/settings lists 7 alert types', async () => {
        const r = await call('GET', '/alerts/settings');
        assert(Array.isArray(r.data), 'not array');
        assert(r.data.length >= 7, `expected ≥7 settings, got ${r.data.length}`);
    });
    await step('GET /email-templates lists templates', async () => {
        const r = await call('GET', '/email-templates?limit=20');
        assert(Array.isArray(r.data), 'not array');
        assert(r.data.length >= 7, 'expected ≥7 templates');
    });
    await step('PATCH /alerts/settings/:type toggles disabled', async () => {
        const r = await call('PATCH', '/alerts/settings/PAYMENT_FAILURE', {
            body: { enabled: false, recipients: ['ops@example.com'] },
        });
        assert(r.data.enabled === false, 'enabled flag not flipped');
    });
    await step('POST /alerts/test queues a test email (skipped if mail disabled)', async () => {
        const r = await call('POST', '/alerts/test', {
            body: { alertType: 'BOOKING_CONFIRMATION', toEmail: 'smoke@example.com' },
        });
        assert(r.data?.status, 'no status returned');
    });
    await step('GET /alerts/logs lists email logs', async () => {
        const r = await call('GET', '/alerts/logs?limit=5');
        assert(Array.isArray(r.data), 'not array');
    });

    console.log(c.y('\nUploads'));
    await step('POST /uploads/presign returns signed URL', async () => {
        const r = await call('POST', '/uploads/presign', {
            body: {
                filename: 'smoke.png',
                contentType: 'image/png',
                size: 1024,
                folder: 'smoke',
            },
        });
        assert(r.data?.uploadUrl, 'no uploadUrl');
        assert(r.data?.publicUrl, 'no publicUrl');
    });
    await step('POST /uploads/presign rejects bad mime → 400', async () => {
        await call('POST', '/uploads/presign', {
            body: {
                filename: 'evil.exe',
                contentType: 'application/x-msdownload',
                size: 1024,
            },
            expect: 400,
        });
    });

    console.log(c.y('\nBlog CRUD'));
    let blogId = null;
    const blogSlug = `smoke-blog-${Date.now()}`;
    const initialContent =
        '<p>Intro paragraph for the smoke blog.</p>' +
        '<p><img src="https://cdn.example.com/inline-original.png" alt="A"/></p>';
    const initialBanner = `https://cdn.example.com/banner-${Date.now()}.jpg`;
    const initialThumb = `https://cdn.example.com/thumb-${Date.now()}.jpg`;
    await step('POST /blogs creates a draft post', async () => {
        const r = await call('POST', '/blogs', {
            body: {
                title: 'Smoke Blog Post',
                slug: blogSlug,
                excerpt: 'A reasonably long excerpt for the smoke blog post.',
                content: initialContent,
                bannerImage: initialBanner,
                thumbnailImage: initialThumb,
                author: 'Smoke Tester',
                category: 'TRAVEL_GUIDE',
                tags: ['smoke', 'qa'],
                status: 'DRAFT',
            },
            expect: 201,
        });
        blogId = r.data?.id;
        assert(blogId, 'no blog id');
        assert(r.data.slug === blogSlug, 'slug not persisted');
        assert(r.data.contentImages?.length === 1, 'contentImages not extracted');
        assert(r.data.readingMinutes >= 1, 'readingMinutes not derived');
    });
    await step('POST /blogs rejects duplicate slug → 409', async () => {
        await call('POST', '/blogs', {
            body: {
                title: 'Dup',
                slug: blogSlug,
                excerpt: 'A reasonably long excerpt for the duplicate test.',
                content: '<p>x</p>',
                bannerImage: 'https://cdn.example.com/banner.jpg',
                thumbnailImage: 'https://cdn.example.com/thumb.jpg',
                author: 'Smoke',
                category: 'NEWS',
            },
            expect: 409,
        });
    });
    await step('GET /blogs (list)', async () => {
        const r = await call('GET', '/blogs?limit=5');
        assert(Array.isArray(r.data), 'list not array');
    });
    await step('GET /blogs/:id', async () => {
        const r = await call('GET', `/blogs/${blogId}`);
        assert(r.data?.id === blogId, 'id mismatch');
    });
    await step('GET /blogs/slug/:slug', async () => {
        const r = await call('GET', `/blogs/slug/${blogSlug}`);
        assert(r.data?.id === blogId, 'slug lookup mismatch');
    });
    await step('PATCH /blogs/:id swaps inline image and refreshes contentImages', async () => {
        const r = await call('PATCH', `/blogs/${blogId}`, {
            body: {
                content:
                    '<p>Updated body</p>' +
                    '<p><img src="https://cdn.example.com/inline-replacement.png"/></p>',
            },
        });
        assert(r.data.contentImages?.length === 1, 'contentImages not refreshed');
        assert(
            r.data.contentImages[0] === 'https://cdn.example.com/inline-replacement.png',
            'new inline url not stored'
        );
    });
    await step('PATCH /blogs/:id flips to PUBLISHED and stamps publishedAt', async () => {
        const r = await call('PATCH', `/blogs/${blogId}`, { body: { status: 'PUBLISHED' } });
        assert(r.data.status === 'PUBLISHED', 'not published');
        assert(r.data.publishedAt, 'publishedAt not set on publish');
    });
    await step('PATCH /blogs/:id with invalid slug → 400', async () => {
        await call('PATCH', `/blogs/${blogId}`, { body: { slug: 'BAD SLUG' }, expect: 400 });
    });
    await step('DELETE /blogs/:id', async () => {
        await call('DELETE', `/blogs/${blogId}`, { expect: 204 });
    });
    await step('GET /blogs/:id after delete → 404', async () => {
        await call('GET', `/blogs/${blogId}`, { expect: 404 });
    });

    console.log(c.y('\nCleanup'));
    await step('DELETE /bookings/:id (hard delete for smoke teardown)', async () => {
        await call('DELETE', `/bookings/${bookingId}`, { expect: 204 });
    });
    await step('DELETE /coupons/:id', async () => {
        await call('DELETE', `/coupons/${couponId}`, { expect: 204 });
    });
    await step('DELETE /exchange-rates/:id', async () => {
        await call('DELETE', `/exchange-rates/${rateId}`, { expect: 204 });
    });
    await step('DELETE /agents/:id', async () => {
        await call('DELETE', `/agents/${agentId}`, { expect: 204 });
    });
    await step('DELETE /customers/:id', async () => {
        await call('DELETE', `/customers/${customerId}`, { expect: 204 });
    });
    await step('DELETE /tours/:id', async () => {
        await call('DELETE', `/tours/${tourId}`, { expect: 204 });
    });
    await step('DELETE /suppliers/:id', async () => {
        await call('DELETE', `/suppliers/${supplierId}`, { expect: 204 });
    });
    await step('DELETE /attractions/:id', async () => {
        await call('DELETE', `/attractions/${attractionId}`, { expect: 204 });
    });
    await step('DELETE /categories/:id', async () => {
        await call('DELETE', `/categories/${categoryId}`, { expect: 204 });
    });
    await step('DELETE /cities/:id', async () => {
        await call('DELETE', `/cities/${cityId}`, { expect: 204 });
    });
    await step('DELETE /countries/:id', async () => {
        await call('DELETE', `/countries/${countryId}`, { expect: 204 });
    });
    await step('POST /auth/logout', async () => {
        await call('POST', '/auth/logout', { expect: 204 });
    });

    await sleep(50);
    console.log();
    if (fail === 0) {
        console.log(c.g(`\n✓ all ${pass} smoke tests passed`));
        process.exit(0);
    }
    console.log(c.r(`\n✗ ${fail} of ${pass + fail} failed`));
    for (const f of failures) {
        console.log(c.r(`  - ${f.label}: ${f.message}`));
    }
    process.exit(1);
}

main().catch((err) => {
    console.error(c.r('Fatal:'), err);
    process.exit(2);
});
