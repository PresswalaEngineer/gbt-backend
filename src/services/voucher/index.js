import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { loadVoucherByToken, loadVoucherById } from './data.js';
import { buildVoucherHtml } from './template.js';
import { renderVoucherPdf, closeVoucherBrowser } from './pdf.js';

export { loadVoucherByToken, loadVoucherById, closeVoucherBrowser };

// Public storefront URL for a voucher (used by the QR + email link).
export function voucherUrl(token) {
    const base = (env.STOREFRONT_URL || 'http://localhost:3001').replace(/\/$/, '');
    return `${base}/voucher/${token}`;
}

async function qrFor(booking) {
    try {
        return await QRCode.toDataURL(voucherUrl(booking.voucherToken), { margin: 1, width: 280 });
    } catch {
        return '';
    }
}

export async function buildHtmlForBooking(booking) {
    const qr = await qrFor(booking);
    return buildVoucherHtml(booking, qr);
}

export async function buildPdfForBooking(booking) {
    const html = await buildHtmlForBooking(booking);
    return renderVoucherPdf(html);
}
