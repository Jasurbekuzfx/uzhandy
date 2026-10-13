import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Decimal } from '@prisma/client/runtime/library';
import { buildApp } from './app.js';
import { prisma } from './db.js';
import { signToken } from './auth/jwt.js';

describe('Phase 12: End-to-End Manual Simulation Test (2 Telegram Accounts: Customer + Master + Admin)', () => {
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

  // 1. Akkaunt A - Uy egasi (Mijoz)
  const customerUser = {
    id: 'usr_cust_e2e',
    telegramId: BigInt(911111111),
    firstName: 'Aziz',
    lastName: 'Karimov',
    username: 'aziz_k',
    photoUrl: null,
    phone: '+998901112233',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: null,
  };

  // 2. Akkaunt B - Mutaxassis (Usta)
  const masterUser = {
    id: 'usr_master_e2e',
    telegramId: BigInt(922222222),
    firstName: 'Rustam',
    lastName: 'Umarov',
    username: 'rustam_usta',
    photoUrl: null,
    phone: '+998909998877',
    role: 'MASTER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 3. Admin Akkaunt
  const adminUser = {
    id: 'usr_admin_e2e',
    telegramId: BigInt(999999999),
    firstName: 'Admin',
    lastName: 'Nazoratchi',
    username: 'admin_top',
    photoUrl: null,
    phone: '+998900000001',
    role: 'ADMIN' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Begona foydalanuvchi (Xavfsizlik va maxfiylik tekshiruvi uchun)
  const strangerUser = {
    id: 'usr_stranger_e2e',
    telegramId: BigInt(933333333),
    firstName: 'Begona',
    lastName: 'Shaxs',
    username: 'stranger_e2e',
    photoUrl: null,
    phone: '+998903334455',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let customerToken: string;
  let masterToken: string;
  let adminToken: string;
  let strangerToken: string;

  beforeAll(async () => {
    customerToken = await signToken({
      userId: customerUser.id,
    });

    masterToken = await signToken({
      userId: masterUser.id,
    });

    adminToken = await signToken({
      userId: adminUser.id,
    });

    strangerToken = await signToken({
      userId: strangerUser.id,
    });
  });

  it('1. Usta arizasi va Admin tomonidan tasdiqlanish jarayoni', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockImplementation(((args: { where: { id?: string } }) => {
      if (args.where.id === masterUser.id) return Promise.resolve(masterUser);
      if (args.where.id === adminUser.id) return Promise.resolve(adminUser);
      return Promise.resolve(null);
    }) as never);

    vi.spyOn(prisma.service, 'findMany').mockResolvedValue([
      { id: 'srv_1', slug: 'santexnika', nameUz: 'Santexnika', isActive: true },
    ]);
    vi.spyOn(prisma.district, 'findMany').mockResolvedValue([
      { id: 'dist_1', nameUz: 'Yunusobod' },
    ]);

    const createdMasterProfile = {
      id: 'mp_e2e_1',
      userId: masterUser.id,
      status: 'PENDING' as const,
      rejectReason: null,
      bio: 'Professional santexnik, 7 yillik tajriba',
      experienceYears: 7,
      ratingAvg: new Decimal(0),
      ratingCount: 0,
      completedCount: 0,
      createdAt: new Date(),
      user: masterUser,
      services: [{ id: 'srv_1', nameUz: 'Santexnika' }],
      districts: [{ id: 'dist_1', nameUz: 'Yunusobod' }],
    };

    vi.spyOn(prisma.masterProfile, 'findUnique').mockImplementation(((args: { where: { userId?: string; id?: string } }) => {
      if (args.where.userId === masterUser.id) return Promise.resolve(null);
      if (args.where.id === createdMasterProfile.id) return Promise.resolve(createdMasterProfile);
      return Promise.resolve(null);
    }) as never);
    vi.spyOn(prisma.masterProfile, 'findFirst').mockResolvedValue(createdMasterProfile as never);

    vi.spyOn(prisma.masterProfile, 'create').mockResolvedValue(createdMasterProfile as never);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never);

    // Master ariza topshiradi
    const applyRes = await app.inject({
      method: 'POST',
      url: '/master/apply',
      headers: { authorization: `Bearer ${masterToken}` },
      payload: {
        bio: 'Professional santexnik, 7 yillik tajriba',
        experienceYears: 7,
        serviceIds: ['srv_1'],
        districtIds: ['dist_1'],
      },
    });

    expect(applyRes.statusCode).toBe(201);
    const applyBody = applyRes.json();
    expect(applyBody.masterProfile.status).toBe('PENDING');

    // Admin arizani ko'rib chiqadi va tasdiqlaydi (approve)
    vi.spyOn(prisma, '$transaction').mockImplementation((async (callback: unknown) => {
      const cb = callback as (tx: unknown) => Promise<unknown>;
      return cb({
        masterProfile: {
          update: vi.fn().mockResolvedValue({ ...createdMasterProfile, status: 'APPROVED' }),
        },
        user: {
          update: vi.fn().mockResolvedValue({ ...masterUser, role: 'MASTER' }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      });
    }) as never);

    const approveRes = await app.inject({
      method: 'POST',
      url: `/admin/masters/${createdMasterProfile.id}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe('APPROVED');
  });

  it('2. Mijoz buyurtma yaratadi, Usta taklif beradi va Mijoz ustani tanlaydi (To‘liq hayotiy tsikl)', async () => {
    const approvedMasterProfile = {
      id: 'mp_e2e_1',
      userId: masterUser.id,
      status: 'APPROVED' as const,
      bio: 'Professional santexnik',
      experienceYears: 7,
      ratingAvg: new Decimal(5.0),
      ratingCount: 1,
      completedCount: 1,
      createdAt: new Date(),
      services: [{ id: 'srv_1', nameUz: 'Santexnika' }],
      districts: [{ id: 'dist_1', nameUz: 'Yunusobod' }],
    };

    const mockRequest = {
      id: 'req_e2e_100',
      customerId: customerUser.id,
      serviceId: 'srv_1',
      districtId: 'dist_1',
      title: 'Quvur yorildi, tezkor ta’mir kerak',
      description: 'Oshxonadagi quvurdan suv sizmoqda, tezkor santexnik kerak',
      addressDetail: 'Yunusobod 4-mavze, 15-uy, 42-xonadon',
      preferredTime: 'TODAY',
      budgetMin: 150000,
      budgetMax: 300000,
      status: 'OPEN' as const,
      selectedOfferId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: customerUser,
      service: { id: 'srv_1', nameUz: 'Santexnika' },
      district: { id: 'dist_1', nameUz: 'Yunusobod' },
      offers: [],
      photos: [],
    };

    vi.spyOn(prisma.user, 'findUnique').mockImplementation(((args: { where: { id?: string } }) => {
      if (args.where.id === customerUser.id) return Promise.resolve(customerUser);
      if (args.where.id === masterUser.id) {
        return Promise.resolve({ ...masterUser, masterProfile: approvedMasterProfile });
      }
      if (args.where.id === strangerUser.id) return Promise.resolve(strangerUser);
      return Promise.resolve(null);
    }) as never);

    vi.spyOn(prisma.masterProfile, 'findUnique').mockImplementation(((args: { where: { userId?: string; id?: string } }) => {
      if (args.where.userId === masterUser.id || args.where.id === approvedMasterProfile.id) {
        return Promise.resolve(approvedMasterProfile);
      }
      return Promise.resolve(null);
    }) as never);

    vi.spyOn(prisma.masterProfile, 'findMany').mockResolvedValue([approvedMasterProfile] as never);
    vi.spyOn(prisma.notificationLog, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.notificationLog, 'create').mockResolvedValue({} as never);
    vi.spyOn(prisma.request, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.service, 'findFirst').mockResolvedValue({
      id: 'srv_1',
      nameUz: 'Santexnika',
      isActive: true,
    } as never);
    vi.spyOn(prisma.district, 'findUnique').mockResolvedValue({
      id: 'dist_1',
      nameUz: 'Yunusobod',
    } as never);
    vi.spyOn(prisma.request, 'create').mockResolvedValue(mockRequest as never);
    vi.spyOn(prisma.request, 'findUnique').mockImplementation(((args: { where: { id?: string } }) => {
      if (args.where.id === mockRequest.id) {
        return Promise.resolve({
          ...mockRequest,
          customer: customerUser,
          selectedOffer: mockRequest.selectedOfferId
            ? {
                id: 'off_e2e_1',
                masterId: approvedMasterProfile.id,
                price: 200000,
                message: '1 soatda yetib boraman',
                master: {
                  id: approvedMasterProfile.id,
                  userId: masterUser.id,
                  user: masterUser,
                },
              }
            : null,
        });
      }
      return Promise.resolve(null);
    }) as never);

    // 2.1 Mijoz buyurtma yaratadi
    const createReqRes = await app.inject({
      method: 'POST',
      url: '/requests',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {
        serviceId: 'srv_1',
        districtId: 'dist_1',
        title: 'Quvur yorildi, tezkor ta’mir kerak',
        description: 'Oshxonadagi quvurdan suv sizmoqda, tezkor santexnik kerak',
        addressDetail: 'Yunusobod 4-mavze, 15-uy, 42-xonadon',
        preferredTime: 'TODAY',
        budgetMin: 150000,
        budgetMax: 300000,
      },
    });

    expect(createReqRes.statusCode).toBe(201);
    const createdReqData = createReqRes.json();
    expect(createdReqData.request.status).toBe('OPEN');

    // 2.2 Usta taklif yuboradi
    const mockOffer = {
      id: 'off_e2e_1',
      requestId: mockRequest.id,
      masterId: approvedMasterProfile.id,
      price: 200000,
      message: '1 soatda yetib boraman',
      status: 'PENDING' as const,
      createdAt: new Date(),
    };

    vi.spyOn(prisma.offer, 'create').mockResolvedValue(mockOffer as never);
    vi.spyOn(prisma.offer, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.offer, 'findUnique').mockImplementation(((args: { where: { id?: string; requestId_masterId?: unknown } }) => {
      if ('requestId_masterId' in args.where) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        ...mockOffer,
        master: {
          id: approvedMasterProfile.id,
          userId: masterUser.id,
          user: masterUser,
        },
      });
    }) as never);

    const offerRes = await app.inject({
      method: 'POST',
      url: `/requests/${mockRequest.id}/offers`,
      headers: { authorization: `Bearer ${masterToken}` },
      payload: {
        price: 200000,
        message: '1 soatda yetib boraman',
      },
    });

    expect(offerRes.statusCode).toBe(201);
    expect(offerRes.json().offer.price).toBe(200000);

    // 2.3 Mijoz taklifni qabul qiladi (Ustani tanlaydi)
    const assignedRequest = {
      ...mockRequest,
      status: 'ASSIGNED' as const,
      selectedOfferId: mockOffer.id,
      selectedOffer: {
        id: mockOffer.id,
        masterId: approvedMasterProfile.id,
        price: 200000,
        message: '1 soatda yetib boraman',
        master: {
          id: approvedMasterProfile.id,
          userId: masterUser.id,
          user: masterUser,
        },
      },
    };

    vi.spyOn(prisma, '$transaction').mockResolvedValue(assignedRequest as never);

    const selectRes = await app.inject({
      method: 'POST',
      url: `/requests/${mockRequest.id}/select`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {
        offerId: mockOffer.id,
      },
    });

    expect(selectRes.statusCode).toBe(200);
    expect(selectRes.json().status).toBe('ASSIGNED');

    // 2.4 Maxfiylik tekshiruvi: Usta va mijoz manzil/telefonni ko‘ra oladi, Begona esa ko‘ra olmaydi!
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue({
      ...assignedRequest,
      customer: customerUser,
      selectedOffer: {
        id: mockOffer.id,
        masterId: approvedMasterProfile.id,
        price: 200000,
        message: '1 soatda yetib boraman',
        master: {
          id: approvedMasterProfile.id,
          userId: masterUser.id,
          user: masterUser,
        },
      },
    } as never);

    // Mijoz so'rovi (Mijoz usta telefon raqamini ko'ra oladi)
    const custViewRes = await app.inject({
      method: 'GET',
      url: `/requests/${mockRequest.id}`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    expect(custViewRes.statusCode).toBe(200);
    const custView = custViewRes.json();
    expect(custView.request.addressDetail).toBe('Yunusobod 4-mavze, 15-uy, 42-xonadon');
    expect(custView.request.selectedOffer.master.user.phone).toBe('+998909998877');

    // Usta so'rovi (Tanlangan usta mijoz telefon raqami va aniq manzilni ko'ra oladi)
    const masterViewRes = await app.inject({
      method: 'GET',
      url: `/requests/${mockRequest.id}`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(masterViewRes.statusCode).toBe(200);
    const masterView = masterViewRes.json();
    expect(masterView.request.addressDetail).toBe('Yunusobod 4-mavze, 15-uy, 42-xonadon');
    expect(masterView.request.customer.phone).toBe('+998901112233');

    // Begona foydalanuvchi so'rovi (Egasi yoki biriktirilgan usta bo'lmagani uchun 404 oladi)
    const strangerViewRes = await app.inject({
      method: 'GET',
      url: `/requests/${mockRequest.id}`,
      headers: { authorization: `Bearer ${strangerToken}` },
    });
    expect(strangerViewRes.statusCode).toBe(404);
  });

  it('3. Ishni boshlash (IN_PROGRESS), mijoz tomonidan yakunlash (DONE) va 5 yulduzli sharh qoldirish', async () => {
    const approvedMasterProfile = {
      id: 'mp_e2e_1',
      userId: masterUser.id,
      status: 'APPROVED' as const,
      bio: 'Professional santexnik',
      experienceYears: 7,
      ratingAvg: new Decimal(4.0),
      ratingCount: 1,
      completedCount: 1,
      createdAt: new Date(),
    };

    const inProgressRequest = {
      id: 'req_e2e_100',
      customerId: customerUser.id,
      serviceId: 'srv_1',
      districtId: 'dist_1',
      title: 'Quvur yorildi',
      description: 'Ta’mir',
      status: 'IN_PROGRESS' as const,
      selectedOfferId: 'off_e2e_1',
      customer: customerUser,
      selectedOffer: {
        id: 'off_e2e_1',
        masterId: approvedMasterProfile.id,
        master: {
          id: approvedMasterProfile.id,
          userId: masterUser.id,
          user: masterUser,
        },
      },
    };

    const assignedRequest = {
      ...inProgressRequest,
      status: 'ASSIGNED' as const,
    };

    const doneRequest = {
      ...inProgressRequest,
      status: 'DONE' as const,
    };

    vi.spyOn(prisma.user, 'findUnique').mockImplementation(((args: { where: { id?: string } }) => {
      if (args.where.id === masterUser.id) {
        return Promise.resolve({ ...masterUser, masterProfile: approvedMasterProfile });
      }
      if (args.where.id === customerUser.id) return Promise.resolve(customerUser);
      return Promise.resolve(null);
    }) as never);

    vi.spyOn(prisma.request, 'findUnique').mockImplementation(((args: { where: { id?: string } }) => {
      if (args.where.id === inProgressRequest.id) {
        return Promise.resolve(assignedRequest);
      }
      return Promise.resolve(null);
    }) as never);

    vi.spyOn(prisma.request, 'update').mockResolvedValue(inProgressRequest as never);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never);

    // 3.1 Usta ishni boshlaydi
    const startRes = await app.inject({
      method: 'POST',
      url: `/requests/${inProgressRequest.id}/start`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json().status).toBe('IN_PROGRESS');

    // 3.2 Mijoz ishni yakunlaydi (Mijoz tasdiqlaydi)
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(inProgressRequest as never);
    vi.spyOn(prisma, '$transaction').mockImplementation((async (callback: unknown) => {
      const cb = callback as (tx: unknown) => Promise<unknown>;
      return cb({
        request: {
          update: vi.fn().mockResolvedValue(doneRequest),
        },
        masterProfile: {
          update: vi.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      });
    }) as never);

    const completeRes = await app.inject({
      method: 'POST',
      url: `/requests/${inProgressRequest.id}/complete`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().status).toBe('DONE');

    // 3.3 Mijoz 5 yulduzli baho va sharh qoldiradi
    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(doneRequest as never);
    vi.spyOn(prisma.review, 'findUnique').mockResolvedValue(null);

    const createdReview = {
      id: 'rev_e2e_1',
      requestId: doneRequest.id,
      customerId: customerUser.id,
      masterId: approvedMasterProfile.id,
      rating: 5,
      comment: 'Usta ishini a’lo darajada va o‘z vaqtida bajardi!',
      createdAt: new Date(),
    };

    vi.spyOn(prisma, '$transaction').mockImplementation((async (callback: unknown) => {
      const cb = callback as (tx: unknown) => Promise<unknown>;
      return cb({
        review: {
          create: vi.fn().mockResolvedValue(createdReview),
          aggregate: vi.fn().mockResolvedValue({
            _avg: { rating: 5.0 },
            _count: { rating: 2 },
          }),
        },
        masterProfile: {
          update: vi.fn().mockResolvedValue({
            ...approvedMasterProfile,
            ratingAvg: new Decimal(5.0),
            ratingCount: 2,
            completedCount: 2,
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      });
    }) as never);

    const reviewRes = await app.inject({
      method: 'POST',
      url: `/requests/${doneRequest.id}/review`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {
        rating: 5,
        comment: 'Usta ishini a’lo darajada va o‘z vaqtida bajardi!',
      },
    });

    expect(reviewRes.statusCode).toBe(201);
    const reviewData = reviewRes.json();
    expect(reviewData.ok).toBe(true);
    expect(reviewData.review.rating).toBe(5);
    expect(reviewData.review.comment).toBe('Usta ishini a’lo darajada va o‘z vaqtida bajardi!');
  });
});
