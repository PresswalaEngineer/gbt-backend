// Payment receipt builder — reuses the voucher's data loaders + Puppeteer
// renderer, but renders the separate receipt template.
import { loadVoucherByToken, loadVoucherById } from '../voucher/data.js';
import { renderVoucherPdf } from '../voucher/pdf.js';
import { buildReceiptHtml } from './template.js';

export { loadVoucherByToken as loadReceiptByToken, loadVoucherById as loadReceiptById };

export function buildReceiptHtmlForBooking(booking) {
    return buildReceiptHtml(booking);
}

export async function buildReceiptPdf(booking) {
    return renderVoucherPdf(buildReceiptHtml(booking));
}
