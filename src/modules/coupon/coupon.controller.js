import { created, noContent, success } from '../../utils/api-response.js';
import * as couponService from './coupon.service.js';

export async function list(req, res) {
    const { items, ...meta } = await couponService.listCoupons(req.query);
    return success(res, items, { meta });
}
export async function getById(req, res) {
    return success(res, await couponService.getCoupon(req.params.id));
}
export async function create(req, res) {
    return created(res, await couponService.createCoupon(req.body), { message: 'Coupon created' });
}
export async function update(req, res) {
    return success(res, await couponService.updateCoupon(req.params.id, req.body), {
        message: 'Coupon updated',
    });
}
export async function remove(req, res) {
    await couponService.deleteCoupon(req.params.id);
    return noContent(res);
}
export async function apply(req, res) {
    return success(res, await couponService.applyCoupon(req.body));
}
export async function offers(req, res) {
    const raw = req.query.tourIds;
    const tourIds = (Array.isArray(raw) ? raw : raw ? String(raw).split(',') : [])
        .map((x) => Number(x))
        .filter(Boolean);
    return success(res, await couponService.listOffers({ tourIds }));
}
