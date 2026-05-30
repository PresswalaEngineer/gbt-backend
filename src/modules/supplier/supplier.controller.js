import { created, noContent, success } from '../../utils/api-response.js';
import * as supplierService from './supplier.service.js';

export async function list(req, res) {
    const { items, ...meta } = await supplierService.listSuppliers(req.query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const supplier = await supplierService.getSupplier(req.params.id);
    return success(res, supplier);
}

export async function create(req, res) {
    const supplier = await supplierService.createSupplier(req.body);
    return created(res, supplier, { message: 'Supplier created' });
}

export async function update(req, res) {
    const supplier = await supplierService.updateSupplier(req.params.id, req.body);
    return success(res, supplier, { message: 'Supplier updated' });
}

export async function remove(req, res) {
    await supplierService.deleteSupplier(req.params.id);
    return noContent(res);
}

export async function addContract(req, res) {
    const contract = await supplierService.addContract(req.params.id, req.body);
    return created(res, contract, { message: 'Contract added' });
}

export async function removeContract(req, res) {
    await supplierService.removeContract(req.params.id, req.params.contractId);
    return noContent(res);
}
