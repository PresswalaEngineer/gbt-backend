import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from '../../config/env.js';

// Official Global Bus Tours logo, embedded as a base64 data URI so it renders
// reliably inside the Puppeteer PDF + email attachment (no network fetch).
const __dirname = dirname(fileURLToPath(import.meta.url));
let LOGO_DATA_URI = '';
try {
    LOGO_DATA_URI = `data:image/png;base64,${readFileSync(join(__dirname, 'assets', 'logo.png')).toString('base64')}`;
} catch {
    LOGO_DATA_URI = '';
}

// Canonical voucher HTML — clean, single-page, print-friendly e-ticket.
// No emojis (inline SVG icons), compact so the footer never orphans, and a
// Google static map pin for the meeting point. Single source for the on-screen
// preview, the PDF (Puppeteer) and the email attachment.

const TIER_LABELS = {
    ADULT: 'Adult', CHILD: 'Child', INFANT: 'Infant', SENIOR: 'Senior', FAMILY: 'Family',
    PAX_1: 'Traveller', PAX_2: 'Travellers (2)', PAX_3: 'Travellers (3)',
    CHILD_WITH_BED: 'Child (with bed)', CHILD_WITHOUT_BED: 'Child (no bed)',
};

const esc = (s) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Minimal inline SVG icon set (16px, inherits color via currentColor).
const ICON = {
    calendar: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    users: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    cross: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
    card: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    help: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></svg>',
    route: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h0"/></svg>',
};

function longDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function shortDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function money(amount, currency) {
    const n = Number(amount) || 0;
    try {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (currency || 'USD').toUpperCase() }).format(n);
    } catch {
        return `${(currency || '').toUpperCase()} ${n.toFixed(2)}`;
    }
}
function paxSummary(paxBreakdown) {
    const entries = Object.entries(paxBreakdown || {}).filter(([, n]) => Number(n) > 0);
    if (!entries.length) return '—';
    return entries.map(([tier, n]) => `${n} ${TIER_LABELS[tier] || tier}`).join(' · ');
}
function listItems(text, cap) {
    if (!text) return [];
    const items = String(text).split(/\r?\n|;|•/).map((s) => s.trim()).filter(Boolean);
    return cap ? items.slice(0, cap) : items;
}

function titleCase(s) {
    return String(s ?? '')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}

// Real payment method + status from the recorded payment (no invented data).
function paymentLabel(b) {
    const p = (b.payments || [])[0];
    const method = p?.provider ? (/stripe/i.test(p.provider) ? 'Card (Stripe)' : titleCase(p.provider)) : null;
    const status = b.paymentStatus === 'PAID' ? 'Paid' : titleCase(b.paymentStatus);
    if (method) return `${method}${status ? ` · ${status}` : ''}`;
    return status || '—';
}

// Ordered, de-duplicated list of every place the tour stops (boarding → stops → drop-off).
function routeStops(tour) {
    const seen = new Set();
    const stops = [];
    const add = (label, value) => {
        if (!value) return;
        const key = String(value).trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        stops.push({ label, value });
    };
    add('Boarding point', tour.meetingPoint);
    (tour.meetingPoints || []).forEach((m, i) => add(`Stop ${i + 1}`, m));
    add('Drop-off point', tour.endingPoint);
    return stops;
}

function staticMapUrl(meetingPoint, location) {
    const key = env.GOOGLE_MAPS_API_KEY;
    if (!key || !meetingPoint) return null;
    const query = encodeURIComponent([meetingPoint, location].filter(Boolean).join(', '));
    return `https://maps.googleapis.com/maps/api/staticmap?size=620x180&scale=2&maptype=roadmap` +
        `&markers=color:0xC8102E%7C${query}&key=${key}`;
}

function infoCell(icon, label, value) {
    return `<div class="cell"><div class="k">${ICON[icon]}<span>${esc(label)}</span></div><div class="v">${esc(value)}</div></div>`;
}

export function buildVoucherHtml(b, qrDataUrl = '') {
    const tour = b.tour || {};
    const paid = b.paymentStatus === 'PAID' || b.status === 'CONFIRMED';
    const statusLabel = b.status === 'CONFIRMED' || paid ? 'CONFIRMED' : 'PENDING CONFIRMATION';
    const highlights = listItems(tour.highlights, 4);
    const inc = listItems(tour.inclusions, 6);
    const exc = listItems(tour.exclusions, 6);
    const notes = listItems(tour.importantNotes, 4);
    const location = [tour.city?.name, tour.country?.name].filter(Boolean).join(', ');
    const voucherType = tour.voucherType === 'PRINTED' ? 'Printed voucher' : 'Mobile voucher';
    const mapUrl = staticMapUrl(tour.meetingPoint, location);
    const stops = routeStops(tour);
    const payLabel = paymentLabel(b);
    const operator = b.supplier || {};
    const helpEmail = operator.bookingEmail || operator.contractContactEmail || 'globalbustours@gmail.com';
    const helpPhone = operator.contractContactPhone || operator.financeContactPhone || '';

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Voucher ${esc(b.referenceNumber)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#eef0f4}
  body{font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:#23272f;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:13px;-webkit-font-smoothing:antialiased}
  .sheet{max-width:820px;margin:18px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.07)}
  .hdr{background:#c8102e;color:#fff;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;gap:14px}
  .brand{display:flex;align-items:center;gap:11px}
  .brand .logobox{background:#fff;border-radius:9px;padding:7px 13px;display:inline-flex;align-items:center}
  .brand .logobox img{height:30px;width:auto;display:block}
  .brand .logo{width:40px;height:40px;border-radius:9px;background:#fff;color:#c8102e;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px}
  .brand h1{font-size:17px;letter-spacing:.4px;line-height:1.1}
  .brand p{font-size:9.5px;opacity:.85;letter-spacing:1.6px;margin-top:2px}
  .hdr .right{text-align:right}
  .hdr .right .lbl{font-size:9px;letter-spacing:1.6px;opacity:.85}
  .hdr .right .ref{font-size:16px;font-weight:700;margin-top:1px}
  .hdr .right .issued{font-size:10px;opacity:.85;margin-top:4px}
  .stripe{height:5px;background:repeating-linear-gradient(90deg,#f4b400 0 13px,#1f2430 13px 26px)}
  .body{padding:18px 22px}
  .badges{display:flex;gap:7px;margin-bottom:10px}
  .badge{font-size:10px;font-weight:700;padding:4px 9px;border-radius:5px;letter-spacing:.4px}
  .badge.green{background:#eafaf0;color:#16a34a;border:1px solid #c7eed6}
  .badge.dark{background:#1f2430;color:#fff}
  .title{font-size:21px;font-weight:700;line-height:1.2;margin-bottom:3px}
  .subtitle{color:#6b7280;font-size:12px;margin-bottom:14px}
  .top{display:flex;gap:18px;align-items:center}
  .grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:11px 14px}
  .cell .k{font-size:9px;letter-spacing:.6px;color:#9aa0aa;text-transform:uppercase;display:flex;align-items:center;gap:5px}
  .cell .k svg{color:#c8102e}
  .cell .v{font-size:13.5px;font-weight:700;margin-top:2px}
  .qrbox{text-align:center;width:118px;flex-shrink:0}
  .qrbox img{width:112px;height:112px;border:1px solid #eee;border-radius:7px}
  .qrbox .cap{font-size:8px;letter-spacing:.8px;color:#9aa0aa;margin-top:4px;text-transform:uppercase}
  .qrbox .qref{font-size:10px;font-weight:700;margin-top:1px}
  .map{margin-top:14px;border:1px solid #eef0f3;border-radius:9px;overflow:hidden}
  .map .mh{display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:12px;font-weight:600;color:#1f2430;border-bottom:1px solid #f0f1f3}
  .map .mh svg{color:#c8102e}
  .map img{width:100%;height:150px;object-fit:cover;display:block}
  .cols{display:flex;gap:24px;margin-top:14px}
  .col{flex:1}
  .col h4{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#6b7280;margin-bottom:7px}
  .col ul{list-style:none}
  .col li{font-size:12px;color:#374151;padding:2.5px 0;display:flex;gap:7px;align-items:flex-start;line-height:1.3}
  .col li svg{margin-top:2px;flex-shrink:0}
  .pay{display:flex;gap:18px;margin-top:14px;align-items:flex-end}
  .know{flex:1;font-size:11px;color:#6b7280;line-height:1.45}
  .know .kh{display:flex;align-items:center;gap:5px;font-weight:700;color:#1f2430;margin-bottom:4px;font-size:11.5px}
  .totals{width:250px;flex-shrink:0;background:#fafbfc;border:1px solid #eef0f3;border-radius:9px;padding:11px 13px}
  .totals .row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:#4b5563}
  .totals .row.total{border-top:1px solid #e5e7eb;margin-top:5px;padding-top:7px;font-size:15px;font-weight:700;color:#1f2430}
  .totals .prow{margin-top:7px;padding-top:7px;border-top:1px dashed #e5e7eb;font-size:11px;color:#6b7280;text-align:right}
  .stops{margin-top:14px;border:1px solid #eef0f3;border-radius:9px;padding:11px 14px}
  .stops .sh{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#1f2430;margin-bottom:8px}
  .stops .sh svg{color:#c8102e}
  .stops ol{list-style:none}
  .stops li{display:flex;gap:10px;align-items:flex-start;padding:3px 0;position:relative}
  .stops li .dot{width:9px;height:9px;border-radius:50%;background:#c8102e;margin-top:4px;flex-shrink:0;box-shadow:0 0 0 3px rgba(200,16,46,.12)}
  .stops li:not(:last-child)::before{content:"";position:absolute;left:4px;top:13px;bottom:-3px;width:1px;background:#e5d2d6}
  .stops .sl{display:block;font-size:9px;letter-spacing:.5px;text-transform:uppercase;color:#9aa0aa}
  .stops .sv{display:block;font-size:12.5px;font-weight:600;color:#374151}
  .stops ul.hl{list-style:none}
  .stops ul.hl li{display:flex;gap:7px;align-items:flex-start;font-size:12px;color:#374151;padding:2px 0;line-height:1.3}
  .stops ul.hl li svg{margin-top:2px;flex-shrink:0}
  .help{margin-top:14px;background:#fafbfc;border:1px solid #eef0f3;border-radius:9px;padding:11px 14px}
  .help .kh{display:flex;align-items:center;gap:5px;font-weight:700;color:#1f2430;font-size:11.5px;margin-bottom:7px}
  .help .kh svg{color:#c8102e}
  .help .hrow{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:11.5px;color:#4b5563}
  .help .hrow span{display:inline-flex;align-items:center;gap:5px}
  .help .hrow svg{color:#c8102e}
  .help .hrow a{color:#c8102e;text-decoration:none}
  .ftr{padding:12px 22px;background:#1f2430;color:#cbd2dc;font-size:10px;text-align:center;line-height:1.5}
  .ftr b{color:#fff}
  @media (max-width:560px){.grid{grid-template-columns:1fr}.top{flex-direction:column-reverse;align-items:stretch}.qrbox{margin:0 auto}.cols,.pay{flex-direction:column;gap:14px}.totals{width:100%}}
  @media print{html,body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:100%;border-radius:0}}
</style></head>
<body><div class="sheet">
  <div class="hdr">
    <div class="brand">
      ${LOGO_DATA_URI
        ? `<span class="logobox"><img src="${LOGO_DATA_URI}" alt="Global Bus Tours"/></span>`
        : `<div class="logo">GB</div><div><h1>GLOBAL BUS TOURS</h1><p>SEE THE WORLD, ONE STOP AT A TIME</p></div>`}
    </div>
    <div class="right">
      <div class="lbl">BOOKING ${paid ? 'CONFIRMATION' : 'RECEIPT'}</div>
      <div class="ref">${esc(b.referenceNumber)}</div>
      <div class="issued">Issued ${shortDate(b.createdAt)}</div>
    </div>
  </div>
  <div class="stripe"></div>
  <div class="body">
    <div class="badges">
      <span class="badge green">E-TICKET · ${statusLabel}</span>
      <span class="badge dark">${esc(voucherType)}</span>
    </div>
    <div class="title">${esc(tour.name)}</div>
    <div class="subtitle">${esc(tour.description ? String(tour.description).slice(0, 120) : location)}</div>

    <div class="top">
      <div class="grid">
        ${infoCell('calendar', 'Travel date', longDate(b.travelDate))}
        ${infoCell('clock', 'Start time', b.startTime || (tour.startTimes && tour.startTimes[0]) || 'See operator')}
        ${infoCell('users', 'Passengers', paxSummary(b.paxBreakdown))}
        ${infoCell('ticket', 'Lead passenger', b.leadGuestName)}
        ${infoCell('ticket', 'Booking reference', b.referenceNumber)}
      </div>
      <div class="qrbox">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR"/>` : ''}
        <div class="cap">SCAN AT BOARDING</div>
        <div class="qref">${esc(b.referenceNumber)}</div>
      </div>
    </div>

    ${tour.meetingPoint ? `<div class="map">
      <div class="mh">${ICON.pin}<span>Meeting point — ${esc(tour.meetingPoint)}${location ? `, ${esc(location)}` : ''}</span></div>
      ${mapUrl ? `<img src="${mapUrl}" alt="Meeting point map"/>` : ''}
    </div>` : ''}

    ${stops.length ? `<div class="stops">
      <div class="sh">${ICON.route}<span>Route &amp; stops</span></div>
      <ol>${stops.map((s) => `<li><span class="dot"></span><div><span class="sl">${esc(s.label)}</span><span class="sv">${esc(s.value)}</span></div></li>`).join('')}</ol>
    </div>` : ''}

    ${highlights.length ? `<div class="stops">
      <div class="sh">${ICON.info}<span>Tour highlights</span></div>
      <ul class="hl">${highlights.map((h) => `<li>${ICON.check}<span>${esc(h)}</span></li>`).join('')}</ul>
    </div>` : ''}

    ${inc.length || exc.length ? `<div class="cols">
      ${inc.length ? `<div class="col"><h4>What's included</h4><ul>${inc.map((i) => `<li>${ICON.check}<span>${esc(i)}</span></li>`).join('')}</ul></div>` : ''}
      ${exc.length ? `<div class="col"><h4>Not included</h4><ul>${exc.map((i) => `<li>${ICON.cross}<span>${esc(i)}</span></li>`).join('')}</ul></div>` : ''}
    </div>` : ''}

    <div class="pay">
      <div class="know">
        <div class="kh">${ICON.info}<span>Good to know before you board</span></div>
        <div>• Bring this voucher (PDF or QR) to the boarding point.</div>
        ${notes.map((n) => `<div>• ${esc(n)}</div>`).join('')}
        ${tour.cancellationPolicy ? `<div>• ${esc(String(tour.cancellationPolicy).slice(0, 110))}</div>` : ''}
        ${b.supplier?.name ? `<div>• Operated by ${esc(b.supplier.name)}${b.externalRef ? ` · supplier ref ${esc(b.externalRef)}` : ''}</div>` : ''}
        <div>• This is your travel voucher, not a payment receipt — your receipt is sent separately and is available under My Bookings.</div>
      </div>
    </div>

    <div class="help">
      <div class="kh">${ICON.help}<span>Need help?</span></div>
      <div class="hrow">
        <span>${ICON.info}<a href="mailto:${esc(helpEmail)}">${esc(helpEmail)}</a></span>
        ${helpPhone ? `<span>${ICON.clock}${esc(helpPhone)}</span>` : ''}
        <span>${ICON.pin}globalbustours.com</span>
        ${b.leadGuestEmail ? `<span>${ICON.ticket}Booked by ${esc(b.leadGuestEmail)}</span>` : ''}
      </div>
    </div>
  </div>
  <div class="ftr">
    <b>GLOBAL BUS TOURS</b> · ${esc(helpEmail)} · globalbustours.com<br/>
    Use of this voucher constitutes acceptance of our Terms &amp; Privacy Policy. Non-transferable. Lead passenger ID may be required at boarding.
  </div>
</div></body></html>`;
}
