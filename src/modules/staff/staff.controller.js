import { success, noContent } from '../../utils/api-response.js';
import * as staffService from './staff.service.js';

export async function list(req, res) {
    const { items, ...meta } = await staffService.listStaff(req.query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const staff = await staffService.getStaff(req.params.id);
    return success(res, staff);
}

export async function update(req, res) {
    const staff = await staffService.updateStaff(req.params.id, req.body, req.user);
    return success(res, staff, { message: 'Staff updated' });
}

export async function remove(req, res) {
    await staffService.deleteStaff(req.params.id, req.user);
    return noContent(res);
}
