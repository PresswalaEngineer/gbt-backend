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
    const params = new URLSearchParams();
    if (q) params.set('k', q);
    params.set('per_page', String(perPage ?? 20));
    const response = await tourcmsClient.searchTours({ channelId: cid, qs: params.toString() });
    return {
        channelId: cid,
        totalCount: Number(response?.total_tour_count ?? 0),
        tours: normalizeSearchTours(response).map((t) => ({ ...t, channelId: t.channelId || String(cid) })),
    };
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
