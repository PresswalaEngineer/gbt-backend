import { created, noContent, success } from '../../utils/api-response.js';
import * as agentService from './agent.service.js';

export async function list(req, res) {
    const { items, ...meta } = await agentService.listAgents(req.query);
    return success(res, items, { meta });
}
export async function getById(req, res) {
    return success(res, await agentService.getAgent(req.params.id));
}
export async function create(req, res) {
    return created(res, await agentService.createAgent(req.body), { message: 'Agent created' });
}
export async function update(req, res) {
    return success(res, await agentService.updateAgent(req.params.id, req.body), { message: 'Agent updated' });
}
export async function remove(req, res) {
    await agentService.deleteAgent(req.params.id);
    return noContent(res);
}
