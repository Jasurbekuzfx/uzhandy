import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { createTestInitData, TelegramUser } from './telegram.js';
import { signToken } from './jwt.js';

describe('Auth routes: POST /auth/telegram and GET /me', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const testUser: TelegramUser = {
    id: 1122334455,
    first_name: 'Anvar',
    last_name: 'Sobirov',
    username: 'anvar_s',
  };

  it('to‘g‘ri initData bilan kirganda 200, JWT token va foydalanuvchini qaytaradi', async () => {
    const validInitData = createTestInitData(testUser, env.TELEGRAM_BOT_TOKEN);

    const mockDbUser = {
      id: 'usr_123',
      telegramId: BigInt(testUser.id),
      firstName: testUser.first_name,
      lastName: testUser.last_name || null,
      username: testUser.username || null,
      photoUrl: null,
      phone: null,
      role: 'CUSTOMER' as const,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      masterProfile: null,
    };

    const findSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    const upsertSpy = vi.spyOn(prisma.user, 'upsert').mockResolvedValue(mockDbUser);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: { initData: validInitData },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as { token: string; user: { id: string; firstName: string } };
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user.id).toBe('usr_123');
    expect(body.user.firstName).toBe('Anvar');

    findSpy.mockRestore();
    upsertSpy.mockRestore();
  });

  it('noto‘g‘ri yoki soxtalashtirilgan initData bilan kirganda 401 qaytaradi', async () => {
    const validInitData = createTestInitData(testUser, env.TELEGRAM_BOT_TOKEN);
    const tampered = validInitData.replace('Anvar', 'Soxta');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: { initData: tampered },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.payload) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_TELEGRAM_DATA');
  });

  it('bloklangan foydalanuvchi kirmoqchi bo‘lsa 403 USER_BLOCKED qaytaradi', async () => {
    const validInitData = createTestInitData(testUser, env.TELEGRAM_BOT_TOKEN);

    const blockedDbUser = {
      id: 'usr_blocked',
      telegramId: BigInt(testUser.id),
      firstName: testUser.first_name,
      lastName: testUser.last_name || null,
      username: testUser.username || null,
      photoUrl: null,
      phone: null,
      role: 'CUSTOMER' as const,
      isBlocked: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      masterProfile: null,
    };

    const findSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(blockedDbUser);
    const upsertSpy = vi.spyOn(prisma.user, 'upsert').mockResolvedValue(blockedDbUser);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: { initData: validInitData },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.payload) as { error: { code: string } };
    expect(body.error.code).toBe('USER_BLOCKED');

    findSpy.mockRestore();
    upsertSpy.mockRestore();
  });

  it('GET /me tokensiz chaqirilganda 401 UNAUTHORIZED qaytaradi', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/me',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.payload) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /me to‘g‘ri token bilan chaqirilganda joriy foydalanuvchini qaytaradi', async () => {
    const token = await signToken({ userId: 'usr_test_me' });

    const mockDbUser = {
      id: 'usr_test_me',
      telegramId: BigInt(99887766),
      firstName: 'Dilshod',
      lastName: null,
      username: 'dilshod',
      photoUrl: null,
      phone: null,
      role: 'CUSTOMER' as const,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      masterProfile: null,
    };

    const findSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser);

    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as { user: { id: string; firstName: string } };
    expect(body.user.id).toBe('usr_test_me');
    expect(body.user.firstName).toBe('Dilshod');

    findSpy.mockRestore();
  });
});
