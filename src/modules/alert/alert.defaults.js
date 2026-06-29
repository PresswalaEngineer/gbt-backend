export const ALERT_TYPES = [
    'BOOKING_CONFIRMATION',
    'PAYMENT_FAILURE',
    'DAILY_BOOKINGS_REPORT',
    'NEW_AGENT_SIGNUP',
    'NEW_SUPPLIER_CREATED',
    'NEW_COUPON_CREATED',
    'COUPON_EXPIRED',
    'VENDOR_DISPATCH_FAILED',
    'BOOKING_CANCELLED',
    'WELCOME_ONBOARDING',
    'DEPARTURE_REMINDER',
    'SUPPLIER_BOOKING_NOTIFY',
];

// ── Brand design tokens ──────────────────────────────────────────────────────
const RED = '#c8102e';
const RED2 = '#e63950';
const INK = '#15181f';
const BODY = '#3a4150';
const MUTE = '#6b7280';

// Real (non-AI) tour/bus hero photos, cropped to a 600×210 banner. Hosted on a
// public CDN so they render in every email client.
const HERO = {
    bus: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&h=420&q=80',
    coach: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&h=420&q=80',
    road: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&h=420&q=80',
};

// Gradient CTA button.
const button = (label, href) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:26px auto 4px">` +
    `<tr><td align="center" style="border-radius:11px;background:${RED};background:linear-gradient(135deg,${RED} 0%,${RED2} 100%);box-shadow:0 8px 18px rgba(200,16,46,.32)">` +
    `<a href="${href}" target="_blank" style="display:inline-block;padding:15px 38px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">${label} &rarr;</a>` +
    `</td></tr></table>`;

// Striped key/value detail card with an accent header. rows: [['Label','Value'], …]
const infoCard = (rows, heading = 'Booking details') =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #ececf1;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(20,23,40,.05)">` +
    `<tr><td colspan="2" style="padding:12px 16px;background:linear-gradient(135deg,${RED} 0%,${RED2} 100%);color:#fff;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">${heading}</td></tr>` +
    rows
        .map(
            (r, i) =>
                `<tr style="background:${i % 2 ? '#fafbfc' : '#ffffff'}">` +
                `<td style="padding:12px 16px;color:${MUTE};font-size:12.5px;border-top:1px solid #f0f1f3">${r[0]}</td>` +
                `<td style="padding:12px 16px;text-align:right;color:${INK};font-weight:700;font-size:13.5px;border-top:1px solid #f0f1f3">${r[1]}</td>` +
                `</tr>`
        )
        .join('') +
    `</table>`;

// Immersive hero header: full-bleed image with a brand→ink gradient scrim, the
// logo (white pill) + status badge floating on top, and the title/subtitle
// overlaid at the bottom. Falls back to a solid ink bg in clients that drop
// background images (Outlook).
const heroHeader = (title, { hero, badge, badgeColor = '#16a34a', subtitle }) =>
    `<tr><td background="${hero}" bgcolor="${INK}" valign="bottom" style="background-image:url('${hero}');background-size:cover;background-position:center center;background-color:${INK}">` +
    // Heavier bottom scrim so the overlaid title always reads cleanly regardless
    // of what's in the photo. Brand-red tint up top → near-solid ink at the base.
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg, rgba(200,16,46,.40) 0%, rgba(21,24,31,.30) 34%, rgba(21,24,31,.78) 72%, rgba(21,24,31,.97) 100%)">` +
    `<tr>` +
    `<td valign="top" style="padding:22px 28px 0"><span style="display:inline-block;background:#ffffff;border-radius:10px;padding:8px 13px"><img src="cid:gbtlogo" alt="Global Bus Tours" height="28" style="height:28px;width:auto;display:block;border:0"/></span></td>` +
    (badge
        ? `<td align="right" valign="top" style="padding:26px 28px 0"><span style="display:inline-block;background:${badgeColor};color:#fff;font-size:10.5px;font-weight:700;letter-spacing:1.2px;padding:6px 13px;border-radius:999px">${badge}</span></td>`
        : `<td></td>`) +
    `</tr>` +
    `<tr><td colspan="2" style="padding:104px 28px 26px"><h1 style="margin:0;color:#ffffff;font-size:27px;line-height:1.2;font-weight:800;text-shadow:0 2px 16px rgba(0,0,0,.75)">${title}</h1>` +
    (subtitle ? `<p style="margin:10px 0 0;color:rgba(255,255,255,.92);font-size:14px;font-weight:500;text-shadow:0 1px 12px rgba(0,0,0,.8)">${subtitle}</p>` : '') +
    `</td></tr>` +
    `</table></td></tr>`;

// Solid gradient header (for internal/admin alerts that don't need imagery).
const plainHeader = (title) =>
    `<tr><td align="center" style="background:${RED};background:linear-gradient(135deg,${RED} 0%,${RED2} 100%);padding:30px 28px 32px">` +
    `<span style="display:inline-block;background:#ffffff;border-radius:11px;padding:10px 16px;margin-bottom:16px"><img src="cid:gbtlogo" alt="Global Bus Tours" height="34" style="height:34px;width:auto;display:block;border:0"/></span>` +
    `<h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;line-height:1.25;font-weight:800;text-shadow:0 1px 8px rgba(0,0,0,.2)">${title}</h1>` +
    `</td></tr>`;

// Branded email shell. The title lives in the header (overlaid on the hero when
// `opts.hero` is set); the body is content only. opts: { hero, badge, badgeColor, subtitle }.
const baseHtml = (title, body, opts = {}) =>
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:#eceff5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceff5;padding:26px 12px"><tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(20,23,40,.16)">` +
    (opts.hero ? heroHeader(title, opts) : plainHeader(title)) +
    `<tr><td style="padding:28px 34px 32px;font-size:15px;line-height:1.65;color:${BODY}">${body}</td></tr>` +
    `<tr><td align="center" style="background:${INK};padding:26px 34px">` +
    `<p style="margin:0 0 6px;color:#ffffff;font-weight:700;font-size:15px;letter-spacing:.4px">GLOBAL BUS TOURS</p>` +
    `<p style="margin:0;color:#9aa1b0;font-size:12px;line-height:1.7">See the world, one stop at a time.<br/>Questions? Just reply to this email — we're happy to help.</p>` +
    `</td></tr>` +
    `</table>` +
    `<p style="color:#9aa1b0;font-size:11px;margin:16px auto 0;max-width:560px">© Global Bus Tours · You're receiving this because of an account or booking with us.</p>` +
    `</td></tr></table></body></html>`;

const greet = (name) => `<p style="margin:0 0 14px">Hi <b>${name}</b>,</p>`;
const note = (text) => `<p style="margin:14px 0 0;color:${MUTE};font-size:13px">${text}</p>`;

export const DEFAULT_TEMPLATES = {
    BOOKING_CONFIRMATION: {
        name: 'Booking Confirmation',
        subject: 'Your booking is confirmed — {{referenceNumber}}',
        bodyHtml: baseHtml(
            'Your booking is confirmed 🎉',
            greet('{{leadGuestName}}') +
                `<p style="margin:0 0 4px">Great news — your booking is all set and your e‑voucher is attached to this email. Here's your trip at a glance:</p>` +
                infoCard([
                    ['Booking reference', '{{referenceNumber}}'],
                    ['Tour', '{{tourName}}'],
                    ['Travel date', '{{travelDate}}{{startTime}}'],
                    ['Travellers', '{{paxCount}}'],
                    ['Meeting point', '{{meetingPoint}}'],
                    ['Total paid', '{{totalAmount}} {{currency}}'],
                ]) +
                button('Download your voucher', '{{voucherUrl}}') +
                note('Present the voucher (PDF or QR) at the meeting point. Have a wonderful trip!'),
            { hero: HERO.bus, badge: 'CONFIRMED', badgeColor: '#16a34a', subtitle: '{{tourName}}' }
        ),
        placeholders: ['leadGuestName', 'referenceNumber', 'tourName', 'travelDate', 'startTime', 'paxCount', 'meetingPoint', 'totalAmount', 'currency', 'voucherUrl'],
        description: 'Sent to the customer after a booking is confirmed (with the voucher PDF attached).',
    },
    DEPARTURE_REMINDER: {
        name: 'Departure Reminder (24h)',
        subject: 'Your tour is tomorrow — {{tourName}} ({{referenceNumber}})',
        bodyHtml: baseHtml(
            'See you soon 🚌',
            greet('{{leadGuestName}}') +
                `<p style="margin:0 0 4px">A friendly reminder that your tour departs in about <b>24 hours</b>. Everything you need is below:</p>` +
                infoCard([
                    ['Tour', '{{tourName}}'],
                    ['Date', '{{travelDate}}{{startTime}}'],
                    ['Travellers', '{{paxCount}}'],
                    ['Meeting point', '{{meetingPoint}}'],
                    ['Reference', '{{referenceNumber}}'],
                ], 'Your trip') +
                button('View your voucher', '{{voucherUrl}}') +
                note('Please arrive 15 minutes early and bring your voucher (PDF or QR). Safe travels!'),
            { hero: HERO.coach, badge: 'DEPARTS IN 24H', badgeColor: '#f59e0b', subtitle: '{{tourName}} · {{travelDate}}' }
        ),
        placeholders: ['leadGuestName', 'tourName', 'travelDate', 'startTime', 'paxCount', 'meetingPoint', 'referenceNumber', 'voucherUrl'],
        description: 'Reminder email sent to the customer ~24 hours before their tour departs.',
    },
    WELCOME_ONBOARDING: {
        name: 'Welcome / Onboarding',
        subject: 'Welcome to Global Bus Tours, {{name}}! 🌍',
        bodyHtml: baseHtml(
            'Welcome aboard 🚌',
            greet('{{name}}') +
                `<p style="margin:0 0 10px">Thanks for creating your account — we're thrilled to have you. You're all set to discover unforgettable city tours, skip‑the‑line attractions and multi‑day adventures across the globe.</p>` +
                `<p style="margin:0 0 6px;font-weight:700;color:${INK}">Here's what you can do:</p>` +
                `<ul style="padding-left:18px;margin:8px 0 0">` +
                `<li style="margin-bottom:7px">Save tours to your <b>wishlist</b> and pick up right where you left off</li>` +
                `<li style="margin-bottom:7px">Reserve seats instantly with a live hold timer — pay when you're ready</li>` +
                `<li style="margin-bottom:7px">Get instant e‑vouchers with a QR code for every booking</li>` +
                `</ul>` +
                button('Explore tours', '{{exploreUrl}}') +
                note('Questions? Just reply to this email — our team is here to help. Happy travels!'),
            { hero: HERO.road, badge: 'WELCOME', badgeColor: RED, subtitle: 'Your account is ready' }
        ),
        placeholders: ['name', 'email', 'exploreUrl'],
        description: 'Welcome email sent to a customer a short while after they create their account (first signup).',
    },
    BOOKING_CANCELLED: {
        name: 'Booking Cancelled',
        subject: 'Your booking has been cancelled — {{referenceNumber}}',
        bodyHtml: baseHtml(
            'Your booking was cancelled',
            greet('{{leadGuestName}}') +
                `<p style="margin:0 0 4px">Your booking <b>{{referenceNumber}}</b> for <b>{{tourName}}</b> on <b>{{travelDate}}</b> has been cancelled.</p>` +
                infoCard([['Refund amount', '{{refundAmount}} {{currency}}']], 'Refund') +
                `<p style="margin:0">{{refundNote}}</p>` +
                note('We hope to welcome you on another journey soon.'),
            { hero: HERO.coach, badge: 'CANCELLED', badgeColor: '#6b7280', subtitle: '{{referenceNumber}}' }
        ),
        placeholders: ['leadGuestName', 'referenceNumber', 'tourName', 'travelDate', 'refundAmount', 'currency', 'refundNote'],
        description: 'Sent to the customer when a booking is cancelled (with refund details).',
    },
    PAYMENT_FAILURE: {
        name: 'Payment Failure',
        subject: 'Payment failed for booking {{referenceNumber}}',
        bodyHtml: baseHtml(
            'Payment failed',
            `<p style="margin:0 0 4px">A payment could not be captured for the booking below.</p>` +
                infoCard([
                    ['Reference', '{{referenceNumber}}'],
                    ['Lead guest', '{{leadGuestName}}'],
                    ['Reason', '{{reason}}'],
                    ['Amount', '{{amount}} {{currency}}'],
                ], 'Payment')
        ),
        placeholders: ['referenceNumber', 'leadGuestName', 'reason', 'amount', 'currency'],
        description: 'Admin alert when a booking payment fails.',
    },
    DAILY_BOOKINGS_REPORT: {
        name: 'Daily Bookings Report',
        subject: 'Daily Bookings — {{date}}',
        bodyHtml: baseHtml(
            'Daily bookings report',
            `<p style="margin:0 0 4px">Summary for <b>{{date}}</b>:</p>` +
                infoCard([
                    ['Confirmed', '{{confirmedCount}}'],
                    ['Cancelled', '{{cancelledCount}}'],
                    ['Pending', '{{pendingCount}}'],
                    ['Total revenue', '{{revenue}}'],
                ], 'Summary')
        ),
        placeholders: ['date', 'confirmedCount', 'cancelledCount', 'pendingCount', 'revenue'],
        description: 'Daily summary email scheduled via cron.',
    },
    NEW_AGENT_SIGNUP: {
        name: 'New Agent Signup',
        subject: 'New agent signup — {{name}}',
        bodyHtml: baseHtml(
            'New agent signup',
            `<p style="margin:0 0 4px">A new agent has signed up and is awaiting review:</p>` +
                infoCard([['Name', '{{name}}'], ['Email', '{{email}}'], ['Company', '{{companyName}}']], 'Agent') +
                note('Review and approve them in the admin panel.')
        ),
        placeholders: ['name', 'email', 'companyName'],
        description: 'Admin alert when a new agent signs up.',
    },
    NEW_SUPPLIER_CREATED: {
        name: 'New Supplier Created',
        subject: 'New supplier added — {{name}}',
        bodyHtml: baseHtml(
            'New supplier added',
            `<p style="margin:0 0 4px">A new supplier has been added to the system:</p>` +
                infoCard([['Name', '{{name}}'], ['Country', '{{country}}'], ['Booking email', '{{bookingEmail}}']], 'Supplier')
        ),
        placeholders: ['name', 'country', 'bookingEmail'],
        description: 'Admin alert when a new supplier is created.',
    },
    NEW_COUPON_CREATED: {
        name: 'New Coupon Created',
        subject: 'New coupon — {{code}}',
        bodyHtml: baseHtml(
            'New coupon created',
            `<p style="margin:0 0 4px">A new coupon is now live:</p>` +
                infoCard([['Code', '{{code}}'], ['Name', '{{name}}']], 'Coupon')
        ),
        placeholders: ['code', 'name'],
        description: 'Admin alert when a new coupon is added.',
    },
    COUPON_EXPIRED: {
        name: 'Coupon Expired',
        subject: 'Coupon expired — {{code}}',
        bodyHtml: baseHtml(
            'Coupon expired',
            `<p style="margin:0 0 4px">A coupon has reached its end date:</p>` +
                infoCard([['Code', '{{code}}'], ['Name', '{{name}}'], ['Expired on', '{{endDate}}']], 'Coupon')
        ),
        placeholders: ['code', 'name', 'endDate'],
        description: 'Admin alert when a coupon reaches its end date.',
    },
    VENDOR_DISPATCH_FAILED: {
        name: 'Vendor Dispatch Failed',
        subject: 'ACTION NEEDED — supplier booking failed for {{referenceNumber}}',
        bodyHtml: baseHtml(
            'Supplier booking failed',
            `<p style="margin:0 0 4px">Payment was captured but the supplier booking could not be confirmed automatically. This one needs manual reconciliation.</p>` +
                infoCard([
                    ['Reference', '{{referenceNumber}}'],
                    ['Tour', '{{tourName}}'],
                    ['Supplier', '{{provider}}'],
                    ['Lead guest', '{{leadGuestName}} ({{leadGuestEmail}})'],
                    ['Travel date', '{{travelDate}}'],
                    ['Vendor status', '{{vendorStatus}}'],
                ], 'Booking') +
                note('The booking is held as paid, pending confirmation, and will be retried automatically. You can also confirm it manually from the admin booking screen.')
        ),
        placeholders: ['referenceNumber', 'tourName', 'provider', 'leadGuestName', 'leadGuestEmail', 'travelDate', 'vendorStatus'],
        description: 'Ops alert when a paid booking fails to dispatch to the supplier (TourCMS/Ventrata).',
    },
    SUPPLIER_BOOKING_NOTIFY: {
        name: 'Supplier Booking Notification',
        subject: 'New booking {{referenceNumber}} — {{tourName}} on {{travelDate}}',
        bodyHtml: baseHtml(
            'You have a new booking',
            `<p style="margin:0 0 4px">Hi {{supplierName}}, a new confirmed booking has been made for one of your tours. Please arrange to fulfil it.</p>` +
                infoCard([
                    ['Reference', '{{referenceNumber}}'],
                    ['Tour', '{{tourName}}'],
                    ['Travel date', '{{travelDate}}'],
                    ['Start time', '{{startTime}}'],
                    ['Passengers', '{{paxCount}}'],
                    ['Lead guest', '{{leadGuestName}}'],
                    ['Guest email', '{{leadGuestEmail}}'],
                    ['Guest phone', '{{leadGuestPhone}}'],
                ], 'Booking details') +
                note('This booking was made and paid on Global Bus Tours. Please confirm availability and prepare for the guest on the travel date.')
        ),
        placeholders: ['supplierName', 'referenceNumber', 'tourName', 'travelDate', 'startTime', 'paxCount', 'leadGuestName', 'leadGuestEmail', 'leadGuestPhone'],
        description: 'Sent to the supplier’s booking email when a manually-operated tour is booked.',
    },
};
