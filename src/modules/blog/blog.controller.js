import { created, noContent, success } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';
import * as blogService from './blog.service.js';

function ensurePublicVisible(req, blog) {
    if (req.user) return blog;
    if (!blog || blog.status !== 'PUBLISHED') throw ApiError.notFound('Blog post not found');
    return blog;
}

export async function list(req, res) {
    const query = req.user ? req.query : { ...req.query, status: 'PUBLISHED' };
    const { items, ...meta } = await blogService.listBlogs(query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const blog = await blogService.getBlog(req.params.id);
    return success(res, ensurePublicVisible(req, blog));
}

export async function getBySlug(req, res) {
    const blog = await blogService.getBlogBySlug(req.params.slug);
    return success(res, ensurePublicVisible(req, blog));
}

export async function create(req, res) {
    const blog = await blogService.createBlog(req.body, { actorId: req.user?.id });
    return created(res, blog, { message: 'Blog post created' });
}

export async function update(req, res) {
    const blog = await blogService.updateBlog(req.params.id, req.body, { actorId: req.user?.id });
    return success(res, blog, { message: 'Blog post updated' });
}

export async function remove(req, res) {
    await blogService.deleteBlog(req.params.id);
    return noContent(res);
}
