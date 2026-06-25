import 'dotenv/config';
import { z } from 'zod';

const emptyToUndefined = (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value;

const envSchema = z
    .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    API_PREFIX: z.string().default('/api/v1'),
    PUBLIC_BASE_URL: z
        .string()
        .url()
        .default('http://localhost:4000')
        .transform((value) => value.replace(/\/$/, '')),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    ENCRYPTION_KEY: z
        .string()
        .regex(/^[a-fA-F0-9]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

    CORS_ORIGINS: z
        .string()
        .default('http://localhost:3000,http://localhost:3001')
        .transform((value) =>
            value
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean)
        ),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
        .default('info'),

    TOURCMS_BASE_URL: z
        .string()
        .url()
        .default('https://api.tourcms.com')
        .transform((value) => value.replace(/\/$/, '')),
    TOURCMS_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    TOURCMS_MARKETPLACE_ID: z.coerce.number().int().nonnegative().default(0),
    TOURCMS_DEFAULT_CHANNEL_ID: z.coerce.number().int().nonnegative().default(3930),

    VENTRATA_BASE_URL: z
        .string()
        .url()
        .default('https://api.ventrata.com/octo')
        .transform((value) => value.replace(/\/$/, '')),
    VENTRATA_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    VENTRATA_OCTO_ENV: z.enum(['test', 'live']).default('test'),
    VENTRATA_OCTO_CAPABILITIES: z
        .string()
        .default('octo/content,octo/pricing,octo/pickups')
        .transform((value) =>
            value
                .split(',')
                .map((capability) => capability.trim())
                .filter(Boolean)
        ),

    STRIPE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    STRIPE_PUBLISHABLE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    STRIPE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

    GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    GOOGLE_MAPS_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

    FACEBOOK_APP_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    FACEBOOK_APP_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

    STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
    UPLOAD_LOCAL_DIR: z.string().default('uploads'),
    UPLOAD_LOCAL_PUBLIC_PATH: z
        .string()
        .default('/uploads-public')
        .transform((value) => (value.startsWith('/') ? value : `/${value}`))
        .transform((value) => value.replace(/\/$/, '')),

    R2_ACCOUNT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    R2_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    R2_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    R2_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
    R2_PUBLIC_BASE_URL: z.preprocess(
        emptyToUndefined,
        z
            .string()
            .url('R2_PUBLIC_BASE_URL must be a valid URL (custom domain or pub-*.r2.dev)')
            .transform((value) => value.replace(/\/$/, ''))
            .optional()
    ),
    R2_PRESIGN_EXPIRES_IN: z.coerce.number().int().min(60).max(3600).default(300),
    UPLOAD_MAX_SIZE_BYTES: z.coerce.number().int().positive().default(20_971_520),
    UPLOAD_ALLOWED_MIME: z
        .string()
        .default('image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf')
        .transform((value) =>
            value
                .split(',')
                .map((mime) => mime.trim())
                .filter(Boolean)
        ),

    MAIL_ENABLED: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .default('false')
        .transform((value) => value === true || value === 'true'),
    MAIL_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
    MAIL_PORT: z.coerce.number().int().positive().default(587),
    MAIL_SECURE: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .default('false')
        .transform((value) => value === true || value === 'true'),
    MAIL_USER: z.preprocess(emptyToUndefined, z.string().optional()),
    MAIL_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
    MAIL_FROM_EMAIL: z.preprocess(
        emptyToUndefined,
        z.string().email('MAIL_FROM_EMAIL must be a valid email').optional()
    ),
    MAIL_FROM_NAME: z.preprocess(emptyToUndefined, z.string().optional()),
    ALERT_DEFAULT_RECIPIENTS: z
        .string()
        .default('')
        .transform((value) =>
            value
                .split(',')
                .map((email) => email.trim())
                .filter(Boolean)
        ),
    ALERT_DAILY_REPORT_CRON: z.string().default('0 9 * * *'),
    ALERT_DAILY_REPORT_TIMEZONE: z.string().default('UTC'),
    // Minutes to wait after signup before the welcome/onboarding email is sent
    // (gives the experience a natural "settle in" delay; swept by a cron).
    ONBOARDING_EMAIL_DELAY_MINUTES: z.coerce.number().int().min(0).max(10080).default(15),
    FX_BASE_CURRENCY: z.string().trim().length(3).toUpperCase().default('USD'),
    FX_SYNC_URL: z
        .string()
        .url()
        .default('https://open.er-api.com/v6/latest/USD'),
    FX_SYNC_CRON: z.string().default('0 3 * * *'),
    FX_SYNC_ENABLED: z
        .preprocess((v) => (v === undefined ? 'true' : v), z.enum(['true', 'false']).default('true'))
        .transform((v) => v === 'true'),

    STOREFRONT_URL: z
        .string()
        .url()
        .default('http://localhost:3001')
        .transform((value) => value.replace(/\/$/, '')),

    CART_HOLD_MINUTES: z.coerce.number().int().positive().default(20),
    CART_SWEEP_CRON: z.string().default('* * * * *'),
    BOOKING_RECONCILE_CRON: z.string().default('*/5 * * * *'),
    SOCKET_IO_ENABLED: z
        .preprocess((v) => (v === undefined ? 'true' : v), z.enum(['true', 'false']).default('true'))
        .transform((v) => v === 'true'),
    })
    .superRefine((data, ctx) => {
        if (data.STORAGE_DRIVER !== 'r2') return;
        const required = [
            'R2_ACCOUNT_ID',
            'R2_ACCESS_KEY_ID',
            'R2_SECRET_ACCESS_KEY',
            'R2_BUCKET',
            'R2_PUBLIC_BASE_URL',
        ];
        for (const key of required) {
            if (!data[key]) {
                ctx.addIssue({
                    path: [key],
                    code: z.ZodIssueCode.custom,
                    message: `${key} is required when STORAGE_DRIVER=r2`,
                });
            }
        }
    });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
