import { success } from '../../../utils/api-response.js';
import * as ventrataService from './ventrata.service.js';

export async function ping(_req, res) {
    const data = await ventrataService.ping();
    return success(res, data);
}

export async function search(req, res) {
    const data = await ventrataService.searchProducts({
        q: req.query.q,
        perPage: req.query.perPage,
        supplierId: req.query.supplierId,
    });
    return success(res, data);
}

export async function show(req, res) {
    const data = await ventrataService.getProduct({
        productId: req.params.productId,
        supplierId: req.query.supplierId,
    });
    return success(res, data);
}

export async function importProduct(req, res) {
    const data = await ventrataService.importProduct({
        productId: req.params.productId,
        supplierId: req.query.supplierId,
    });
    return success(res, data, { message: 'Product imported from Ventrata' });
}
