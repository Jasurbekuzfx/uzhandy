import crypto from 'node:crypto';
import { z } from 'zod';

export const TelegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  photo_url: z.string().url().optional(),
});

export type TelegramUser = z.infer<typeof TelegramUserSchema>;

export class TelegramAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelegramAuthError';
  }
}

/**
 * Telegram WebApp initData ni tekshirish algoritmi (HMAC-SHA-256)
 */
export function verifyTelegramInitData(initData: string, botToken: string): TelegramUser {
  if (!initData || typeof initData !== 'string') {
    throw new TelegramAuthError('initData parametri bo‘sh bo‘lishi mumkin emas');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new TelegramAuthError('Telegram hash parametri topilmadi');
  }

  // hash dan boshqa barcha kalit-qiymatlarni saralab olish
  const entries: Array<[string, string]> = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      entries.push([key, value]);
    }
  });

  entries.sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');

  // secret = HMAC_SHA256(key="WebAppData", data=bot_token)
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

  // calculated_hash = HMAC_SHA256(key=secret, data=data_check_string)
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  // Taqqoslash crypto.timingSafeEqual bilan
  const hashBuffer = Buffer.from(hash, 'hex');
  const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

  if (
    hashBuffer.length !== calculatedBuffer.length ||
    !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)
  ) {
    throw new TelegramAuthError('Telegram imzosi yaroqsiz');
  }

  // auth_date 24 soatdan eski bo'lsa rad etish
  const authDateStr = params.get('auth_date');
  if (!authDateStr) {
    throw new TelegramAuthError('auth_date parametri topilmadi');
  }

  const authDate = parseInt(authDateStr, 10);
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 86400; // 24 soat (soniyalarda)

  if (isNaN(authDate) || now - authDate > maxAge || authDate > now + 300) {
    throw new TelegramAuthError('Telegram ma’lumotlari muddati o‘tgan yoki yaroqsiz');
  }

  // user ma'lumotlarini o'qish
  const userJson = params.get('user');
  if (!userJson) {
    throw new TelegramAuthError('Foydalanuvchi ma’lumotlari (user) topilmadi');
  }

  try {
    const rawUser = JSON.parse(userJson) as unknown;
    return TelegramUserSchema.parse(rawUser);
  } catch {
    throw new TelegramAuthError('Telegram user ma’lumotlari formati noto‘g‘ri');
  }
}

/**
 * Testlar va sinovlar uchun to'g'ri imzoli initData yasab beruvchi yordamchi funksiya
 */
export function createTestInitData(
  user: TelegramUser,
  botToken: string,
  authDate: number = Math.floor(Date.now() / 1000),
  extraParams: Record<string, string> = {},
): string {
  const params: Record<string, string> = {
    auth_date: authDate.toString(),
    user: JSON.stringify(user),
    ...extraParams,
  };

  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const searchParams = new URLSearchParams();
  for (const [k, v] of entries) {
    searchParams.set(k, v);
  }
  searchParams.set('hash', hash);

  return searchParams.toString();
}
