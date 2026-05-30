import { created, noContent, success } from '../../utils/api-response.js';
import * as attractionService from './attraction.service.js';

export async function list(req, res) {
    const { items, ...meta } = await attractionService.listAttractions(req.query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const attraction = await attractionService.getAttraction(req.params.id);
    return success(res, attraction);
}

export async function create(req, res) {
    const attraction = await attractionService.createAttraction(req.body);
    return created(res, attraction, { message: 'Attraction created' });
}

export async function update(req, res) {
    const attraction = await attractionService.updateAttraction(req.params.id, req.body);
    return success(res, attraction, { message: 'Attraction updated' });
}

export async function remove(req, res) {
    await attractionService.deleteAttraction(req.params.id);
    return noContent(res);
}
