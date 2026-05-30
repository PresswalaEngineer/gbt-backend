import { success, created, noContent } from '../../utils/api-response.js';
import * as reviewService from './review.service.js';

export async function listForTour(req, res) {
    return success(res, await reviewService.listForTour(req.params.tourId));
}

export async function create(req, res) {
    return created(
        res,
        await reviewService.createReview(req.customer.id, req.params.tourId, req.body),
        { message: 'Review submitted' }
    );
}

export async function list(req, res) {
    const { items, ...meta } = await reviewService.listReviews(req.query);
    return success(res, items, { meta });
}

export async function createAdmin(req, res) {
    const review = await reviewService.createAdminReview(req.body);
    return created(res, review, { message: 'Review created' });
}

export async function remove(req, res) {
    await reviewService.deleteReview(req.params.id);
    return noContent(res);
}
