import { created, noContent, success } from '../../utils/api-response.js';
import * as cityService from './city.service.js';

export async function list(req, res) {
    const { items, ...meta } = await cityService.listCities(req.query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const city = await cityService.getCity(req.params.id);
    return success(res, city);
}

export async function getBySlug(req, res) {
    const city = await cityService.getCityBySlug(req.params.slug);
    return success(res, city);
}

export async function create(req, res) {
    const city = await cityService.createCity(req.body);
    return created(res, city, { message: 'City created' });
}

export async function update(req, res) {
    const city = await cityService.updateCity(req.params.id, req.body);
    return success(res, city, { message: 'City updated' });
}

export async function remove(req, res) {
    await cityService.deleteCity(req.params.id);
    return noContent(res);
}
