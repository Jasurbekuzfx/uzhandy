import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { prisma } from './db.js';

describe('GET /health', () => {
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

  it('bazaga ulanish mavjud bo‘lganda 200 va { ok: true, db: true } qaytaradi', async () => {
    const spy = vi
      .spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ '?column?': 1 }] as unknown as never);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.payload) as {
      ok: boolean;
      db: boolean;
      time: string;
    };
    expect(payload.ok).toBe(true);
    expect(payload.db).toBe(true);
    expect(typeof payload.time).toBe('string');
    expect(new Date(payload.time).toString()).not.toBe('Invalid Date');

    spy.mockRestore();
  });

  it('bazaga ulanishda xatolik bo‘lsa 503 va { ok: false, db: false } qaytaradi', async () => {
    const spy = vi
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('Database connection failed'));

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(503);

    const payload = JSON.parse(response.payload) as {
      ok: boolean;
      db: boolean;
      time: string;
      error: { code: string; message: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.db).toBe(false);
    expect(payload.error.code).toBe('DATABASE_UNAVAILABLE');

    spy.mockRestore();
  });
});
