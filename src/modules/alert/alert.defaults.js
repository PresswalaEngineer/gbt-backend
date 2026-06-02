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
];

const baseHtml = (title, body) =>
    `<!doctype html><html><body style="font-family:Arial,sans-serif;padding:24px;color:#202124;background:#f8f9fb">` +
    `<table cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eaecef">` +
    `<tr><td style="padding:20px 24px;border-bottom:1px solid #eaecef;background:#c8102e;color:#fff;font-weight:bold;font-size:16px">${title}</td></tr>` +
    `<tr><td style="padding:24px;font-size:14px;line-height:1.6">${body}</td></tr>` +
    `<tr><td style="padding:14px 24px;border-top:1px solid #eaecef;font-size:12px;color:#6b7280;background:#fafbfc">— Global Bus Tour</td></tr>` +
    `</table></body></html>`;

export const DEFAULT_TEMPLATES = {
    BOOKING_CONFIRMATION: {
        name: 'Booking Confirmation',
        subject: 'Your booking is confirmed — {{referenceNumber}}',
        bodyHtml: baseHtml(
            'Booking Confirmed 🎉',
            `<p>Hi {{leadGuestName}},</p>` +
                `<p>Great news — your booking is confirmed. Your e-voucher is attached to this email and can also be downloaded any time from the button below.</p>` +
                `<table cellspacing="0" cellpadding="0" style="width:100%;margin:16px 0;border:1px solid #eaecef;border-radius:8px">` +
                `<tr><td style="padding:8px 14px;color:#6b7280;font-size:12px">Booking reference</td><td style="padding:8px 14px;text-align:right;font-weight:bold">{{referenceNumber}}</td></tr>` +
                `<tr><td style="padding:8px 14px;color:#6b7280;font-size:12px;border-top:1px solid #f0f1f3">Tour</td><td style="padding:8px 14px;text-align:right;border-top:1px solid #f0f1f3">{{tourName}}</td></tr>` +
                `<tr><td style="padding:8px 14px;color:#6b7280;font-size:12px;border-top:1px solid #f0f1f3">Travel date</td><td style="padding:8px 14px;text-align:right;border-top:1px solid #f0f1f3">{{travelDate}}{{startTime}}</td></tr>` +
                `<tr><td style="padding:8px 14px;color:#6b7280;font-size:12px;border-top:1px solid #f0f1f3">Travellers</td><td style="padding:8px 14px;text-align:right;border-top:1px solid #f0f1f3">{{paxCount}}</td></tr>` +
                `<tr><td style="padding:8px 14px;color:#6b7280;font-size:12px;border-top:1px solid #f0f1f3">Meeting point</td><td style="padding:8px 14px;text-align:right;border-top:1px solid #f0f1f3">{{meetingPoint}}</td></tr>` +
                `<tr><td style="padding:8px 14px;color:#6b7280;font-size:12px;border-top:1px solid #f0f1f3">Total paid</td><td style="padding:8px 14px;text-align:right;font-weight:bold;border-top:1px solid #f0f1f3">{{totalAmount}} {{currency}}</td></tr>` +
                `</table>` +
                `<p style="text-align:center;margin:22px 0"><a href="{{voucherUrl}}" style="background:#c8102e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">Download your voucher</a></p>` +
                `<p style="color:#6b7280;font-size:13px">Present the voucher (PDF or QR) at the meeting point. Have a wonderful trip!</p>`
        ),
        placeholders: ['leadGuestName', 'referenceNumber', 'tourName', 'travelDate', 'startTime', 'paxCount', 'meetingPoint', 'totalAmount', 'currency', 'voucherUrl'],
        description: 'Sent to the customer after a booking is confirmed (with the voucher PDF attached).',
    },
    PAYMENT_FAILURE: {
        name: 'Payment Failure',
        subject: 'Payment failed for booking {{referenceNumber}}',
        bodyHtml: baseHtml(
            'Payment Failed',
            `<p>Booking <b>{{referenceNumber}}</b> for <b>{{leadGuestName}}</b> failed to capture payment.</p>` +
                `<p><b>Reason:</b> {{reason}}</p><p><b>Amount:</b> {{amount}} {{currency}}</p>`
        ),
        placeholders: ['referenceNumber', 'leadGuestName', 'reason', 'amount', 'currency'],
        description: 'Admin alert when a booking payment fails.',
    },
    DAILY_BOOKINGS_REPORT: {
        name: 'Daily Bookings Report',
        subject: 'Daily Bookings — {{date}}',
        bodyHtml: baseHtml(
            'Daily Bookings Report',
            `<p>Bookings for <b>{{date}}</b>:</p>` +
                `<ul><li>Confirmed: <b>{{confirmedCount}}</b></li>` +
                `<li>Cancelled: <b>{{cancelledCount}}</b></li>` +
                `<li>Pending: <b>{{pendingCount}}</b></li>` +
                `<li>Total revenue: <b>{{revenue}}</b></li></ul>`
        ),
        placeholders: ['date', 'confirmedCount', 'cancelledCount', 'pendingCount', 'revenue'],
        description: 'Daily summary email scheduled via cron.',
    },
    NEW_AGENT_SIGNUP: {
        name: 'New Agent Signup',
        subject: 'New agent signup — {{name}}',
        bodyHtml: baseHtml(
            'New Agent Signup',
            `<p>A new agent has signed up:</p>` +
                `<p><b>Name:</b> {{name}}<br/><b>Email:</b> {{email}}<br/><b>Company:</b> {{companyName}}</p>` +
                `<p>Review and approve in the admin panel.</p>`
        ),
        placeholders: ['name', 'email', 'companyName'],
        description: 'Admin alert when a new agent signs up.',
    },
    NEW_SUPPLIER_CREATED: {
        name: 'New Supplier Created',
        subject: 'New supplier added — {{name}}',
        bodyHtml: baseHtml(
            'New Supplier',
            `<p>A new supplier has been added to the system:</p>` +
                `<p><b>Name:</b> {{name}}<br/><b>Country:</b> {{country}}<br/><b>Booking email:</b> {{bookingEmail}}</p>`
        ),
        placeholders: ['name', 'country', 'bookingEmail'],
        description: 'Admin alert when a new supplier is created.',
    },
    NEW_COUPON_CREATED: {
        name: 'New Coupon Created',
        subject: 'New coupon — {{code}}',
        bodyHtml: baseHtml(
            'New Coupon',
            `<p>A new coupon has been created:</p>` +
                `<p><b>Code:</b> {{code}}<br/><b>Name:</b> {{name}}</p>`
        ),
        placeholders: ['code', 'name'],
        description: 'Admin alert when a new coupon is added.',
    },
    COUPON_EXPIRED: {
        name: 'Coupon Expired',
        subject: 'Coupon expired — {{code}}',
        bodyHtml: baseHtml(
            'Coupon Expired',
            `<p>The coupon <b>{{code}}</b> ({{name}}) has expired on <b>{{endDate}}</b>.</p>`
        ),
        placeholders: ['code', 'name', 'endDate'],
        description: 'Admin alert when a coupon reaches its end date.',
    },
    BOOKING_CANCELLED: {
        name: 'Booking Cancelled',
        subject: 'Your booking has been cancelled — {{referenceNumber}}',
        bodyHtml: baseHtml(
            'Booking Cancelled',
            `<p>Hi {{leadGuestName}},</p>` +
                `<p>Your booking <b>{{referenceNumber}}</b> for <b>{{tourName}}</b> on <b>{{travelDate}}</b> has been cancelled.</p>` +
                `<table cellspacing="0" cellpadding="0" style="width:100%;margin:14px 0;border:1px solid #eaecef;border-radius:8px">` +
                `<tr><td style="padding:8px 14px;color:#6b7280;font-size:12px">Refund amount</td><td style="padding:8px 14px;text-align:right;font-weight:bold">{{refundAmount}} {{currency}}</td></tr>` +
                `</table>` +
                `<p>{{refundNote}}</p>` +
                `<p>We hope to welcome you on another journey soon.</p>`
        ),
        placeholders: ['leadGuestName', 'referenceNumber', 'tourName', 'travelDate', 'refundAmount', 'currency', 'refundNote'],
        description: 'Sent to the customer when a booking is cancelled (with refund details).',
    },
    VENDOR_DISPATCH_FAILED: {
        name: 'Vendor Dispatch Failed',
        subject: 'ACTION NEEDED — supplier booking failed for {{referenceNumber}}',
        bodyHtml: baseHtml(
            'Supplier Booking Failed',
            `<p>Payment was captured but the supplier booking could not be confirmed automatically. This booking needs manual reconciliation.</p>` +
                `<p><b>Reference:</b> {{referenceNumber}}<br/>` +
                `<b>Tour:</b> {{tourName}}<br/>` +
                `<b>Supplier:</b> {{provider}}<br/>` +
                `<b>Lead guest:</b> {{leadGuestName}} ({{leadGuestEmail}})<br/>` +
                `<b>Travel date:</b> {{travelDate}}<br/>` +
                `<b>Status from vendor:</b> {{vendorStatus}}</p>` +
                `<p>The booking is held as <b>paid, pending confirmation</b> and will be retried automatically. You can also confirm it manually from the admin booking screen.</p>`
        ),
        placeholders: ['referenceNumber', 'tourName', 'provider', 'leadGuestName', 'leadGuestEmail', 'travelDate', 'vendorStatus'],
        description: 'Ops alert when a paid booking fails to dispatch to the supplier (TourCMS/Ventrata).',
    },
    WELCOME_ONBOARDING: {
        name: 'Welcome / Onboarding',
        subject: 'Welcome to Global Bus Tours, {{name}}! 🌍',
        bodyHtml: baseHtml(
            'Welcome aboard 🚌',
            `<p>Hi {{name}},</p>` +
                `<p>Thanks for creating your Global Bus Tours account — we're thrilled to have you. You're all set to discover unforgettable city tours, skip-the-line attractions and multi-day adventures across the globe.</p>` +
                `<p>Here's how to get the most out of your account:</p>` +
                `<ul style="padding-left:18px;margin:12px 0">` +
                `<li style="margin-bottom:6px">💛 Save tours to your <b>wishlist</b> and come back to them any time</li>` +
                `<li style="margin-bottom:6px">🛒 Reserve seats instantly with a live hold timer — pay when you're ready</li>` +
                `<li style="margin-bottom:6px">🎫 Get instant e-vouchers with QR codes for every booking</li>` +
                `</ul>` +
                `<p style="text-align:center;margin:24px 0"><a href="{{exploreUrl}}" style="background:#c8102e;color:#fff;text-decoration:none;padding:12px 30px;border-radius:8px;font-weight:bold;display:inline-block">Explore tours</a></p>` +
                `<p style="color:#6b7280;font-size:13px">Questions? Just reply to this email — our team is here to help. Happy travels!</p>`
        ),
        placeholders: ['name', 'email', 'exploreUrl'],
        description: 'Welcome email sent to a customer a short while after they create their account (first signup).',
    },
};
