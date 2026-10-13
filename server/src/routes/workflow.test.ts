import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { signToken } from '../auth/jwt.js';

describe('Phase 8: Workflow, Status Transitions, Reviews and Public Master Profile', () => {
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
    id: 'usr_cust_8',
    telegramId: BigInt(811111),
    firstName: 'Anvar',
    lastName: 'Mijoz',
    username: 'anvar_m',
    photoUrl: null,
    phone: '+998908111111',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const masterUser = {
    id: 'usr_master_8',
    telegramId: BigInt(822222),
    firstName: 'Sherzod',
    lastName: 'Usta',
    username: 'sherzod_u',
    photoUrl: null,
    phone: '+998908222222',
    role: 'MASTER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: {
      id: 'mp_master_8',
      userId: 'usr_master_8',
      status: 'APPROVED' as const,
      bio: 'Santexnik mutaxassis',
      experienceYears: 5,
      ratingAvg: 4.5,
      ratingCount: 2,
      completedCount: 3,
      createdAt: new Date(),
    },
  };

  const strangerUser = {
    id: 'usr_stranger_8',
    telegramId: BigInt(833333),
    firstName: 'Begona',
    lastName: 'Foydalanuvchi',
    username: 'begona_8',
    photoUrl: null,
    phone: '+998908333333',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAssignedRequest = {
    id: 'req_wf_1',
    customerId: customerUser.id,
    serviceId: 'srv_1',
    districtId: 'dist_1',
    title: 'Vanna tuzatish',
    description: 'Vannani ta’mirlash kerak',
    addressDetail: 'Chilonzor 9, 12-uy',
    preferredTime: 'TODAY',
    budgetMin: 100000,
    budgetMax: 200000,
    status: 'ASSIGNED' as const,
    selectedOfferId: 'off_wf_1',
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: customerUser,
    selectedOffer: {
      id: 'off_wf_1',
      masterId: masterUser.masterProfile.id,
      price: 150000,
      message: 'Tezda kelib qilaman',
      master: {
        id: masterUser.masterProfile.id,
        userId: masterUser.id,
        user: masterUser,
      },
    },
  };

  // --- 1. POST /requests/:id/start ---
  it('1. Faqat tanlangan usta ishni boshlay oladi (Begona usta 403 oladi)', async () => {
    const token = await signToken({ userId: strangerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(strangerUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockAssignedRequest as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/start`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('2. Noto‘g‘ri statusda ishni boshlab bo‘lmaydi (OPEN holatida 409 oladi)', async () => {
    const token = await signToken({ userId: masterUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(masterUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue({
      ...mockAssignedRequest,
      status: 'OPEN',
    } as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/start`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(409);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('3. Tanlangan usta ASSIGNED holatidagi ishni boshlay oladi -> IN_PROGRESS', async () => {
    const token = await signToken({ userId: masterUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(masterUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockAssignedRequest as never);
    vi.spyOn(prisma.request, 'update').mockResolvedValue({
      ...mockAssignedRequest,
      status: 'IN_PROGRESS',
    } as never);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/start`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('IN_PROGRESS');
  });

  // --- 2. POST /requests/:id/complete ---
  it('4. Usta ishni yakunlay olmaydi (faqat mijoz yakunlaydi)', async () => {
    const token = await signToken({ userId: masterUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(masterUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue({
      ...mockAssignedRequest,
      status: 'IN_PROGRESS',
    } as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('5. IN_PROGRESS bo‘lmagan ishni yakunlab bo‘lmaydi (ASSIGNED holatida 409)', async () => {
    const token = await signToken({ userId: customerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(customerUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockAssignedRequest as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(409);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('6. Mijoz IN_PROGRESS holatidagi ishni yakunlaydi -> DONE va completedCount oshadi', async () => {
    const token = await signToken({ userId: customerUser.id });

    const inProgressRequest = {
      ...mockAssignedRequest,
      status: 'IN_PROGRESS' as const,
    };

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(customerUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(inProgressRequest as never);

    let completedIncremented = false;
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      const cb = callback as (tx: unknown) => Promise<unknown>;
      return cb({
        request: {
          update: vi.fn().mockResolvedValue({ ...inProgressRequest, status: 'DONE' }),
        },
        masterProfile: {
          update: vi.fn().mockImplementation(() => {
            completedIncremented = true;
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
      url: `/requests/${mockAssignedRequest.id}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('DONE');
    expect(completedIncremented).toBe(true);
  });

  // --- 3. POST /requests/:id/cancel ---
  it('7. ASSIGNED holatida sababsiz bekor qilib bo‘lmaydi (400 REASON_REQUIRED)', async () => {
    const token = await signToken({ userId: customerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(customerUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockAssignedRequest as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('REASON_REQUIRED');
  });

  it('8. ASSIGNED holatida sabab ko‘rsatilganda muvaffaqiyatli bekor bo‘ladi', async () => {
    const token = await signToken({ userId: customerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(customerUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockAssignedRequest as never);
    vi.spyOn(prisma.request, 'update').mockResolvedValue({
      ...mockAssignedRequest,
      status: 'CANCELLED',
    } as never);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Boshqa reja chiqib qoldi' },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('CANCELLED');
  });

  // --- 4. POST /requests/:id/review ---
  it('9. DONE bo‘lmagan so‘rovga baho berib bo‘lmaydi (409 REQUEST_NOT_DONE)', async () => {
    const token = await signToken({ userId: customerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(customerUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue({
      ...mockAssignedRequest,
      status: 'IN_PROGRESS',
    } as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/review`,
      headers: { authorization: `Bearer ${token}` },
      payload: { rating: 5, comment: 'Ajoyib usta' },
    });

    expect(res.statusCode).toBe(409);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('REQUEST_NOT_DONE');
  });

  it('10. Noto‘g‘ri baho (masalan 6 yoki 0) kiritilsa 400 VALIDATION_ERROR', async () => {
    const token = await signToken({ userId: customerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(customerUser as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/review`,
      headers: { authorization: `Bearer ${token}` },
      payload: { rating: 6 },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('11. Takroriy baho qo‘yishga ruxsat berilmaydi (409 ALREADY_REVIEWED)', async () => {
    const token = await signToken({ userId: customerUser.id });

    const doneRequest = { ...mockAssignedRequest, status: 'DONE' as const };
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(customerUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(doneRequest as never);
    vi.spyOn(prisma.review, 'findUnique').mockResolvedValue({ id: 'rev_1' } as never);

    const res = await app.inject({
      method: 'POST',
      url: `/requests/${mockAssignedRequest.id}/review`,
      headers: { authorization: `Bearer ${token}` },
      payload: { rating: 5 },
    });

    expect(res.statusCode).toBe(409);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('ALREADY_REVIEWED');
  });

  it('12. Mijoz DONE so‘rovga baho beradi -> MasterProfile ratingAvg va ratingCount qayta hisoblanadi', async () => {
    const token = await signToken({ userId: customerUser.id });

    const doneRequest = { ...mockAssignedRequest, status: 'DONE' as const };
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(customerUser as never);
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(doneRequest as never);
    vi.spyOn(prisma.review, 'findUnique').mockResolvedValue(null);

    let updatedAvg: unknown;
    let updatedCount: unknown;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      const cb = callback as (tx: unknown) => Promise<unknown>;
      return cb({
        review: {
          create: vi.fn().mockResolvedValue({
            id: 'rev_new_1',
            requestId: doneRequest.id,
            customerId: customerUser.id,
            masterId: masterUser.masterProfile.id,
            rating: 5,
            comment: 'Ish zo‘r bajarildi',
          }),
          aggregate: vi.fn().mockResolvedValue({
            _avg: { rating: 4.8 },
            _count: { rating: 3 },
          }),
        },
        masterProfile: {
          update: vi.fn().mockImplementation((args: { data: { ratingAvg: number; ratingCount: number } }) => {
            updatedAvg = args.data.ratingAvg;
            updatedCount = args.data.ratingCount;
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
      url: `/requests/${mockAssignedRequest.id}/review`,
      headers: { authorization: `Bearer ${token}` },
      payload: { rating: 5, comment: 'Ish zo‘r bajarildi' },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.ok).toBe(true);
    expect(json.review.rating).toBe(5);
    expect(updatedAvg).toBe(4.8);
    expect(updatedCount).toBe(3);
  });

  // --- 5. GET /masters/:id ---
  it('13. GET /masters/:id ommaviy usta profilini qaytaradi va telefon raqamini yashiradi', async () => {
    const approvedMasterProfile = {
      id: 'mp_master_8',
      userId: masterUser.id,
      status: 'APPROVED',
      bio: 'Professional santexnik',
      experienceYears: 7,
      ratingAvg: 4.8,
      ratingCount: 5,
      completedCount: 6,
      user: {
        id: masterUser.id,
        firstName: 'Sherzod',
        lastName: 'Usta',
        username: 'sherzod_u',
        photoUrl: null,
      },
      services: [{ id: 'srv_1', nameUz: 'Santexnika', slug: 'santexnika' }],
      districts: [{ id: 'dist_1', nameUz: 'Chilonzor' }],
      reviewsReceived: [
        {
          id: 'rev_1',
          rating: 5,
          comment: 'Juda tez va sifatli',
          createdAt: new Date(),
          customer: { firstName: 'Davron' },
        },
      ],
    };

    vi.spyOn(prisma.masterProfile, 'findFirst').mockResolvedValue(approvedMasterProfile as never);

    const res = await app.inject({
      method: 'GET',
      url: `/masters/${approvedMasterProfile.id}`,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.master).toBeDefined();
    expect(json.master.firstName).toBe('Sherzod');
    expect(json.master.ratingAvg).toBe(4.8);
    expect(json.master.reviews.length).toBe(1);
    expect(json.master.reviews[0].customerName).toBe('D.'); // Ism bosh harfi
    // Xavfsizlik: telefon raqam qaytmaydi
    const masterObj = json.master as Record<string, unknown>;
    expect(masterObj['phone']).toBeUndefined();
    const userObj = masterObj['user'] as Record<string, unknown> | undefined;
    expect(userObj?.['phone']).toBeUndefined();
  });
});
