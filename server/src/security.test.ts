import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { prisma } from './db.js';
import { signToken } from './auth/jwt.js';


describe('Phase 10: Security and Quality Assurance Tests', () => {
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

  const testUser = {
    id: 'usr_sec_1',
    telegramId: BigInt(777001),
    firstName: 'Test',
    lastName: 'Security',
    username: 'sec_test',
    phone: '+998901234567',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: null,
  };

  // 1. RATE LIMITING: /auth/telegram (1 daqiqada 10 ta, 11-chi so'rov 429 beradi)
  it('1. /auth/telegram da 1 daqiqada 10 tadan oshiq so‘rov yuborilganda 429 RATE_LIMIT_EXCEEDED qaytaradi', async () => {
    // 10 ta so'rov yuboramiz
    for (let i = 0; i < 10; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/telegram',
        remoteAddress: '198.51.100.1', // Alohida IP
        payload: { initData: 'invalid_data_test' },
      });
    }

    // 11-chi so'rov limitga tushishi kerak
    const resLimit = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      remoteAddress: '198.51.100.1',
      payload: { initData: 'invalid_data_test' },
    });

    expect(resLimit.statusCode).toBe(429);
    const json = JSON.parse(resLimit.body);

    expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });


  // 2. ERROR HANDLER: 500 xatolarida stack trace yoki ichki xato chiqmaydi
  it('2. Ichki server xatoligida (500) stack trace yoki maxfiy ma’lumotlar foydalanuvchiga chiqmaydi', async () => {
    const token = await signToken({ userId: testUser.id });

    // Bazada kutilmagan xatolik yuz berganda
    vi.spyOn(prisma.user, 'findUnique').mockRejectedValue(new Error('DATABASE_CRITICAL_FAILURE_PASSWORD=123'));

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(500);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(json.error.message).toBe('Serverda ichki xatolik yuz berdi');
    // Ichki maxfiy xato matni umuman bo'lmasligi kerak
    expect(res.body).not.toContain('DATABASE_CRITICAL_FAILURE');
    expect(res.body).not.toContain('PASSWORD=123');
    expect(res.body).not.toContain('stack');
  });

  // 3. MAXFIYLIK: Ommaviy profilda telefon va manzil chiqmaydi
  it('3. GET /masters/:id ommaviy profilda usta telefoni va mijozning to‘liq ismi chiqmaydi', async () => {
    const masterWithReviews = {
      id: 'mp_sec_1',
      userId: 'usr_sec_m1',
      status: 'APPROVED',
      bio: 'Usta bio',
      experienceYears: 5,
      ratingAvg: 4.5,
      ratingCount: 1,
      completedCount: 2,
      user: {
        id: 'usr_sec_m1',
        firstName: 'Bobur',
        lastName: 'Usta',
        username: 'bobur_u',
        photoUrl: null,
        phone: '+998909999999', // Maxfiy telefon
      },
      services: [],
      districts: [],
      reviewsReceived: [
        {
          id: 'rev_1',
          rating: 5,
          comment: 'Zo‘r ish',
          createdAt: new Date(),
          customer: { firstName: 'Rustamjon' },
        },
      ],
    };

    vi.spyOn(prisma.masterProfile, 'findFirst').mockResolvedValue(masterWithReviews as never);

    const res = await app.inject({
      method: 'GET',
      url: '/masters/mp_sec_1',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    // Usta telefoni yo'q
    const masterObj = json.master as Record<string, unknown>;
    expect(masterObj['phone']).toBeUndefined();
    // Mijoz ismi faqat bosh harfi
    expect(json.master.reviews[0].customerName).toBe('R.');
    expect(res.body).not.toContain('+998909999999');
    expect(res.body).not.toContain('Rustamjon');
  });

  // 4. MAXFIYLIK: Usta ko'radigan ommaviy so'rovlarda mijoz telefoni va aniq manzil chiqmaydi
  it('4. GET /master/requests da mijoz telefoni va addressDetail chiqmaydi', async () => {
    const approvedMasterUser = {
      id: 'usr_approved_sec',
      telegramId: BigInt(888001),
      firstName: 'Ilhom',
      lastName: null,
      username: 'ilhom',
      phone: '+998908888888',
      role: 'MASTER' as const,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      masterProfile: {
        id: 'mp_approved_sec',
        userId: 'usr_approved_sec',
        status: 'APPROVED' as const,
        bio: 'Bio',
        experienceYears: 3,
        ratingAvg: 0,
        ratingCount: 0,
        completedCount: 0,
        createdAt: new Date(),
        services: [{ id: 'srv_1' }],
        districts: [{ id: 'dist_1' }],
      },
    };

    const token = await signToken({ userId: approvedMasterUser.id });

    const openRequestWithSecret = {
      id: 'req_sec_open',
      title: 'Muzlatgich tuzatish',
      description: 'Sovutmayapti',
      addressDetail: 'Maxfiy manzil: 15-kvartal, 20-uy, 100-xonadon',
      preferredTime: 'ASAP',
      budgetMin: null,
      budgetMax: null,
      status: 'OPEN' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      service: { id: 'srv_1', nameUz: 'Santexnika' },
      district: { id: 'dist_1', nameUz: 'Chilonzor' },
      photos: [],
      offers: [],
      _count: { offers: 0 },
      customer: { phone: '+998907777777' }, // Maxfiy telefon
    };

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(approvedMasterUser as never);
    vi.spyOn(prisma.masterProfile, 'findUnique').mockResolvedValue(approvedMasterUser.masterProfile as never);
    vi.spyOn(prisma.request, 'count').mockResolvedValue(1);
    vi.spyOn(prisma.request, 'findMany').mockResolvedValue([openRequestWithSecret as never]);

    const res = await app.inject({
      method: 'GET',
      url: '/master/requests',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    const reqItem = json.requests[0] as Record<string, unknown>;
    expect(reqItem['addressDetail']).toBeUndefined();
    expect(reqItem['customer']).toBeUndefined();
    expect(res.body).not.toContain('Maxfiy manzil');
    expect(res.body).not.toContain('+998907777777');
  });

  // 5. ZOD: Juda uzun matnlar yuborilganda 400 VALIDATION_ERROR beradi
  it('5. Zod sxemasi me’yordan oshiq matn kiritilganda 400 beradi', async () => {
    const token = await signToken({ userId: testUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      ...testUser,
      phone: '+998901234567',
    } as never);

    const res = await app.inject({
      method: 'POST',
      url: '/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        serviceId: 'srv_1',
        districtId: 'dist_1',
        title: 'A'.repeat(81), // Max 80 ta belgi
        description: 'B'.repeat(1001), // Max 1000 ta belgi
        addressDetail: 'Manzil',
      },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
