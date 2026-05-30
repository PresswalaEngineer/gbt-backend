import { created, noContent, success } from '../../utils/api-response.js';
import * as exchangeRateService from './exchange-rate.service.js';

export async function list(req, res) {
    const { items, ...meta } = await exchangeRateService.listRates(req.query);
    return success(res, items, { meta });
}
export async function getById(req, res) {
    return success(res, await exchangeRateService.getRate(req.params.id));
}
export async function create(req, res) {
    return created(res, await exchangeRateService.createRate(req.body), { message: 'Rate created' });
}
export async function update(req, res) {
    return success(res, await exchangeRateService.updateRate(req.params.id, req.body), {
        message: 'Rate updated',
    });
}
export async function remove(req, res) {
    await exchangeRateService.deleteRate(req.params.id);
    return noContent(res);
}
export async function sync(_req, res) {
    return success(res, await exchangeRateService.triggerSync({ force: true }), {
        message: 'Exchange rates synced',
    });
}
export async function syncStatus(_req, res) {
    return success(res, await exchangeRateService.syncStatus());
}
export async function convert(req, res) {
    return success(res, await exchangeRateService.convertAmount(req.query));
}
