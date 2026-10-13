import { describe, it, expect } from 'vitest';
import {
  verifyTelegramInitData,
  createTestInitData,
  TelegramAuthError,
  TelegramUser,
} from './telegram.js';

describe('Telegram initData verification', () => {
  const TEST_BOT_TOKEN = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
  const testUser: TelegramUser = {
    id: 987654321,
    first_name: 'Sherzod',
    last_name: 'Karimov',
    username: 'sherzod_k',
  };

  it('to‘g‘ri imzoli initData muvaffaqiyatli tekshiriladi va foydalanuvchini qaytaradi', () => {
    const validInitData = createTestInitData(testUser, TEST_BOT_TOKEN);
    const result = verifyTelegramInitData(validInitData, TEST_BOT_TOKEN);

    expect(result.id).toBe(testUser.id);
    expect(result.first_name).toBe(testUser.first_name);
    expect(result.last_name).toBe(testUser.last_name);
    expect(result.username).toBe(testUser.username);
  });

  it('o‘zgartirilgan (tampered) initData rad etiladi', () => {
    const validInitData = createTestInitData(testUser, TEST_BOT_TOKEN);
    // Malumotni qo'lda o'zgartiramiz (masalan boshqa foydalanuvchi qilib qo'yish)
    const tamperedInitData = validInitData.replace('Sherzod', 'Hacker');

    expect(() => {
      verifyTelegramInitData(tamperedInitData, TEST_BOT_TOKEN);
    }).toThrow(TelegramAuthError);
  });

  it('eskirgan (>24 soat) initData rad etiladi', () => {
    const twentyFiveHoursAgo = Math.floor(Date.now() / 1000) - 25 * 3600;
    const expiredInitData = createTestInitData(testUser, TEST_BOT_TOKEN, twentyFiveHoursAgo);

    expect(() => {
      verifyTelegramInitData(expiredInitData, TEST_BOT_TOKEN);
    }).toThrow('Telegram ma’lumotlari muddati o‘tgan yoki yaroqsiz');
  });

  it('hash parametri bo‘lmagan initData rad etiladi', () => {
    const noHashInitData = `user=${encodeURIComponent(JSON.stringify(testUser))}&auth_date=${Math.floor(Date.now() / 1000)}`;

    expect(() => {
      verifyTelegramInitData(noHashInitData, TEST_BOT_TOKEN);
    }).toThrow('Telegram hash parametri topilmadi');
  });

  it('bo‘sh yoki matn bo‘lmagan initData rad etiladi', () => {
    expect(() => {
      verifyTelegramInitData('', TEST_BOT_TOKEN);
    }).toThrow('initData parametri bo‘sh bo‘lishi mumkin emas');
  });
});
