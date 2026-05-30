import { created, noContent, success } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';
import * as tourService from './tour.service.js';
import { toPublicTour, toPublicTourList } from './tour.public.js';
import { getTourRating } from '../review/review.service.js';

async function shapeForPublic(req, tour) {
    if (req.user) return tour;
    if (!tour || tour.status !== 'ACTIVE') throw ApiError.notFound('Tour not found');
    const shaped = toPublicTour(tour);
    const agg = await getTourRating(tour.id);
    return { ...shaped, rating: agg.rating, reviewCount: agg.reviewCount };
}

export async function list(req, res) {
    const isPublic = !req.user;
    const query = isPublic ? { ...req.query, status: 'ACTIVE' } : req.query;
    const { items, ...meta } = await tourService.listTours(query);
    return success(res, isPublic ? toPublicTourList(items) : items, { meta });
}

export async function availability(req, res) {
    const data = await tourService.getAvailability({
        id: req.params.id,
        date: req.query.date,
        pax: req.query.pax,
    });
    return success(res, data);
}

export async function monthAvailability(req, res) {
    const data = await tourService.getMonthAvailability({ id: req.params.id, month: req.query.month });
    return success(res, data);
}

export async function getById(req, res) {
    const tour = await tourService.getTour(req.params.id);
    return success(res, await shapeForPublic(req, tour));
}

export async function getBySlug(req, res) {
    const tour = await tourService.getTourBySlug(req.params.slug);
    return success(res, await shapeForPublic(req, tour));
}

export async function create(req, res) {
    const tour = await tourService.createTour(req.body, { actorId: req.user?.id });
    return created(res, tour, { message: 'Tour created' });
}

export async function update(req, res) {
    const tour = await tourService.updateTour(req.params.id, req.body, { actorId: req.user?.id });
    return success(res, tour, { message: 'Tour updated' });
}

export async function remove(req, res) {
    await tourService.deleteTour(req.params.id);
    return noContent(res);
}
