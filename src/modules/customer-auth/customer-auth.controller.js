import { isProd } from '../../config/env.js';
import { parseDurationToMs } from '../../utils/token.js';
import { env } from '../../config/env.js';
import { created, success, noContent } from '../../utils/api-response.js';
import * as customerAuthService from './customer-auth.service.js';

const REFRESH_COOKIE = 'gbt_customer_refresh_token';

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

export async function register(req, res) {
    const { accessToken, refreshToken, customer } = await customerAuthService.register(
        req.body,
        getRequestMeta(req)
    );
    setRefreshCookie(res, refreshToken);
    return created(res, { accessToken, customer }, { message: 'Account created' });
}

export async function login(req, res) {
    const { accessToken, refreshToken, customer } = await customerAuthService.login(
        req.body,
        getRequestMeta(req)
    );
    setRefreshCookie(res, refreshToken);
    return success(res, { accessToken, customer }, { message: 'Logged in' });
}

export async function google(req, res) {
    const { accessToken, refreshToken, customer } = await customerAuthService.googleLogin(
        req.body,
        getRequestMeta(req)
    );
    setRefreshCookie(res, refreshToken);
    return success(res, { accessToken, customer }, { message: 'Logged in with Google' });
}

export async function facebook(req, res) {
    const { accessToken, refreshToken, customer } = await customerAuthService.facebookLogin(
        req.body,
        getRequestMeta(req)
    );
    setRefreshCookie(res, refreshToken);
    return success(res, { accessToken, customer }, { message: 'Logged in with Facebook' });
}

export async function refresh(req, res) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? null;
    const result = await customerAuthService.refresh(refreshToken, getRequestMeta(req));
    setRefreshCookie(res, result.refreshToken);
    return success(res, { accessToken: result.accessToken, customer: result.customer });
}

export async function logout(req, res) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? null;
    await customerAuthService.logout(refreshToken);
    clearRefreshCookie(res);
    return noContent(res);
}

export async function me(req, res) {
    const customer = await customerAuthService.getCurrent(req.customer.id);
    return success(res, customer);
}

export async function updateProfile(req, res) {
    const customer = await customerAuthService.updateProfile(req.customer.id, req.body);
    return success(res, customer, { message: 'Profile updated' });
}
