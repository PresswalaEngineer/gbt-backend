// Standalone PAYMENT RECEIPT (kept deliberately separate from the travel
// voucher). Renders the financial record only: what was charged, how, and when.
// Self-contained inline CSS, print/PDF friendly, single page.

const RED = '#c8102e';
const INK = '#1f2430';
const MUTE = '#6b7280';

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function titleCase(s) {
    return String(s || '').replace(/\b\w/g, (m) => m.toUpperCase());
}
const NO_DECIMAL = new Set(['JPY', 'INR', 'KRW', 'VND', 'IDR', 'HUF', 'CLP']);
const SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'AED ', JPY: '¥', CHF: 'CHF ', CNY: '¥' };
function money(amount, currency) {
    const code = String(currency || 'USD').toUpperCase();
    const n = Number(amount) || 0;
    const val = NO_DECIMAL.has(code) ? Math.round(n).toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const sym = SYMBOLS[code] || `${code} `;
    return `${sym}${val}`;
}
function longDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; }
}

// Build the payment receipt HTML from a fully-loaded booking (with payments[]).
export function buildReceiptHtml(b) {
    const payment = (b.payments || []).find((p) => !p.isRefund) || (b.payments || [])[0] || null;
    // What the customer was actually charged: the display-currency amount frozen
    // at checkout, falling back to the native booking total.
    const paidCurrency = (b.paymentCurrency || b.currency || 'USD').toUpperCase();
    const paidAmount = b.paymentAmount != null ? Number(b.paymentAmount) : Number(b.totalAmount);
    const method = payment?.provider ? (/stripe/i.test(payment.provider) ? 'Card (Stripe)' : titleCase(payment.provider)) : 'Card';
    const txnRef = b.paymentIntentId || payment?.providerRef || b.referenceNumber;
    const paidOn = payment?.createdAt || b.updatedAt || b.createdAt;
    const tour = b.tour || {};
    const location = [tour.city?.name, tour.country?.name].filter(Boolean).join(', ');
    // Display the breakdown in the same currency it was charged in.
    const sameCcy = paidCurrency === String(b.currency || '').toUpperCase();
    const showBreakdown = sameCcy && Number(b.grossAmount) > 0;

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Payment receipt ${esc(b.referenceNumber)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};background:#fff;font-size:13px;line-height:1.5}
  .wrap{max-width:720px;margin:0 auto;padding:28px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${RED};padding-bottom:16px}
  .brand{font-size:20px;font-weight:800;color:${RED};letter-spacing:.3px}
  .brand small{display:block;font-size:11px;font-weight:500;color:${MUTE};letter-spacing:1.5px;text-transform:uppercase;margin-top:3px}
  .doc{text-align:right}
  .doc h1{font-size:16px;letter-spacing:2px;text-transform:uppercase;color:${INK}}
  .doc .r{font-size:12px;color:${MUTE};margin-top:4px}
  .meta{display:flex;gap:40px;margin:22px 0 8px}
  .meta .blk{font-size:12px}
  .meta .lbl{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${MUTE};margin-bottom:3px}
  .meta .val{font-weight:600;color:${INK};font-size:13px}
  table{width:100%;border-collapse:collapse;margin:18px 0}
  thead th{text-align:left;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${MUTE};border-bottom:1px solid #e5e7eb;padding:8px 0}
  thead th.r,tbody td.r{text-align:right}
  tbody td{padding:11px 0;border-bottom:1px solid #f1f2f5;vertical-align:top}
  .tname{font-weight:600}
  .tsub{font-size:11px;color:${MUTE};margin-top:2px}
  .totals{margin-left:auto;width:280px;margin-top:6px}
  .totals .row{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;color:#4b5563}
  .totals .row.total{border-top:2px solid ${INK};margin-top:6px;padding-top:9px;font-size:16px;font-weight:800;color:${INK}}
  .paid{display:inline-block;background:#e7f7ee;color:#157a45;font-weight:700;font-size:11px;letter-spacing:.6px;text-transform:uppercase;padding:5px 11px;border-radius:20px;margin-top:14px}
  .paybox{margin-top:18px;background:#fafbfc;border:1px solid #eef0f3;border-radius:10px;padding:14px 16px}
  .paybox .kv{display:flex;justify-content:space-between;font-size:12px;padding:3px 0}
  .paybox .kv span:first-child{color:${MUTE}}
  .foot{margin-top:26px;border-top:1px solid #eef0f3;padding-top:14px;font-size:11px;color:${MUTE};text-align:center}
</style></head>
<body><div class="wrap">
  <div class="head">
    <div class="brand">Global Bus Tours<small>Booking &amp; Payment Receipt</small></div>
    <div class="doc"><h1>Receipt</h1><div class="r">No. ${esc(b.referenceNumber)}</div><div class="r">${esc(longDate(paidOn))}</div></div>
  </div>

  <div class="meta">
    <div class="blk"><div class="lbl">Billed to</div><div class="val">${esc(b.leadGuestName || '—')}</div><div class="r" style="font-size:12px;color:${MUTE}">${esc(b.leadGuestEmail || '')}</div></div>
    <div class="blk"><div class="lbl">Payment status</div><div class="val">${esc(b.paymentStatus === 'PAID' ? 'Paid' : titleCase(b.paymentStatus || 'Pending'))}</div></div>
    <div class="blk"><div class="lbl">Booking reference</div><div class="val">${esc(b.referenceNumber)}</div></div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td><div class="tname">${esc(tour.name || 'Tour booking')}</div><div class="tsub">${esc(location)}${b.travelDate ? ` · Travel date ${esc(longDate(b.travelDate))}` : ''}${b.paxCount ? ` · ${esc(b.paxCount)} traveller(s)` : ''}</div></td>
        <td class="r">${esc(money(showBreakdown ? b.grossAmount : paidAmount, showBreakdown ? b.currency : paidCurrency))}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    ${showBreakdown ? `<div class="row"><span>Subtotal</span><span>${esc(money(b.grossAmount, b.currency))}</span></div>
    ${Number(b.discountAmount) > 0 ? `<div class="row"><span>Discount${b.couponCode ? ` (${esc(b.couponCode)})` : ''}</span><span>− ${esc(money(b.discountAmount, b.currency))}</span></div>` : ''}
    <div class="row"><span>Taxes &amp; fees</span><span>Included</span></div>` : ''}
    <div class="row total"><span>Total paid</span><span>${esc(money(paidAmount, paidCurrency))}</span></div>
  </div>

  <div class="paybox">
    <div class="kv"><span>Payment method</span><span>${esc(method)}</span></div>
    <div class="kv"><span>Transaction reference</span><span>${esc(txnRef)}</span></div>
    <div class="kv"><span>Amount charged</span><span>${esc(money(paidAmount, paidCurrency))}</span></div>
    <div class="kv"><span>Date</span><span>${esc(longDate(paidOn))}</span></div>
  </div>
  <span class="paid">${b.paymentStatus === 'PAID' ? 'Payment received' : esc(titleCase(b.paymentStatus || 'Pending'))}</span>

  <div class="foot">
    This receipt confirms the payment for the booking above. Your travel voucher (e-ticket) is a separate document.<br/>
    Global Bus Tours · globalbustours.com · ${esc(b.leadGuestEmail || '')}
  </div>
</div></body></html>`;
}
