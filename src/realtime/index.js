import { bus } from './bus.js';
import { EVENTS, ownerRoom, tourDateRoom, serverNow } from './events.js';

// Public emit API used by services. No socket.io import here — emits go through
// the bus, so importing this file never pulls socket.io. If the socket server
// isn't attached (disabled / not installed), the bus has no subscribers and
// these calls are harmless no-ops; the cron sweep remains the durable backstop.

export { EVENTS, ownerRoom, tourDateRoom, serverNow } from './events.js';

export function emitToOwner(owner, event, payload = {}) {
    if (!owner?.ownerType || owner?.ownerId == null) return;
    bus.publish(ownerRoom(owner), { event, payload: { ...payload, serverNow: serverNow() } });
}

export function emitToTourDate(tourId, date, event, payload = {}) {
    if (!tourId || !date) return;
    bus.publish(tourDateRoom(tourId, date), { event, payload: { ...payload, serverNow: serverNow() } });
}

export function emitAvailabilityChanged(tourId, date, remaining) {
    emitToTourDate(tourId, date, EVENTS.AVAILABILITY_CHANGED, { tourId, date, remaining });
}
