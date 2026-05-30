import { created, noContent, success } from '../../utils/api-response.js';
import * as customerService from './customer.service.js';

export async function list(req, res) {
    const { items, ...meta } = await customerService.listCustomers(req.query);
    return success(res, items, { meta });
}
export async function getById(req, res) {
    return success(res, await customerService.getCustomer(req.params.id));
}
export async function create(req, res) {
    return created(res, await customerService.createCustomer(req.body), { message: 'Customer created' });
}
export async function update(req, res) {
    return success(res, await customerService.updateCustomer(req.params.id, req.body), {
        message: 'Customer updated',
    });
}
export async function remove(req, res) {
    await customerService.deleteCustomer(req.params.id);
    return noContent(res);
}
