import { success } from '../../utils/api-response.js';
import * as emailTemplateService from './email-template.service.js';

export async function list(req, res) {
    const { items, ...meta } = await emailTemplateService.listTemplates(req.query);
    return success(res, items, { meta });
}
export async function getById(req, res) {
    return success(res, await emailTemplateService.getTemplate(req.params.id));
}
export async function update(req, res) {
    return success(res, await emailTemplateService.updateTemplate(req.params.id, req.body), {
        message: 'Email template updated',
    });
}
