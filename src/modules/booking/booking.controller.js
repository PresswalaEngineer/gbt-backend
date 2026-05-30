import { created, noContent, success } from '../../utils/api-response.js';
import * as bookingService from './booking.service.js';
import {
    loadVoucherById,
    loadVoucherByToken,
    buildHtmlForBooking,
    buildPdfForBooking,
    voucherUrl,
} from '../../services/voucher/index.js';
import { ApiError } from '../../utils/api-error.js';
import { env } from '../../config/env.js';

export async function list(req, res) {
    const { items, summary, ...meta } = await bookingService.listBookings(req.query);
    return success(res, items, { meta: { ...meta, summary } });
}
export async function getById(req, res) {
    return success(res, await bookingService.getBooking(req.params.id));
}
export async function create(req, res) {
    return created(res, await bookingService.createBooking(req.body, { actorId: req.user?.id }), {
        message: 'Booking created',
    });
}
export async function update(req, res) {
    return success(res, await bookingService.updateBooking(req.params.id, req.body), {
        message: 'Booking updated',
    });
}
export async function cancel(req, res) {
    return success(res, await bookingService.cancelBooking(req.params.id, req.body, { actorId: req.user?.id }), {
        message: 'Booking cancelled',
    });
}
export async function confirm(req, res) {
    return success(res, await bookingService.confirmBooking(req.params.id, { actorId: req.user?.id }), {
        message: 'Booking confirmed',
    });
}
export async function recordPayment(req, res) {
    return created(res, await bookingService.recordPayment(req.params.id, req.body), {
        message: 'Payment recorded',
    });
}
export async function refund(req, res) {
    return success(res, await bookingService.refundBooking(req.params.id, req.body), {
        message: 'Refund processed',
    });
}
export async function remove(req, res) {
    await bookingService.deleteBooking(req.params.id);
    return noContent(res);
}
export async function quote(req, res) {
    return success(res, await bookingService.quote(req.body));
}

export async function createForCustomer(req, res) {
    const booking = await bookingService.createBooking(
        { ...req.body, customerId: req.customer.id },
        { actorId: null }
    );
    return created(res, booking, { message: 'Booking created' });
}

export async function listForCustomer(req, res) {
    return success(res, await bookingService.listCustomerBookings(req.customer.id));
}

export async function getForCustomer(req, res) {
    return success(res, await bookingService.getCustomerBooking(req.params.id, req.customer.id));
}

export async function cancelForCustomer(req, res) {
    const result = await bookingService.cancelCustomerBooking(req.params.id, req.customer.id, {
        reason: req.body?.reason,
    });
    return success(res, result, { message: 'Booking cancelled' });
}

function ensureVoucherReady(booking) {
    if (!(booking.paymentStatus === 'PAID' || booking.status === 'CONFIRMED')) {
        throw ApiError.badRequest('Voucher is available once payment is complete.', { code: 'VOUCHER_NOT_READY' });
    }
}

// Authenticated voucher metadata for the customer's booking screen.
export async function voucherData(req, res) {
    const b = await loadVoucherById(req.params.id, req.customer.id);
    return success(res, {
        referenceNumber: b.referenceNumber,
        voucherToken: b.voucherToken,
        voucherUrl: voucherUrl(b.voucherToken),
        status: b.status,
        paymentStatus: b.paymentStatus,
        ready: b.paymentStatus === 'PAID' || b.status === 'CONFIRMED',
    });
}

// Public voucher HTML (the canonical e-ticket — preview/print source).
export async function voucherHtml(req, res) {
    const b = await loadVoucherByToken(req.params.token);
    ensureVoucherReady(b);
    const html = await buildHtmlForBooking(b);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Allow the storefront to embed this voucher in an <iframe> (helmet defaults
    // to X-Frame-Options: SAMEORIGIN, which would block the cross-port frame).
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${env.STOREFRONT_URL}`);
    return res.send(html);
}

// Public voucher PDF (download + email attachment).
export async function voucherPdf(req, res) {
    const b = await loadVoucherByToken(req.params.token);
    ensureVoucherReady(b);
    const pdf = await buildPdfForBooking(b);
    const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="voucher-${b.referenceNumber}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
}
