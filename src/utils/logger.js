import pino from 'pino';
import { env, isProd } from '../config/env.js';

export const logger = pino({
    level: env.LOG_LEVEL,
    base: { service: 'gbt-api' },
    redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
        remove: true,
    },
    ...(isProd
        ? {}
        : {
              transport: {
                  target: 'pino-pretty',
                  options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service' },
              },
          }),
});
