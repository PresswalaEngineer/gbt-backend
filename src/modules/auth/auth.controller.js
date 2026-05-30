import { isProd } from '../../config/env.js';
import { parseDurationToMs } from '../../utils/token.js';
import { env } from '../../config/env.js';
import { created, success, noContent } from '../../utils/api-response.js';
import * as authService from './auth.service.js';

const REFRESH_COOKIE = 'gbt_refresh_token';

function getRequestMeta(req) {
    return {
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
    };
}

function setRefreshCookie(res, token) {
    res.cookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
    });
}

function clearRefreshCookie(res) {
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export async function login(req, res) {
    const { accessToken, refreshToken, staff } = await authService.login(req.body, getRequestMeta(req));
    setRefreshCookie(res, refreshToken);
    return success(res, { accessToken, staff }, { message: 'Logged in' });
}

export async function signup(req, res) {
    const { accessToken, refreshToken, staff } = await authService.signup(req.body, getRequestMeta(req));
    setRefreshCookie(res, refreshToken);
    return created(res, { accessToken, staff }, { message: 'Account created' });
}

export async function refresh(req, res) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? null;
    const result = await authService.refresh(refreshToken, getRequestMeta(req));
    setRefreshCookie(res, result.refreshToken);
    return success(res, { accessToken: result.accessToken, staff: result.staff });
}

export async function logout(req, res) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? null;
    await authService.logout(refreshToken);
    clearRefreshCookie(res);
    return noContent(res);
}

export async function me(req, res) {
    const staff = await authService.getCurrent(req.user.id);
    return success(res, staff);
}

export async function adminCreateStaff(req, res) {
    const { staff } = await authService.signup(req.body, getRequestMeta(req));
    return created(res, staff, { message: 'Staff created' });
}
