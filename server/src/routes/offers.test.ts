import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { signToken } from '../auth/jwt.js';

describe('Phase 7: Offers and Master Selection', () => {
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

  const customerUser = {
    id: 'usr_cust_7',
    telegramId: BigInt(111111),
    firstName: 'Aziz',
    lastName: 'Mijoz',
    username: 'aziz_m',
    photoUrl: null,
    phone: '+998901111111',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const pendingMasterUser = {
    id: 'usr_pending_7',
    telegramId: BigInt(222222),
    firstName: 'Botir',
    lastName: 'Pending',
    username: 'botir_p',
    photoUrl: null,
    phone: '+998902222222',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: {
      id: 'mp_pending_7',
      userId: 'usr_pending_7',
      status: 'PENDING' as const,
      bio: 'Tajribali usta',
      experienceYears: 3,
      ratingAvg: 0,
      ratingCount: 0,
      completedCount: 0,
      createdAt: new Date(),
    },
  };

  const approvedMasterUser = {
    id: 'usr_approved_7',
    telegramId: BigInt(333333),
    firstName: 'Rustam',
    lastName: 'Usta',
    username: 'rustam_u',
    photoUrl: null,
    phone: '+998903333333',
    role: 'MASTER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: {
      id: 'mp_approved_7',
      userId: 'usr_approved_7',
      status: 'APPROVED' as const,
      bio: 'Santexnik ustasi',
      experienceYears: 6,
      ratingAvg: 5,
      ratingCount: 2,
      completedCount: 2,
      createdAt: new Date(),
      services: [{ id: 'srv_santexnika', nameUz: 'Santexnika', slug: 'santexnika', isActive: true }],
      districts: [{ id: 'dist_chilonzor', nameUz: 'Chilonzor' }],
    },
  };

  const strangerUser = {
    id: 'usr_stranger_7',
    telegramId: BigInt(444444),
    firstName: 'Begona',
    lastName: 'Odam',
    username: 'begona_o',
    photoUrl: null,
    phone: '+998904444444',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOpenRequest = {
    id: 'req_phase7_1',
    customerId: customerUser.id,
    serviceId: 'srv_santexnika',
    districtId: 'dist_chilonzor',
    title: 'Krantdan suv oqmoqda',
    description: 'Yangi kran o‘rnatib berish kerak, tezda',
    addressDetail: 'Chilonzor 1-mavze, 10-uy, 25-xonadon (MAXFIY)',
    preferredTime: 'ASAP',
    budgetMin: 60000,
    budgetMax: 120000,
    status: 'OPEN' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: customerUser,
    service: { id: 'srv_santexnika', nameUz: 'Santexnika' },
    district: { id: 'dist_chilonzor', nameUz: 'Chilonzor' },
    photos: [],
    offers: [],
  };

  it('1. PENDING usta taklif bera olmaydi (403 qaytaradi)', async () => {
    const token = await signToken({ userId: pendingMasterUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(pendingMasterUser as never);
    vi.spyOn(prisma.masterProfile, 'findUnique').mockResolvedValue(pendingMasterUser.masterProfile as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockOpenRequest.id}/offers`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        price: 80000,
        message: 'Krantni sifatli o‘rnatib beraman',
      },
    });

    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('2. Begona odam takliflarni ko‘ra olmaydi (404 qaytaradi)', async () => {
    const token = await signToken({ userId: strangerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(strangerUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockOpenRequest as never);

    const res = await app.inject({
      method: 'GET',
      url: `/requests/${mockOpenRequest.id}/offers`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('3. Tanlashdan oldin usta mijoz raqami va aniq manzilini ko‘rmaydi', async () => {
    const token = await signToken({ userId: approvedMasterUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(approvedMasterUser as never);
    vi.spyOn(prisma.masterProfile, 'findUnique').mockResolvedValue(approvedMasterUser.masterProfile as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue({
      ...mockOpenRequest,
      selectedOffer: null,
      selectedOfferId: null,
    } as never);

    const res = await app.inject({
      method: 'GET',
      url: `/requests/${mockOpenRequest.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    // Tanlanmagan ustaga aniq manzil va mijoz telefoni chiqmaydi
    expect(json.request.addressDetail).toBeUndefined();
    expect(json.request.customer).toBeUndefined();
    expect(res.body).not.toContain('Chilonzor 1-mavze');
    expect(res.body).not.toContain(customerUser.phone);
  });

  it('4. Ikki parallel "select" chaqiruvidan faqat bittasi o‘tadi (ikkinchisi 409 oladi)', async () => {
    const customerToken = await signToken({ userId: customerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(customerUser as never);

    const mockOffer1 = {
      id: 'off_1',
      requestId: mockOpenRequest.id,
      masterId: approvedMasterUser.masterProfile.id,
      price: 80000,
      message: 'Tezda kelib qilaman',
      status: 'PENDING' as const,
      createdAt: new Date(),
      master: approvedMasterUser.masterProfile,
    };

    vi.spyOn(prisma.offer, 'findUnique').mockResolvedValue(mockOffer1 as never);

    // Birinchi chaqiruv: updateCount 1 ta -> muvaffaqiyatli
    let callCount = 0;
    vi.spyOn(prisma, '$transaction').mockImplementation(async (_callback) => {
      callCount++;
      if (callCount === 1) {
        return {
          id: mockOpenRequest.id,
          status: 'ASSIGNED',
          selectedOfferId: 'off_1',
          customer: customerUser,
          addressDetail: mockOpenRequest.addressDetail,
          selectedOffer: { master: { user: approvedMasterUser } },
          offers: [],
        } as never;
      }
      // Ikkinchi chaqiruv: so'rov allaqachon ASSIGNED bo'lgani sababli null qaytaradi
      return null;
    });

    // 1-so'rov
    const res1 = await app.inject({
      method: 'POST',
      url: `/requests/${mockOpenRequest.id}/select`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { offerId: 'off_1' },
    });

    expect(res1.statusCode).toBe(200);
    const json1 = JSON.parse(res1.body);
    expect(json1.ok).toBe(true);
    expect(json1.status).toBe('ASSIGNED');

    // 2-so'rov (parallel yoki takroriy chaqiruv)
    const res2 = await app.inject({
      method: 'POST',
      url: `/requests/${mockOpenRequest.id}/select`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { offerId: 'off_1' },
    });

    expect(res2.statusCode).toBe(409);
    const json2 = JSON.parse(res2.body);
    expect(json2.error.code).toBe('CANNOT_SELECT');
  });

  it('5. Usta o‘z taklifini qaytarib olishi mumkin (POST /offers/:id/withdraw)', async () => {
    const masterToken = await signToken({ userId: approvedMasterUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(approvedMasterUser as never);

    const mockOfferToWithdraw = {
      id: 'off_withdraw_1',
      requestId: mockOpenRequest.id,
      masterId: approvedMasterUser.masterProfile.id,
      price: 90000,
      status: 'PENDING' as const,
      master: { userId: approvedMasterUser.id },
      request: { status: 'OPEN' as const },
    };

    vi.spyOn(prisma.offer, 'findUnique').mockResolvedValue(mockOfferToWithdraw as never);
    vi.spyOn(prisma.offer, 'update').mockResolvedValue({
      ...mockOfferToWithdraw,
      status: 'WITHDRAWN',
    } as never);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never);

    const res = await app.inject({
      method: 'POST',
      url: '/offers/off_withdraw_1/withdraw',
      headers: { authorization: `Bearer ${masterToken}` },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe('WITHDRAWN');
  });
});
