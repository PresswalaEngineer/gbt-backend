import { success } from '../../utils/api-response.js';
import * as searchService from './search.service.js';

export async function suggest(req, res) {
    const items = await searchService.suggest(req.query.q, req.query.limit ?? 8);
    return success(res, items);
}
