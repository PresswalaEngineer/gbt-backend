// Creates (or refreshes) one fully-populated showcase tour so every section of
// the storefront tour page + voucher is filled. Idempotent — upserts by productId.
// Run:  node prisma/demo-tour.js
import { prisma } from '../src/config/db.js';

const DESCRIPTION = `Discover the very best of Paris on this expertly guided full-day experience that blends the city's iconic landmarks with its hidden corners. From the moment you meet your local guide in the heart of the city, you'll be swept into a story that spans centuries — grand boulevards, royal palaces, riverside cafés and the unmistakable silhouette of the Eiffel Tower.

Travel in comfort aboard our modern coach as you glide past the Arc de Triomphe, along the Champs-Élysées and through the artistic streets of Montmartre. Step off at the most photogenic spots, enjoy skip-the-line access to a headline attraction, and soak up the atmosphere with plenty of time to explore at your own pace.

Whether it's your first visit or your tenth, this tour is designed to give you the perfect balance of must-see highlights and authentic local flavour. Small-group friendly, fully narrated, and crafted by people who love this city — it's the easiest way to fall for Paris.`;

const HIGHLIGHTS = [
    'Skip-the-line entry to a headline Paris landmark',
    'Expert, English-speaking local guide',
    'Panoramic drive past the Arc de Triomphe & Champs-Élysées',
    'Free time to explore Montmartre',
    'Comfortable air-conditioned coach',
    'Hotel pickup from central Paris',
].join('\n');

const ITINERARY = [
    'Hotel Pickup — Meet your guide and board the coach in central Paris',
    'Champs-Élysées & Arc de Triomphe — Panoramic drive along the famous avenue with a photo stop',
    'Eiffel Tower — Skip-the-line access and time for photos at the Trocadéro viewpoint',
    'Seine Riverside — Stroll past Notre-Dame and the historic Latin Quarter',
    'Montmartre — Free time to explore the artists’ quarter and Sacré-Cœur',
    'Return — Drop-off back at the central meeting point',
].join('\n');

const INCLUSIONS = ['Professional guide', 'Hotel pickup & drop-off', 'Skip-the-line entry', 'Air-conditioned coach'].join('\n');
const EXCLUSIONS = ['Gratuities', 'Food and drinks', 'Personal expenses'].join('\n');
const NOTES = [
    'Please arrive 15 minutes before departure.',
    'Comfortable walking shoes recommended.',
    'Not wheelchair accessible at all stops.',
].join('\n');

async function main() {
    const country = await prisma.country.findFirst({ where: { name: { contains: 'France', mode: 'insensitive' } } });
    if (!country) throw new Error('Seed country "France" not found — run db:seed first');
    const city =
        (await prisma.city.findFirst({ where: { countryId: country.id, name: { contains: 'Paris', mode: 'insensitive' } } })) ||
        (await prisma.city.findFirst({ where: { countryId: country.id } }));
    if (!city) throw new Error('No city found for France');

    const productId = 'GBT-DEMO-PARIS-001';
    const base = {
        name: 'Paris in a Day: Highlights & Hidden Gems',
        productId,
        productSlug: 'paris-in-a-day-highlights-hidden-gems',
        productCode: 'GBT-DEMO-PARIS-001',
        countryId: country.id,
        cityId: city.id,
        status: 'ACTIVE',
        tourType: 'SINGLE_DAY',
        currency: 'EUR',
        duration: '8 hours',
        startTime: '09:00',
        startTimes: ['09:00', '13:00'],
        minPax: 1,
        maxPax: 30,
        meetingPoint: 'Place de l’Opéra, 75009 Paris (central meeting hub)',
        endingPoint: 'Place de l’Opéra, 75009 Paris',
        meetingPoints: ['Place de l’Opéra (main)', 'Hotel pickup on request'],
        voucherType: 'MOBILE',
        instantConfirmation: true,
        cancellationPolicy: 'Free cancellation up to 24 hours before the start time for a full refund.',
        freeCancellationHours: 24,
        description: DESCRIPTION,
        highlights: HIGHLIGHTS,
        itinerary: ITINERARY,
        inclusions: INCLUSIONS,
        exclusions: EXCLUSIONS,
        importantNotes: NOTES,
        voucherUsage: 'Show this voucher (printed or on your phone) to your guide at the meeting point.',
        thumbnail: '/seed/travel-9.jpg',
        images: ['/seed/travel-9.jpg', '/seed/travel-13.jpg', '/seed/travel-14.jpg'],
        seoTitle: 'Paris in a Day Tour — Highlights & Hidden Gems | GBT',
        seoDescription: 'Full-day guided Paris tour: Eiffel Tower skip-the-line, Champs-Élysées, Montmartre and more. Hotel pickup, expert guide, free cancellation.',
    };

    const tiers = [
        { tier: 'ADULT', nettPrice: 70, grossPrice: 89, originalPrice: 119 },
        { tier: 'CHILD', nettPrice: 40, grossPrice: 49, originalPrice: 69 },
        { tier: 'INFANT', nettPrice: 0, grossPrice: 0, originalPrice: null },
    ];

    const existing = await prisma.tour.findUnique({ where: { productId } });
    if (existing) {
        await prisma.tourPriceTier.deleteMany({ where: { tourId: existing.id } });
        const tour = await prisma.tour.update({
            where: { id: existing.id },
            data: { ...base, priceTiers: { create: tiers } },
        });
        console.log('✅ demo tour updated:', tour.id, '/tour/' + tour.productSlug);
    } else {
        const tour = await prisma.tour.create({ data: { ...base, priceTiers: { create: tiers } } });
        console.log('✅ demo tour created:', tour.id, '/tour/' + tour.productSlug);
    }
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error('demo-tour failed:', e.message);
    await prisma.$disconnect();
    process.exit(1);
});
