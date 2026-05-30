import { created, noContent, success } from '../../utils/api-response.js';
import * as bannerService from './banner.service.js';

export async function list(req, res) {
    const { items, ...meta } = await bannerService.listBanners(req.query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const banner = await bannerService.getBanner(req.params.id);
    return success(res, banner);
}

export async function create(req, res) {
    const banner = await bannerService.createBanner(req.body);
    return created(res, banner, { message: 'Banner created' });
}

export async function update(req, res) {
    const banner = await bannerService.updateBanner(req.params.id, req.body);
    return success(res, banner, { message: 'Banner updated' });
}

export async function activate(req, res) {
    const banner = await bannerService.activateBanner(req.params.id);
    return success(res, banner, { message: 'Banner activated' });
}

export async function deactivate(req, res) {
    const banner = await bannerService.deactivateBanner(req.params.id);
    return success(res, banner, { message: 'Banner deactivated' });
}

export async function remove(req, res) {
    await bannerService.deleteBanner(req.params.id);
    return noContent(res);
}
