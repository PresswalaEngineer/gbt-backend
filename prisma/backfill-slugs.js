import 'dotenv/config';
import { prisma } from '../src/config/db.js';
import { slugify } from '../src/utils/slug.js';

// One-off, idempotent backfill: gives every existing Tour/Country/City/
// Attraction/Category a unique SEO slug. New rows get one automatically on
// create (see the *.service.js files) — this catches rows created before that
// landed. Safe to re-run; only fills rows whose slug is still null.
async function backfill(model, field) {
    const missing = await prisma[model].findMany({
        where: { [field]: null },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
    });
    const taken = new Set(
        (
            await prisma[model].findMany({
                where: { NOT: { [field]: null } },
                select: { [field]: true },
            })
        ).map((row) => row[field])
    );
    let done = 0;
    for (const row of missing) {
        const base = slugify(row.name);
        let slug = base;
        let n = 2;
        while (taken.has(slug)) slug = `${base}-${n++}`;
        taken.add(slug);
        // eslint-disable-next-line no-await-in-loop
        await prisma[model].update({ where: { id: row.id }, data: { [field]: slug } });
        done += 1;
    }
    console.log(`${model}.${field}: backfilled ${done} of ${missing.length} missing`);
}

async function main() {
    await backfill('country', 'slug');
    await backfill('category', 'slug');
    await backfill('city', 'slug');
    await backfill('attraction', 'slug');
    await backfill('tour', 'productSlug');
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
        console.error(err);
        await prisma.$disconnect();
        process.exit(1);
    });
