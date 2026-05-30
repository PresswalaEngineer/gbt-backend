import { prisma } from '../../config/db.js';

export async function getOverview() {
    const [
        countries,
        cities,
        categories,
        attractions,
        tours,
        customers,
        agents,
        suppliers,
        bookings,
        blogs,
    ] = await prisma.$transaction([
        prisma.country.count(),
        prisma.city.count(),
        prisma.category.count(),
        prisma.attraction.count(),
        prisma.tour.count(),
        prisma.customer.count(),
        prisma.agent.count(),
        prisma.supplier.count(),
        prisma.booking.count(),
        prisma.blog.count(),
    ]);

    return {
        countries,
        cities,
        categories,
        attractions,
        tours,
        customers,
        agents,
        suppliers,
        bookings,
        blogs,
    };
}
