import { created, noContent, success } from '../../utils/api-response.js';
import * as service from './destination-category.service.js';

export async function list(req, res) {
    const { items, ...meta } = await service.listDestCats(req.query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const row = await service.getDestCat(req.params.id);
    return success(res, row);
}

export async function create(req, res) {
    const row = await service.createDestCat(req.body);
    return created(res, row, { message: 'Entry created' });
}

export async function update(req, res) {
    const row = await service.updateDestCat(req.params.id, req.body);
    return success(res, row, { message: 'Entry updated' });
}

export async function remove(req, res) {
    await service.deleteDestCat(req.params.id);
    return noContent(res);
}
