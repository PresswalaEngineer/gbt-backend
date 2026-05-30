import { created, noContent, success } from '../../utils/api-response.js';
import * as faqService from './faq.service.js';

export async function list(req, res) {
    const { items, ...meta } = await faqService.listFaqs(req.query);
    return success(res, items, { meta });
}

export async function getById(req, res) {
    const faq = await faqService.getFaq(req.params.id);
    return success(res, faq);
}

export async function create(req, res) {
    const faq = await faqService.createFaq(req.body);
    return created(res, faq, { message: 'FAQ created' });
}

export async function replace(req, res) {
    const faqs = await faqService.replaceFaqs(req.body.faqs);
    return success(res, faqs, { message: 'FAQs saved' });
}

export async function update(req, res) {
    const faq = await faqService.updateFaq(req.params.id, req.body);
    return success(res, faq, { message: 'FAQ updated' });
}

export async function remove(req, res) {
    await faqService.deleteFaq(req.params.id);
    return noContent(res);
}
