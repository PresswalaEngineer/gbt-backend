import { created, noContent, success } from '../../utils/api-response.js';
import * as categoryService from './category.service.js';

export async function list(req, res) {
    const { items, ...meta } = await categoryService.listCategories(req.query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const category = await categoryService.getCategory(req.params.id);
    return success(res, category);
}

export async function create(req, res) {
    const category = await categoryService.createCategory(req.body);
    return created(res, category, { message: 'Category created' });
}

export async function update(req, res) {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    return success(res, category, { message: 'Category updated' });
}

export async function remove(req, res) {
    await categoryService.deleteCategory(req.params.id);
    return noContent(res);
}
