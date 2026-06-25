import { created, noContent, success } from '../../utils/api-response.js';
import * as countryService from './country.service.js';

export async function list(req, res) {
    const { items, ...meta } = await countryService.listCountries(req.query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const country = await countryService.getCountry(req.params.id);
    return success(res, country);
}

export async function getBySlug(req, res) {
    const country = await countryService.getCountryBySlug(req.params.slug);
    return success(res, country);
}

export async function create(req, res) {
    const country = await countryService.createCountry(req.body);
    return created(res, country, { message: 'Country created' });
}

export async function update(req, res) {
    const country = await countryService.updateCountry(req.params.id, req.body);
    return success(res, country, { message: 'Country updated' });
}

export async function remove(req, res) {
    await countryService.deleteCountry(req.params.id);
    return noContent(res);
}
