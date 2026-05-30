import { success } from '../../utils/api-response.js';
import * as statsService from './stats.service.js';

export async function overview(_req, res) {
    const data = await statsService.getOverview();
    return success(res, data);
}
