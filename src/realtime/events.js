// Single source of truth for the WebSocket event contract.
// Every payload carries `serverNow` (epoch ms) so clients render countdowns
// from server truth, correcting for clock skew.

export const EVENTS = {
    HOLD_CREATED: 'hold:created',
    HOLD_UPDATED: 'hold:updated',
    HOLD_EXPIRING_SOON: 'hold:expiring-soon',
    HOLD_EXPIRED: 'hold:expired',
    CART_SYNCED: 'cart:synced',
    AVAILABILITY_CHANGED: 'availability:changed',
};

// Client → server requests.
export const CLIENT_EVENTS = {
    SUBSCRIBE_AVAILABILITY: 'subscribe:availability',
    UNSUBSCRIBE_AVAILABILITY: 'unsubscribe:availability',
    CART_RESYNC: 'cart:resync',
};

export function ownerRoom(owner) {
    return `owner:${owner.ownerType}:${owner.ownerId}`;
}

export function tourDateRoom(tourId, date) {
    return `tourdate:${tourId}:${date}`;
}

export function serverNow() {
    return Date.now();
}
