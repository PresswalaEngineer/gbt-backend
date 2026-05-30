import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { verifyAccessToken } from '../utils/token.js';
import { bus } from './bus.js';
import { EVENTS, CLIENT_EVENTS, ownerRoom, tourDateRoom, serverNow } from './events.js';
import { getCart } from '../modules/reservation/reservation.service.js';

let io = null;
let unsubscribe = null;

function ownerFromHandshake(socket) {
    const { token, guestId } = socket.handshake.auth ?? {};
    if (token) {
        try {
            const payload = verifyAccessToken(token);
            if (payload.type === 'customer') {
                return { ownerType: 'CUSTOMER', ownerId: String(payload.sub) };
            }
        } catch {
            // fall through to guest
        }
    }
    if (typeof guestId === 'string' && guestId.trim()) {
        return { ownerType: 'GUEST', ownerId: guestId.trim() };
    }
    return null;
}

export function createRealtime(httpServer) {
    if (io) return io;
    io = new Server(httpServer, {
        path: '/socket.io',
        cors: { origin: env.CORS_ORIGINS, credentials: true },
    });

    io.use((socket, next) => {
        const owner = ownerFromHandshake(socket);
        if (!owner) return next(new Error('UNAUTHENTICATED_SOCKET'));
        socket.data.owner = owner;
        next();
    });

    io.on('connection', (socket) => {
        const owner = socket.data.owner;
        socket.join(ownerRoom(owner));

        socket.on(CLIENT_EVENTS.SUBSCRIBE_AVAILABILITY, ({ tourId, date } = {}) => {
            if (tourId && date) socket.join(tourDateRoom(tourId, date));
        });
        socket.on(CLIENT_EVENTS.UNSUBSCRIBE_AVAILABILITY, ({ tourId, date } = {}) => {
            if (tourId && date) socket.leave(tourDateRoom(tourId, date));
        });
        socket.on(CLIENT_EVENTS.CART_RESYNC, async () => {
            try {
                const snap = await getCart(owner);
                socket.emit(EVENTS.CART_SYNCED, {
                    items: snap.items,
                    holdExpiresAt: snap.holdExpiresAt,
                    serverNow: serverNow(),
                });
            } catch (err) {
                logger.warn({ err: err?.message }, 'cart:resync failed');
            }
        });
    });

    // Forward every bus publish to the matching socket.io room. This is the seam
    // a Redis adapter replaces for multi-instance fan-out.
    unsubscribe = bus.onPublish((room, message) => {
        io.to(room).emit(message.event, message.payload);
    });

    logger.info('realtime (socket.io) attached');
    return io;
}

export function getIo() {
    return io;
}

export function closeRealtime() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    if (io) {
        io.close();
        io = null;
    }
}
