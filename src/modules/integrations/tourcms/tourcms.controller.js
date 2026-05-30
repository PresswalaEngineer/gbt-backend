import { success } from '../../../utils/api-response.js';
import * as tourcmsService from './tourcms.service.js';

export async function ping(_req, res) {
    const data = await tourcmsService.ping();
    return success(res, data);
}

export async function search(req, res) {
    const data = await tourcmsService.searchTours({
        channelId: req.query.channelId,
        q: req.query.q,
        perPage: req.query.perPage,
    });
    return success(res, data);
}

export async function show(req, res) {
    const data = await tourcmsService.getTour({
        channelId: req.query.channelId,
        tourId: req.params.tourId,
    });
    return success(res, data);
}

export async function importTour(req, res) {
    const data = await tourcmsService.importTour({
        channelId: req.query.channelId,
        tourId: req.params.tourId,
    });
    return success(res, data, { message: 'Tour imported from TourCMS' });
}
