import { env } from '../../../config/env.js';
import { tourcmsClient } from '../../../services/integrations/tourcms/client.js';
import {
    normalizeSearchTours,
    normalizeShowTour,
} from '../../../services/integrations/tourcms/normalize.js';
import { mirrorRemoteImage } from '../../../services/integrations/image-mirror.js';
import { logger } from '../../../utils/logger.js';

function resolveChannelId(input) {
    return Number(input ?? env.TOURCMS_DEFAULT_CHANNEL_ID) || env.TOURCMS_DEFAULT_CHANNEL_ID;
}

// Connector words that shouldn't be required when AND-matching a query.
const SEARCH_STOP_WORDS = new Set([
    'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'at', 'by',
    'with', 'for', 'from', '&',
]);

// Lowercase, strip punctuation (so "Saint-Michel" → ["saint","michel"]).
function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

// Every query word must appear (as a token or token-prefix) in the tour's
// name or location — order- and punctuation-independent.
function matchesAllWords(tour, words) {
    if (!words.length) return true;
    const haystack = tokenize(`${tour?.name || ''} ${tour?.location || ''}`);
    return words.every(
        (word) => haystack.includes(word) || haystack.some((token) => token.includes(word))
    );
}

// TourCMS replies with an upstream "NO MATCHING DATA" error (not empty results)
// when the keyword matches nothing — treat that as zero results, not a failure.
function isNoMatchError(err) {
    return /NO\s+MATCHING/i.test(String(err?.message || ''));
}

export async function ping() {
    const response = await tourcmsClient.listChannels();
    const channels = response?.channel
        ? Array.isArray(response.channel)
            ? response.channel
            : [response.channel]
        : [];
    return {
        ok: true,
        marketplaceId: env.TOURCMS_MARKETPLACE_ID,
        defaultChannelId: env.TOURCMS_DEFAULT_CHANNEL_ID,
        channels: channels.map((channel) => ({
            channelId: String(channel.channel_id ?? ''),
            name: String(channel.account_name ?? channel.channel_name ?? ''),
        })),
    };
}

export async function searchTours({ channelId, q, perPage }) {
    const cid = resolveChannelId(channelId);
    const limit = Number(perPage) > 0 ? Number(perPage) : 20;
    const words = tokenize(q).filter((word) => !SEARCH_STOP_WORDS.has(word));

    const params = new URLSearchParams();
    if (words.length) {
        // Send only the single most distinctive (longest) word to TourCMS — its
        // k= search is punctuation-sensitive and errors on multi-word misses, so
        // we let it pre-filter on one word, then AND-filter the rest locally.
        const probe = [...words].sort((a, b) => b.length - a.length)[0];
        params.set('k', probe);
        params.set('per_page', '50');
    } else {
        if (q) params.set('k', q);
        params.set('per_page', String(limit));
    }

    let response;
    try {
        response = await tourcmsClient.searchTours({ channelId: cid, qs: params.toString() });
    } catch (cause) {
        if (isNoMatchError(cause)) return { channelId: cid, totalCount: 0, tours: [] };
        throw cause;
    }

    let tours = normalizeSearchTours(response).map((t) => ({
        ...t,
        channelId: t.channelId || String(cid),
    }));
    if (words.length) tours = tours.filter((tour) => matchesAllWords(tour, words));

    return { channelId: cid, totalCount: tours.length, tours: tours.slice(0, limit) };
}

export async function getTour({ channelId, tourId }) {
    const cid = resolveChannelId(channelId);
    const response = await tourcmsClient.showTour({ channelId: cid, tourId });
    const normalized = normalizeShowTour(response);
    return { channelId: cid, tour: normalized };
}

async function mirrorAll(urls, folder) {
    const unique = Array.from(new Set(urls.filter(Boolean)));
    const results = await Promise.all(
        unique.map(async (url) => {
            try {
                const mirrored = await mirrorRemoteImage(url, { folder });
                return { source: url, publicUrl: mirrored?.publicUrl ?? null };
            } catch (cause) {
                logger.warn({ err: cause, url }, 'TourCMS image mirror failed');
                return { source: url, publicUrl: null };
            }
        })
    );
    return new Map(results.map(({ source, publicUrl }) => [source, publicUrl]));
}

export async function importTour({ channelId, tourId }) {
    const { channelId: cid, tour } = await getTour({ channelId, tourId });
    if (!tour) return { channelId: cid, tour: null };

    const folder = `tourcms-${cid}`;
    const sourceUrls = [tour.sourceThumbnail, ...tour.sourceImages].filter(Boolean);
    const map = await mirrorAll(sourceUrls, folder);

    const mirroredImages = tour.sourceImages
        .map((src) => map.get(src))
        .filter(Boolean);

    const mirroredThumbnail =
        (tour.sourceThumbnail && map.get(tour.sourceThumbnail)) ||
        mirroredImages[0] ||
        '';

    const { sourceImages, sourceThumbnail, ...rest } = tour;
    return {
        channelId: cid,
        tour: {
            ...rest,
            thumbnail: mirroredThumbnail,
            images: mirroredImages,
        },
    };
}
