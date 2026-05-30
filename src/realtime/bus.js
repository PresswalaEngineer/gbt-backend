import { EventEmitter } from 'node:events';

// Thin pub/sub seam so a Redis adapter can drop in later for multi-instance
// fan-out WITHOUT touching the service layer. Today it's a single-process
// EventEmitter: `publish(room, message)` is forwarded to every `onPublish`
// subscriber (the socket.io server registers one in io.js). When socket.io is
// disabled or not yet attached, there are no subscribers and publish is a no-op.
//
// To go multi-instance later: implement the same two methods backed by Redis
// pub/sub (each API instance subscribes, re-emits into its own socket.io). The
// service layer keeps calling realtime/index.js exactly as it does now.

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const CHANNEL = 'realtime:publish';

export const bus = {
    publish(room, message) {
        emitter.emit(CHANNEL, room, message);
    },
    onPublish(handler) {
        emitter.on(CHANNEL, handler);
        return () => emitter.off(CHANNEL, handler);
    },
};
