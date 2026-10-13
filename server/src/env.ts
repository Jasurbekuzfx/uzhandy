import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_APP_URL: z
    .string()
    .url("WEB_APP_URL to'g'ri URL formati bo'lishi shart (masalan, http://localhost:5173)")
    .default('http://localhost:5173'),
  DATABASE_URL:
    process.env.NODE_ENV === 'test'
      ? z.string().default('postgresql://postgres:postgres@localhost:5432/ustatop_test')
      : z.string().min(1, "DATABASE_URL ko'rsatilishi shart"),
  DIRECT_URL:
    process.env.NODE_ENV === 'test'
      ? z.string().default('postgresql://postgres:postgres@localhost:5432/ustatop_test')
      : z.string().min(1, "DIRECT_URL ko'rsatilishi shart"),
  TELEGRAM_BOT_TOKEN:
    process.env.NODE_ENV === 'test'
      ? z.string().default('123456789:TEST_BOT_TOKEN_FOR_TESTING_ONLY_XYZ')
      : z.string().min(1, "TELEGRAM_BOT_TOKEN ko'rsatilishi shart"),
  JWT_SECRET:
    process.env.NODE_ENV === 'test'
      ? z.string().default('test_jwt_secret_must_be_at_least_32_characters_long!')
      : z.string().min(32, "JWT_SECRET kamida 32 ta belgidan iborat bo'lishi shart"),
  ADMIN_TELEGRAM_IDS: z.string().default(''),
  SUPABASE_URL:
    process.env.NODE_ENV === 'test'
      ? z.string().url().default('https://xyzcompany.supabase.co')
      : z.string().url("SUPABASE_URL to'g'ri URL formati bo'lishi shart"),
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.NODE_ENV === 'test'
      ? z.string().default('test_service_role_key_for_testing_purposes')
      : z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY ko'rsatilishi shart"),
  STORAGE_BUCKET: z.string().default('request-photos'),
  TELEGRAM_WEBHOOK_SECRET:
    process.env.NODE_ENV === 'test'
      ? z.string().default('test_webhook_secret_for_tests_only_32_chars')
      : process.env.NODE_ENV === 'production'
        ? z.string().min(1, "TELEGRAM_WEBHOOK_SECRET ko'rsatilishi shart")
        : z.string().default('dev_webhook_secret_placeholder_32_chars'),
  PUBLIC_SERVER_URL:
    process.env.NODE_ENV === 'test'
      ? z.string().url().default('http://localhost:3001')
      : process.env.NODE_ENV === 'production'
        ? z.string().url("PUBLIC_SERVER_URL to'g'ri URL formati bo'lishi shart")
        : z.string().url().default('http://localhost:3001'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Xatolik: Server muhit o'zgaruvchilari (env) yaroqsiz yoki yetishmayapti:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  throw new Error("Server muhit o'zgaruvchilarini tekshirishda xatolik yuz berdi");
}

export const env = {
  ...parsed.data,
  adminTelegramIds: parsed.data.ADMIN_TELEGRAM_IDS.split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => BigInt(id)),
};

export type Env = typeof env;

if (!process.env.DATABASE_URL && env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}
if (!process.env.DIRECT_URL && env.DIRECT_URL) {
  process.env.DIRECT_URL = env.DIRECT_URL;
}
