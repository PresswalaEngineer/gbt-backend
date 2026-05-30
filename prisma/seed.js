import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

// Local seed images — downloaded once into global-bus-tour-admin/public/seed/
// and served statically by the admin. No runtime external dependency.
const SEED_IMAGE_COUNT = 15;
const img = (seed) => {
    const key = String(seed);
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return `/seed/travel-${(h % SEED_IMAGE_COUNT) + 1}.jpg`;
};

const COUNTRIES = [
    { code: 'US', name: 'United States', currency: 'USD', cities: ['New York', 'Los Angeles'] },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', cities: ['London', 'Edinburgh'] },
    { code: 'FR', name: 'France', currency: 'EUR', cities: ['Paris', 'Nice'] },
    { code: 'AE', name: 'United Arab Emirates', currency: 'AED', cities: ['Dubai', 'Abu Dhabi'] },
    { code: 'IN', name: 'India', currency: 'INR', cities: ['Mumbai', 'Jaipur'] },
    { code: 'JP', name: 'Japan', currency: 'JPY', cities: ['Tokyo', 'Kyoto'] },
];

const CATEGORIES = [
    'Sightseeing',
    'Adventure',
    'Museum',
    'Cruise',
    'Night Tour',
    'Food & Drink',
    'Theme Park',
];

const TRUNCATE_TABLES = [
    'BookingEvent',
    'BookingPayment',
    'Booking',
    'TourPriceTier',
    'TourOption',
    'Tour',
    'Attraction',
    'SupplierContract',
    'Supplier',
    'Coupon',
    'City',
    'Country',
    'Category',
    'Customer',
    'Agent',
    'Blog',
    'Banner',
    'Faq',
    'DestinationCategory',
    'ExchangeRate',
    'EmailLog',
    'RefreshToken',
    'Staff',
];

async function wipe() {
    const list = TRUNCATE_TABLES.map((t) => `"${t}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    console.log(`✓ wiped ${TRUNCATE_TABLES.length} tables`);
}

async function seedStaff() {
    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@gbt.local';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
    const hash = await bcrypt.hash(password, 12);
    const admin = await prisma.staff.create({
        data: { email, password: hash, name: 'Root Admin', role: 'ADMIN', status: 'ACTIVE' },
    });
    await prisma.staff.create({
        data: {
            email: 'ops@gbt.local',
            password: hash,
            name: 'Olivia Ops',
            role: 'STAFF',
            status: 'ACTIVE',
        },
    });
    await prisma.staff.create({
        data: {
            email: 'finance@gbt.local',
            password: hash,
            name: 'Frank Finance',
            role: 'STAFF',
            status: 'INACTIVE',
        },
    });
    console.log(`✓ staff seeded (admin: ${email})`);
    return admin;
}

async function seedGeo() {
    const countryMap = {};
    const cityMap = {};
    for (const c of COUNTRIES) {
        const country = await prisma.country.create({
            data: {
                code: c.code,
                name: c.name,
                currency: c.currency,
                subtitle: `Discover the best of ${c.name}`,
                description: `Curated tours and experiences across ${c.name}.`,
                points: ['Top-rated guides', 'Instant confirmation', 'Best price guarantee'],
                images: [img(`country-${c.code}`, 1600, 600)],
            },
        });
        countryMap[c.code] = country;
        for (const cityName of c.cities) {
            const city = await prisma.city.create({
                data: {
                    name: cityName,
                    countryId: country.id,
                    population: '—',
                    subtitle: `Explore ${cityName}`,
                    description: `Hand-picked things to do in ${cityName}, ${c.name}.`,
                    points: ['Skip-the-line access', 'Local experts'],
                    images: [img(`city-${cityName}`, 1600, 600)],
                },
            });
            cityMap[cityName] = { ...city, currency: c.currency, countryId: country.id };
        }
    }
    console.log(`✓ ${Object.keys(countryMap).length} countries, ${Object.keys(cityMap).length} cities`);
    return { countryMap, cityMap };
}

async function seedCategories() {
    const map = {};
    for (const name of CATEGORIES) {
        map[name] = await prisma.category.create({ data: { name } });
    }
    console.log(`✓ ${CATEGORIES.length} categories`);
    return map;
}

async function seedAttractions(cityMap, catMap) {
    const data = [
        ['Statue of Liberty', 'New York', 'Sightseeing'],
        ['Central Park', 'New York', 'Sightseeing'],
        ['Tower of London', 'London', 'Museum'],
        ['London Eye', 'London', 'Sightseeing'],
        ['Eiffel Tower', 'Paris', 'Sightseeing'],
        ['Louvre Museum', 'Paris', 'Museum'],
        ['Burj Khalifa', 'Dubai', 'Sightseeing'],
        ['Gateway of India', 'Mumbai', 'Sightseeing'],
        ['Senso-ji Temple', 'Tokyo', 'Sightseeing'],
    ];
    const map = {};
    for (const [name, city, cat] of data) {
        const a = await prisma.attraction.create({
            data: {
                name,
                cityId: cityMap[city].id,
                categoryId: catMap[cat]?.id ?? null,
                bannerHeading: name,
                bannerContent: `Visit the iconic ${name}.`,
                bannerImage: img(`attr-banner-${name}`, 1600, 600),
                thumbnail: img(`attr-thumb-${name}`, 400, 300),
                firstOfferImage: img(`attr-o1-${name}`, 600, 400),
                secondOfferImage: img(`attr-o2-${name}`, 600, 400),
                seoTitle: `${name} Tickets & Tours`,
                seoDescription: `Book ${name} tickets and guided tours online.`,
                seoKeywords: `${name}, ${city}, tours`,
                footerHeading: `Plan your ${name} visit`,
                footerContent: `Everything you need to know about visiting ${name}.`,
            },
        });
        map[name] = a;
    }
    console.log(`✓ ${data.length} attractions`);
    return map;
}

async function seedExchangeRates() {
    // A couple MANUAL pairs; the live FX scheduler adds ~165 SYNCED rows on boot.
    const rows = [
        { fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.92, source: 'MANUAL' },
        { fromCurrency: 'USD', toCurrency: 'GBP', rate: 0.79, source: 'MANUAL' },
        { fromCurrency: 'GBP', toCurrency: 'INR', rate: 105.5, source: 'MANUAL' },
    ];
    for (const r of rows) await prisma.exchangeRate.create({ data: r });
    console.log(`✓ ${rows.length} manual exchange rates`);
}

async function seedSuppliers(countryMap, cityMap) {
    const list = [
        {
            name: 'Global City Tours Ltd',
            country: 'GB',
            cities: ['London', 'Edinburgh'],
            currency: 'GBP',
            api: { hasApi: true, apiType: 'TOURCMS', apiChannelId: '3930' },
        },
        {
            name: 'Europe Experiences SARL',
            country: 'FR',
            cities: ['Paris', 'Nice'],
            currency: 'EUR',
            api: { hasApi: true, apiType: 'VENTRATA', apiKey: null },
        },
        {
            name: 'Liberty Tours USA',
            country: 'US',
            cities: ['New York', 'Los Angeles'],
            currency: 'USD',
            api: { hasApi: false, apiType: 'NONE' },
        },
    ];
    const map = {};
    for (const s of list) {
        const sup = await prisma.supplier.create({
            data: {
                name: s.name,
                countryId: countryMap[s.country].id,
                bookingEmail: `bookings@${s.name.toLowerCase().replace(/[^a-z]/g, '')}.example`,
                phone: '+1 555 0100',
                address: '1 Tour Street',
                currency: s.currency,
                paymentMode: 'POSTPAID',
                bankAccountHolder: s.name,
                bankName: 'Global Bank',
                financeContactName: 'Fin Contact',
                financeContactEmail: `finance@${s.name.toLowerCase().replace(/[^a-z]/g, '')}.example`,
                contractContactName: 'Contract Contact',
                ...s.api,
                cities: { connect: s.cities.map((c) => ({ id: cityMap[c].id })) },
                contracts: {
                    create: [
                        {
                            type: 'RATE_SHEET',
                            label: '2026 Rate Sheet',
                            fileUrl: img(`contract-${s.name}`, 800, 1000),
                            validFrom: new Date('2026-01-01'),
                            validTo: new Date('2026-12-31'),
                        },
                    ],
                },
            },
        });
        map[s.name] = sup;
    }
    console.log(`✓ ${list.length} suppliers`);
    return map;
}

async function seedCustomersAgents(countryMap) {
    const codes = Object.keys(countryMap);
    for (let i = 1; i <= 12; i++) {
        await prisma.customer.create({
            data: {
                email: `customer${i}@example.com`,
                name: `Customer ${i}`,
                phone: `+1 555 02${String(i).padStart(2, '0')}`,
                countryId: countryMap[codes[i % codes.length]].id,
                status: i % 5 === 0 ? 'INACTIVE' : 'ACTIVE',
            },
        });
    }
    const agentStatuses = ['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED'];
    for (let i = 1; i <= 6; i++) {
        await prisma.agent.create({
            data: {
                email: `agent${i}@travelco.example`,
                name: `Agent ${i}`,
                companyName: `Travel Co ${i}`,
                phone: `+44 20 70${String(i).padStart(2, '0')}`,
                countryId: countryMap[codes[i % codes.length]].id,
                commissionPercent: 8 + i,
                agentStatus: agentStatuses[i % agentStatuses.length],
                status: 'ACTIVE',
            },
        });
    }
    console.log('✓ 12 customers, 6 agents');
}

async function seedCoupons(cityMap, catMap) {
    const now = new Date();
    const future = new Date(Date.now() + 90 * 864e5);
    const rows = [
        { name: 'Summer Sale', code: 'SUMMER20', discountType: 'PERCENTAGE', discountAmount: 20, eligibility: 'ALL' },
        { name: 'Welcome Flat', code: 'WELCOME10', discountType: 'FIXED', discountAmount: 10, eligibility: 'ALL' },
        {
            name: 'Paris Special',
            code: 'PARIS15',
            discountType: 'PERCENTAGE',
            discountAmount: 15,
            eligibility: 'CITY',
            targetCityId: cityMap['Paris'].id,
        },
        {
            name: 'Museum Lovers',
            code: 'MUSEUM25',
            discountType: 'PERCENTAGE',
            discountAmount: 25,
            eligibility: 'CATEGORY',
            targetCategoryId: catMap['Museum'].id,
        },
    ];
    for (const r of rows) {
        await prisma.coupon.create({
            data: {
                ...r,
                description: `${r.name} promotional discount`,
                startDate: now,
                endDate: future,
                userLimit: 100,
                minOrderAmount: 50,
            },
        });
    }
    console.log(`✓ ${rows.length} coupons`);
}

async function seedTours(adminId, countryMap, cityMap, catMap, attrMap, supMap) {
    const cityToCountryCode = {};
    for (const c of COUNTRIES) for (const ct of c.cities) cityToCountryCode[ct] = c.code;

    const TOURS = [
        ['City Highlights Bus Tour', 'New York', 'Sightseeing', 'Statue of Liberty', 'Liberty Tours USA'],
        ['Statue of Liberty Ferry & Skip-Line', 'New York', 'Sightseeing', 'Statue of Liberty', 'Liberty Tours USA'],
        ['Central Park Walking Tour', 'New York', 'Adventure', 'Central Park', null],
        ['London Hop-On Hop-Off', 'London', 'Sightseeing', 'London Eye', 'Global City Tours Ltd'],
        ['Tower of London Guided Entry', 'London', 'Museum', 'Tower of London', 'Global City Tours Ltd'],
        ['London by Night Tour', 'London', 'Night Tour', null, 'Global City Tours Ltd'],
        ['Eiffel Tower Summit Access', 'Paris', 'Sightseeing', 'Eiffel Tower', 'Europe Experiences SARL'],
        ['Louvre Skip-the-Line Tour', 'Paris', 'Museum', 'Louvre Museum', 'Europe Experiences SARL'],
        ['Seine River Dinner Cruise', 'Paris', 'Cruise', null, 'Europe Experiences SARL'],
        ['Dubai Desert Safari', 'Dubai', 'Adventure', null, null],
        ['Burj Khalifa At The Top', 'Dubai', 'Sightseeing', 'Burj Khalifa', null],
        ['Mumbai City & Gateway Tour', 'Mumbai', 'Sightseeing', 'Gateway of India', null],
        ['Tokyo Highlights Day Trip', 'Tokyo', 'Sightseeing', 'Senso-ji Temple', null],
        ['Kyoto Cultural Walking Tour', 'Kyoto', 'Sightseeing', null, null],
        ['Paris 3-Day Explorer Pass', 'Paris', 'Sightseeing', 'Eiffel Tower', 'Europe Experiences SARL'],
    ];

    let n = 0;
    for (const [name, cityName, catName, attrName, supName] of TOURS) {
        n++;
        const city = cityMap[cityName];
        const code = cityToCountryCode[cityName];
        const country = countryMap[code];
        const currency = city.currency;
        const multi = name.includes('3-Day');
        const tier = (t, gross, original) => ({
            tier: t,
            grossPrice: gross,
            nettPrice: Math.round(gross * 0.8 * 100) / 100,
            originalPrice: original ?? null,
        });
        const priceTiers = multi
            ? [tier('PAX_1', 320), tier('PAX_2', 280), tier('PAX_3', 250)]
            : [tier('ADULT', 60 + n * 3, 80 + n * 3), tier('CHILD', 35 + n * 2), tier('INFANT', 0)];

        await prisma.tour.create({
            data: {
                name,
                productId: `GBT-${code}-${String(n).padStart(3, '0')}`,
                productSlug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                productCode: `PC${1000 + n}`,
                countryId: country.id,
                cityId: city.id,
                categoryId: catMap[catName]?.id ?? null,
                attractionId: attrName ? attrMap[attrName]?.id ?? null : null,
                supplierId: supName ? supMap[supName]?.id ?? null : null,
                supplierName: supName ?? null,
                description: `${name} — a top-rated experience. Explore the best sights with an expert local guide.`,
                inclusions: 'Professional guide\nHotel pickup\nAll entry fees',
                exclusions: 'Gratuities\nFood and drinks',
                cancellationPolicy: 'Free cancellation up to 24 hours before.',
                importantNotes: 'Please arrive 15 minutes early.',
                meetingPoint: `${cityName} central meeting point`,
                endingPoint: `${cityName} drop-off point`,
                duration: multi ? '3 days' : `${2 + (n % 6)} hours`,
                startTime: '09:00',
                startTimes: ['09:00', '13:00'],
                bookingWindow: '2 days',
                bookingCutoffHours: 24,
                freeCancellationHours: 24,
                voucherType: 'MOBILE',
                productTags: ['LIVE_GUIDE', 'MULTI_LANGUAGE'],
                minPax: 1,
                maxPax: multi ? 9 : 25 + n,
                instantConfirmation: true,
                tourType: multi ? 'MULTI_DAY' : 'SINGLE_DAY',
                durationDays: multi ? 3 : null,
                pricingMode: 'NETT',
                marginPercent: 20,
                currency,
                thumbnail: img(`tour-thumb-${n}`, 600, 400),
                images: [img(`tour-1-${n}`, 1200, 800), img(`tour-2-${n}`, 1200, 800)],
                seoTitle: `${name} | Book Online`,
                seoDescription: `Book ${name} with instant confirmation and best price.`,
                seoKeywords: `${name}, ${cityName}, things to do`,
                createdById: adminId,
                modifiedById: adminId,
                status: 'ACTIVE',
                priceTiers: { create: priceTiers },
                options: {
                    create: [
                        { name: 'Standard', externalId: `OPT-${n}-STD` },
                        { name: 'Premium (small group)', externalId: `OPT-${n}-PRM` },
                    ],
                },
            },
        });
    }
    console.log(`✓ ${TOURS.length} manual tours (with price tiers + options)`);
}

async function seedBlogs(adminId) {
    const cats = ['TRAVEL_GUIDE', 'TIPS', 'NEWS', 'DESTINATION', 'HOW_TO'];
    const titles = [
        'Top 10 Things to Do in Paris',
        'A First-Timer Guide to London',
        'Dubai on a Budget: Insider Tips',
        'Why Tokyo Should Be Your Next Trip',
        'How to Skip the Lines at Major Attractions',
        'The Ultimate New York Weekend Itinerary',
    ];
    let i = 0;
    for (const title of titles) {
        i++;
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const banner = img(`blog-banner-${i}`, 1600, 900);
        const inline = img(`blog-inline-${i}`, 1000, 600);
        await prisma.blog.create({
            data: {
                title,
                slug,
                excerpt: `${title} — a practical, up-to-date guide for travellers planning their trip.`,
                content: `<h2>${title}</h2><p>This is a curated guide with everything you need to know.</p><img src="${inline}" alt="${title}" /><p>Book your tours with instant confirmation and the best price.</p>`,
                contentImages: [inline],
                bannerImage: banner,
                thumbnailImage: img(`blog-thumb-${i}`, 600, 400),
                ogImage: img(`blog-og-${i}`, 1200, 630),
                author: 'GBT Editorial',
                category: cats[i % cats.length],
                tags: ['travel', 'guide', 'tips'],
                status: i % 4 === 0 ? 'DRAFT' : 'PUBLISHED',
                isFeatured: i <= 2,
                publishedAt: i % 4 === 0 ? null : new Date(Date.now() - i * 864e5),
                readingMinutes: 4 + i,
                seoTitle: `${title} | GBT Blog`,
                seoDescription: `${title} — read our expert travel guide.`,
                seoKeywords: 'travel, guide, tours',
                createdById: adminId,
                modifiedById: adminId,
            },
        });
    }
    console.log(`✓ ${titles.length} blogs`);
}

async function seedCmsExtras() {
    const banners = [
        'Explore the World — 20% off summer tours',
        'London City Special — Night Tours Available',
        'Discover Paris: Skip-the-line Eiffel Tower',
        'Dubai Desert Safari — Book Now',
        'New York Highlights — Best Price Guarantee',
    ];
    for (let i = 0; i < banners.length; i++) {
        await prisma.banner.create({
            data: {
                imageUrl: img(`banner-${i + 1}`, 1920, 800),
                content: banners[i],
                isActive: i === 0,
                orderIndex: i,
            },
        });
    }

    const faqs = [
        ['What is your registered business address?', '71-75 Shelton Street, Covent Garden, WC2H 9JQ, London.'],
        ['Do I need to print my ticket?', 'No, a mobile e-ticket is accepted at all attractions.'],
        ['Can I cancel my booking?', 'Yes, free cancellation up to 24 hours before the tour date.'],
        ['Which payment methods do you accept?', 'All major cards. Settlement is processed in USD.'],
        ['Are tours wheelchair accessible?', 'Many are — check the product tags on each tour.'],
    ];
    for (let i = 0; i < faqs.length; i++) {
        await prisma.faq.create({
            data: { question: faqs[i][0], answer: faqs[i][1], orderIndex: i },
        });
    }

    const destCats = [
        ['Paris', 'Destination'],
        ['London', 'Destination'],
        ['Dubai', 'Destination'],
        ['New York', 'Destination'],
        ['Sightseeing', 'Category'],
        ['Adventure', 'Category'],
        ['Museum', 'Category'],
    ];
    for (let i = 0; i < destCats.length; i++) {
        await prisma.destinationCategory.create({
            data: { name: destCats[i][0], type: destCats[i][1], orderIndex: i },
        });
    }
    console.log(`✓ ${banners.length} banners, ${faqs.length} faqs, ${destCats.length} destination/category`);
}

async function main() {
    await wipe();
    const admin = await seedStaff();
    const { countryMap, cityMap } = await seedGeo();
    const catMap = await seedCategories();
    const attrMap = await seedAttractions(cityMap, catMap);
    await seedExchangeRates();
    const supMap = await seedSuppliers(countryMap, cityMap);
    await seedCustomersAgents(countryMap);
    await seedCoupons(cityMap, catMap);
    await seedTours(admin.id, countryMap, cityMap, catMap, attrMap, supMap);
    await seedBlogs(admin.id);
    await seedCmsExtras();
    console.log('\n✅ Rich seed complete.');
}

main()
    .catch((error) => {
        console.error('Seed failed', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
