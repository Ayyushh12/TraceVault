import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
    level,
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
    serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
    },
});
