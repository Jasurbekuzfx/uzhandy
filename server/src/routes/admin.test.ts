import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { signToken } from '../auth/jwt.js';

describe('Phase 9: Admin Panel and Moderation', () => {
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

  const adminUser = {
    id: 'usr_admin_9',
    telegramId: BigInt(911111),
    firstName: 'Admin',
    lastName: 'Boshqaruvchi',
    username: 'admin_top',
    photoUrl: null,
    phone: '+998909111111',
    role: 'ADMIN' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: null,
  };

  const normalCustomer = {
    id: 'usr_cust_9',
    telegramId: BigInt(922222),
    firstName: 'Sardor',
    lastName: 'Mijoz',
    username: 'sardor_m',
    photoUrl: null,
    phone: '+998909222222',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: null,
  };

  const targetMaster = {
    id: 'mp_target_9',
    userId: 'usr_master_target_9',
    status: 'PENDING' as const,
    bio: 'Tajribali usta',
    experienceYears: 4,
    rejectReason: null,
    ratingAvg: 0,
    ratingCount: 0,
    completedCount: 0,
    createdAt: new Date(),
    user: {
      id: 'usr_master_target_9',
      telegramId: BigInt(933333),
      firstName: 'Alisher',
      lastName: 'Usta',
      username: 'alisher_u',
      photoUrl: null,
      phone: '+998909333333',
      role: 'CUSTOMER' as const,
      isBlocked: false,
      createdAt: new Date(),
    },
    services: [{ id: 'srv_1', nameUz: 'Santexnika', slug: 'santexnika' }],
    districts: [{ id: 'dist_1', nameUz: 'Chilonzor' }],
  };

  // --- 1. RUXSATLARNI TEKSHIRISH (AUTH & ROLE GUARDS) ---
  it('1. Oddiy foydalanuvchi /admin/* endpointlariga kira olmaydi (403 FORBIDDEN oladi)', async () => {
    const token = await signToken({ userId: normalCustomer.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(normalCustomer as never);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/masters',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('2. Tokensiz foydalanuvchi 401 UNAUTHORIZED oladi', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/stats',
    });

    expect(res.statusCode).toBe(401);
  });

  // --- 2. GET /admin/masters ---
  it('3. Admin arizalar ro‘yxatini ko‘ra oladi (200 OK)', async () => {
    const token = await signToken({ userId: adminUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as never);
    vi.spyOn(prisma.masterProfile, 'findMany').mockResolvedValue([targetMaster as never]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/masters?status=PENDING',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.masters).toBeDefined();
    expect(json.masters.length).toBe(1);
    expect(json.masters[0].user.firstName).toBe('Alisher');
    expect(json.masters[0].user.phone).toBe('+998909333333'); // Admin ko'radi
  });

  // --- 3. POST /admin/masters/:id/approve ---
  it('4. Admin usta arizasini tasdiqlaydi -> status=APPROVED va role=MASTER bo‘ladi', async () => {
    const token = await signToken({ userId: adminUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as never);
    vi.spyOn(prisma.masterProfile, 'findFirst').mockResolvedValue(targetMaster as never);

    let approvedStatus = '';
    let updatedRole = '';

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      const cb = callback as (tx: unknown) => Promise<unknown>;
      return cb({
        masterProfile: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            approvedStatus = args.data.status;
            return Promise.resolve({});
          }),
        },
        user: {
          update: vi.fn().mockImplementation((args: { data: { role: string } }) => {
            updatedRole = args.data.role;
            return Promise.resolve({});
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      }) as never;
    });

    const res = await app.inject({
      method: 'POST',
      url: `/admin/masters/${targetMaster.id}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('APPROVED');
    expect(approvedStatus).toBe('APPROVED');
    expect(updatedRole).toBe('MASTER');
  });

  // --- 4. POST /admin/masters/:id/reject ---
  it('5. Usta arizasini sababsiz rad etib bo‘lmaydi (400 VALIDATION_ERROR)', async () => {
    const token = await signToken({ userId: adminUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as never);

    const res = await app.inject({
      method: 'POST',
      url: `/admin/masters/${targetMaster.id}/reject`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'kam' },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('6. Admin sabab ko‘rsatib arizani rad etadi -> status=REJECTED', async () => {
    const token = await signToken({ userId: adminUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as never);
    vi.spyOn(prisma.masterProfile, 'findFirst').mockResolvedValue(targetMaster as never);

    let rejectedReasonSaved = '';
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      const cb = callback as (tx: unknown) => Promise<unknown>;
      return cb({
        masterProfile: {
          update: vi.fn().mockImplementation((args: { data: { rejectReason: string } }) => {
            rejectedReasonSaved = args.data.rejectReason;
            return Promise.resolve({});
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      }) as never;
    });

    const res = await app.inject({
      method: 'POST',
      url: `/admin/masters/${targetMaster.id}/reject`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Sertifikat taqdim etilmadi' },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('REJECTED');
    expect(rejectedReasonSaved).toBe('Sertifikat taqdim etilmadi');
  });

  // --- 5. POST /admin/masters/:id/suspend ---
  it('7. Admin usta faoliyatini to‘xtata oladi (suspend)', async () => {
    const token = await signToken({ userId: adminUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as never);
    vi.spyOn(prisma.masterProfile, 'findFirst').mockResolvedValue(targetMaster as never);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      const cb = callback as (tx: unknown) => Promise<unknown>;
      return cb({
        masterProfile: {
          update: vi.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      }) as never;
    });

    const res = await app.inject({
      method: 'POST',
      url: `/admin/masters/${targetMaster.id}/suspend`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Mijoz shikoyati' },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('SUSPENDED');
  });

  // --- 6. BLOCK & UNBLOCK USERS ---
  it('8. Admin boshqa adminni bloklay olmaydi (400 CANNOT_BLOCK_ADMIN)', async () => {
    const token = await signToken({ userId: adminUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as never);

    const res = await app.inject({
      method: 'POST',
      url: `/admin/users/${adminUser.id}/block`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Nomaqbul harakat' },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('CANNOT_BLOCK_ADMIN');
  });

  it('9. Admin foydalanuvchini bloklaydi va blokdan chiqara oladi', async () => {
    const token = await signToken({ userId: adminUser.id });

    vi.spyOn(prisma.user, 'findUnique')
      .mockResolvedValueOnce(adminUser as never)
      .mockResolvedValueOnce(normalCustomer as never);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      const cb = callback as (tx: unknown) => Promise<unknown>;
      return cb({
        user: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }) as never;
    });

    // Block
    const blockRes = await app.inject({
      method: 'POST',
      url: `/admin/users/${normalCustomer.id}/block`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Qoidalarga rioya qilinmadi' },
    });

    expect(blockRes.statusCode).toBe(200);
    expect(JSON.parse(blockRes.body).isBlocked).toBe(true);

    // Unblock
    vi.spyOn(prisma.user, 'findUnique')
      .mockResolvedValueOnce(adminUser as never)
      .mockResolvedValueOnce(normalCustomer as never);

    const unblockRes = await app.inject({
      method: 'POST',
      url: `/admin/users/${normalCustomer.id}/unblock`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(unblockRes.statusCode).toBe(200);
    expect(JSON.parse(unblockRes.body).isBlocked).toBe(false);
  });

  // --- 7. GET /admin/requests ---
  it('10. Admin barcha so‘rovlar ro‘yxatini sahifalab oladi', async () => {
    const token = await signToken({ userId: adminUser.id });

    const mockAdminRequest = {
      id: 'req_admin_1',
      title: 'Quvur tuzatish',
      description: 'Quvur teshildi',
      addressDetail: 'Chilonzor 3',
      preferredTime: 'ASAP',
      budgetMin: 50000,
      budgetMax: 100000,
      status: 'OPEN' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: normalCustomer,
      service: { id: 'srv_1', nameUz: 'Santexnika' },
      district: { id: 'dist_1', nameUz: 'Chilonzor' },
      photos: [],
      selectedOffer: null,
      _count: { offers: 3 },
    };

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as never);
    vi.spyOn(prisma.request, 'count').mockResolvedValue(1);
    vi.spyOn(prisma.request, 'findMany').mockResolvedValue([mockAdminRequest as never]);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/requests?page=1&limit=10',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.total).toBe(1);
    expect(json.requests.length).toBe(1);
    expect(json.requests[0].title).toBe('Quvur tuzatish');
    expect(json.requests[0].offersCount).toBe(3);
  });

  // --- 8. GET /admin/stats ---
  it('11. Admin bugungi va jami statistikani oladi', async () => {
    const token = await signToken({ userId: adminUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as never);
    vi.spyOn(prisma.request, 'count').mockResolvedValue(10);
    vi.spyOn(prisma.offer, 'count').mockResolvedValue(25);
    vi.spyOn(prisma.masterProfile, 'count').mockResolvedValue(5);
    vi.spyOn(prisma.user, 'count').mockResolvedValue(50);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.stats).toBeDefined();
    expect(json.stats.requests.total).toBe(10);
    expect(json.stats.offers.total).toBe(25);
    expect(json.stats.activeMasters).toBe(5);
    expect(json.stats.totalUsers).toBe(50);
  });
});
