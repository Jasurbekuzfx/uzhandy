import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Decimal } from '@prisma/client/runtime/library';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { signToken } from '../auth/jwt.js';

describe('Master routes: /services, /districts, /master/apply', () => {
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

  it('GET /services faol xizmatlar ro‘yxatini qaytaradi', async () => {
    const mockServices = [
      { id: 'srv_1', slug: 'santexnika', nameUz: 'Santexnika', isActive: true },
      { id: 'srv_2', slug: 'elektrik', nameUz: 'Elektrik', isActive: true },
    ];
    const spy = vi.spyOn(prisma.service, 'findMany').mockResolvedValue(mockServices);

    const response = await app.inject({
      method: 'GET',
      url: '/services',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as { services: Array<{ slug: string }> };
    expect(body.services.length).toBe(2);
    expect(body.services[0]?.slug).toBe('santexnika');

    spy.mockRestore();
  });

  it('GET /districts tumanlar ro‘yxatini qaytaradi', async () => {
    const mockDistricts = [
      { id: 'dst_1', nameUz: 'Chilonzor' },
      { id: 'dst_2', nameUz: 'Yunusobod' },
    ];
    const spy = vi.spyOn(prisma.district, 'findMany').mockResolvedValue(mockDistricts);

    const response = await app.inject({
      method: 'GET',
      url: '/districts',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as { districts: Array<{ nameUz: string }> };
    expect(body.districts.length).toBe(2);

    spy.mockRestore();
  });

  it('raqamsiz foydalanuvchi ariza yubora olmaydi (400 PHONE_REQUIRED)', async () => {
    const token = await signToken({ userId: 'usr_no_phone' });

    const userWithoutPhone = {
      id: 'usr_no_phone',
      telegramId: BigInt(11111),
      firstName: 'Bekzod',
      lastName: null,
      username: 'bekzod',
      photoUrl: null,
      phone: null, // TELEFONI YO'Q
      role: 'CUSTOMER' as const,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      masterProfile: null,
    };

    const findSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithoutPhone);

    const response = await app.inject({
      method: 'POST',
      url: '/master/apply',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        bio: 'Santexnika bo‘yicha tajribali mutaxassisman, sifatli ishlayman.',
        experienceYears: 5,
        serviceIds: ['srv_1'],
        districtIds: ['dst_1'],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload) as { error: { code: string } };
    expect(body.error.code).toBe('PHONE_REQUIRED');

    findSpy.mockRestore();
  });

  it('4 ta xizmat tanlanganda 400 VALIDATION_ERROR qaytaradi (maksimal 3 ta)', async () => {
    const token = await signToken({ userId: 'usr_with_phone' });

    const userWithPhone = {
      id: 'usr_with_phone',
      telegramId: BigInt(22222),
      firstName: 'Akmal',
      lastName: null,
      username: 'akmal',
      photoUrl: null,
      phone: '+998901234567',
      role: 'CUSTOMER' as const,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      masterProfile: null,
    };

    const findSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithPhone);

    const response = await app.inject({
      method: 'POST',
      url: '/master/apply',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        bio: 'Santexnika va boshqa sohalarda 10 yillik tajribaga egaman.',
        experienceYears: 10,
        serviceIds: ['srv_1', 'srv_2', 'srv_3', 'srv_4'], // 4 ta xizmat (limitdan ko'p)
        districtIds: ['dst_1'],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');

    findSpy.mockRestore();
  });

  it('to‘g‘ri ma’lumotlar bilan usta arizasi yuborilganda 201 va PENDING status bilan yaratiladi', async () => {
    const token = await signToken({ userId: 'usr_valid_master' });

    const user = {
      id: 'usr_valid_master',
      telegramId: BigInt(33333),
      firstName: 'Nodir',
      lastName: 'Alimov',
      username: 'nodir_a',
      photoUrl: null,
      phone: '+998909876543',
      role: 'CUSTOMER' as const,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      masterProfile: null,
    };

    const userFindSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user);

    const servicesFindSpy = vi.spyOn(prisma.service, 'findMany').mockResolvedValue([
      { id: 'srv_1', slug: 'santexnika', nameUz: 'Santexnika', isActive: true },
    ]);

    const districtsFindSpy = vi.spyOn(prisma.district, 'findMany').mockResolvedValue([
      { id: 'dst_1', nameUz: 'Chilonzor' },
    ]);

    const profileFindSpy = vi.spyOn(prisma.masterProfile, 'findUnique').mockResolvedValue(null);

    const profileCreateSpy = vi.spyOn(prisma.masterProfile, 'create').mockResolvedValue({
      id: 'mp_1',
      userId: user.id,
      bio: 'Santexnika bo‘yicha tajribali usta xizmat ko‘rsatadi.',
      experienceYears: 7,
      status: 'PENDING',
      rejectReason: null,
      ratingAvg: new Decimal(0),
      ratingCount: 0,
      completedCount: 0,
      createdAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/master/apply',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        bio: 'Santexnika bo‘yicha tajribali usta xizmat ko‘rsatadi.',
        experienceYears: 7,
        serviceIds: ['srv_1'],
        districtIds: ['dst_1'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload) as {
      ok: boolean;
      masterProfile: { status: string; experienceYears: number };
    };
    expect(body.ok).toBe(true);
    expect(body.masterProfile.status).toBe('PENDING');
    expect(body.masterProfile.experienceYears).toBe(7);

    userFindSpy.mockRestore();
    servicesFindSpy.mockRestore();
    districtsFindSpy.mockRestore();
    profileFindSpy.mockRestore();
    profileCreateSpy.mockRestore();
  });

  it('allaqachon arizasi bor usta qayta topshirsa 409 ALREADY_APPLIED qaytaradi', async () => {
    const token = await signToken({ userId: 'usr_already_applied' });

    const user = {
      id: 'usr_already_applied',
      telegramId: BigInt(44444),
      firstName: 'Jamshid',
      lastName: null,
      username: 'jamshid',
      photoUrl: null,
      phone: '+998901112233',
      role: 'CUSTOMER' as const,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      masterProfile: null,
    };

    const userFindSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user);

    vi.spyOn(prisma.service, 'findMany').mockResolvedValue([
      { id: 'srv_1', slug: 'santexnika', nameUz: 'Santexnika', isActive: true },
    ]);
    vi.spyOn(prisma.district, 'findMany').mockResolvedValue([
      { id: 'dst_1', nameUz: 'Chilonzor' },
    ]);

    const profileFindSpy = vi.spyOn(prisma.masterProfile, 'findUnique').mockResolvedValue({
      id: 'mp_existing',
      userId: user.id,
      bio: 'Eski ariza',
      experienceYears: 3,
      status: 'PENDING',
      rejectReason: null,
      ratingAvg: new Decimal(0),
      ratingCount: 0,
      completedCount: 0,
      createdAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/master/apply',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        bio: 'Santexnika bo‘yicha tajribali mutaxassisman.',
        experienceYears: 4,
        serviceIds: ['srv_1'],
        districtIds: ['dst_1'],
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.payload) as { error: { code: string } };
    expect(body.error.code).toBe('ALREADY_APPLIED');

    userFindSpy.mockRestore();
    profileFindSpy.mockRestore();
  });
});
