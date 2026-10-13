import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { signToken } from '../auth/jwt.js';

describe('Requests routes: /requests and access control rules', () => {
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

  const ownerUser = {
    id: 'usr_owner_1',
    telegramId: BigInt(55555),
    firstName: 'Olim',
    lastName: 'Tursunov',
    username: 'olim_t',
    photoUrl: null,
    phone: '+998901234567',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: null,
  };

  const approvedMasterUser = {
    id: 'usr_master_1',
    telegramId: BigInt(66666),
    firstName: 'Sobir',
    lastName: 'Usta',
    username: 'sobir_master',
    photoUrl: null,
    phone: '+998939876543',
    role: 'MASTER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: {
      id: 'mp_approved_1',
      userId: 'usr_master_1',
      bio: 'Santexnik',
      experienceYears: 5,
      status: 'APPROVED' as const,
      rejectReason: null,
      ratingAvg: '0' as unknown as never,
      ratingCount: 0,
      completedCount: 0,
      createdAt: new Date(),
    },
  };

  const strangerUser = {
    id: 'usr_stranger_1',
    telegramId: BigInt(77777),
    firstName: 'Begona',
    lastName: null,
    username: 'begona',
    photoUrl: null,
    phone: '+998909999999',
    role: 'CUSTOMER' as const,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterProfile: null,
  };

  it('boshqa foydalanuvchining rasm yo‘li rad etiladi (400 INVALID_PHOTO_PATH)', async () => {
    const token = await signToken({ userId: ownerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(ownerUser);
    vi.spyOn(prisma.request, 'count').mockResolvedValue(0);

    const response = await app.inject({
      method: 'POST',
      url: '/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        serviceId: 'srv_1',
        districtId: 'dst_1',
        title: 'Kran buzildi, tuzatish kerak',
        description: 'Oshxonadagi jo‘mrakdan suv tommoqda, zudlik bilan usta kerak.',
        addressDetail: 'Chilonzor 9-mavze, 12-uy, 34-xonadon',
        photoPaths: ['usr_other_person/hacked_image.jpg'], // O'ziniki emas!
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_PHOTO_PATH');
  });

  it('bir vaqtda 5 tadan ortiq OPEN so‘rov ochish rad etiladi (400 OPEN_REQUESTS_LIMIT_EXCEEDED)', async () => {
    const token = await signToken({ userId: ownerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(ownerUser);
    vi.spyOn(prisma.request, 'count').mockResolvedValue(5); // Allaqachon 5 ta faol

    const response = await app.inject({
      method: 'POST',
      url: '/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        serviceId: 'srv_1',
        districtId: 'dst_1',
        title: 'Yana bitta so‘rov',
        description: 'Qo‘shimcha so‘rov uchun tavsif yozilmoqda.',
        addressDetail: 'Mirobod tumani, 5-uy',
        photoPaths: [],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload) as { error: { code: string } };
    expect(body.error.code).toBe('OPEN_REQUESTS_LIMIT_EXCEEDED');
  });

  it('begona foydalanuvchi so‘rovni ko‘ra olmaydi (404 NOT_FOUND)', async () => {
    const token = await signToken({ userId: strangerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(strangerUser);

    const mockRequest = {
      id: 'req_123',
      customerId: ownerUser.id, // Boshqa odamning so'rovi
      serviceId: 'srv_1',
      districtId: 'dst_1',
      title: 'Muzlatgich tuzatish',
      description: 'Muzlatgich sovitmayapti, ta’mirlash talab etiladi.',
      addressDetail: 'Sirli manzil 10',
      preferredTime: 'ASAP',
      budgetMin: 100000,
      budgetMax: 200000,
      status: 'OPEN' as const,
      selectedOfferId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: ownerUser,
      service: { id: 'srv_1', slug: 'maishiy-texnika', nameUz: 'Maishiy texnika', isActive: true },
      district: { id: 'dst_1', nameUz: 'Chilonzor' },
      photos: [],
      offers: [],
      selectedOffer: null,
    };

    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockRequest);

    const response = await app.inject({
      method: 'GET',
      url: '/requests/req_123',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('tasdiqlangan usta so‘rovni ko‘rganda addressDetail va mijoz raqamini ko‘rmaydi', async () => {
    const token = await signToken({ userId: approvedMasterUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(approvedMasterUser);

    const mockRequest = {
      id: 'req_123',
      customerId: ownerUser.id,
      serviceId: 'srv_1',
      districtId: 'dst_1',
      title: 'Kran tuzatish',
      description: 'Jo‘mrakdan suv oqyapti.',
      addressDetail: 'MAXFIY MANZIL: Chilonzor 9, 12-uy, 34-xonadon',
      preferredTime: 'TODAY',
      budgetMin: 50000,
      budgetMax: 100000,
      status: 'OPEN' as const,
      selectedOfferId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: ownerUser,
      service: { id: 'srv_1', slug: 'santexnika', nameUz: 'Santexnika', isActive: true },
      district: { id: 'dst_1', nameUz: 'Chilonzor' },
      photos: [],
      offers: [],
      selectedOffer: null,
    };

    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockRequest);

    // Usta profili va uning soha/tumanlarini topish
    vi.spyOn(prisma.masterProfile, 'findUnique').mockResolvedValue({
      id: 'mp_approved_1',
      userId: 'usr_master_1',
      bio: 'Santexnik',
      experienceYears: 5,
      status: 'APPROVED',
      rejectReason: null,
      ratingAvg: '0' as unknown as never,
      ratingCount: 0,
      completedCount: 0,
      createdAt: new Date(),
      services: [{ id: 'srv_1', slug: 'santexnika', nameUz: 'Santexnika', isActive: true }],
      districts: [{ id: 'dst_1', nameUz: 'Chilonzor' }],
    } as unknown as never);

    const response = await app.inject({
      method: 'GET',
      url: '/requests/req_123',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as {
      request: {
        title: string;
        addressDetail?: string;
        customer?: { phone?: string };
      };
    };

    expect(body.request.title).toBe('Kran tuzatish');
    // XAVFSIZLIK: addressDetail va mijoz telefoni ustaga ko'rinmasligi shart
    expect(body.request.addressDetail).toBeUndefined();
    expect(body.request.customer).toBeUndefined();
  });

  it('egasi so‘rovni bekor qila oladi (POST /requests/:id/cancel)', async () => {
    const token = await signToken({ userId: ownerUser.id });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(ownerUser);

    const mockRequest = {
      id: 'req_cancel_1',
      customerId: ownerUser.id,
      serviceId: 'srv_1',
      districtId: 'dst_1',
      title: 'Bekor qilinadigan so‘rov',
      description: 'Endi kerak emas bo‘ldi.',
      addressDetail: 'Manzil',
      preferredTime: null,
      budgetMin: null,
      budgetMax: null,
      status: 'OPEN' as const,
      selectedOfferId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockRequest as unknown as never);
    vi.spyOn(prisma.request, 'update').mockResolvedValue({
      ...mockRequest,
      status: 'CANCELLED',
    } as unknown as never);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never);

    const response = await app.inject({
      method: 'POST',
      url: '/requests/req_cancel_1/cancel',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe('CANCELLED');
  });
});
