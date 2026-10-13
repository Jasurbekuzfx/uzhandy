import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { bot } from '../bot/bot.js';
import { signToken } from '../auth/jwt.js';
import { notifyMastersAboutNewRequest } from '../notifications/requestNotification.js';

describe('Phase 6: Webhook & Master Notifications', () => {
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

  describe('POST /telegram/webhook secret token validation', () => {
    it('noto‘g‘ri yoki mavjud bo‘lmagan secret token bilan 401 qaytarishi kerak', async () => {
      // 1. Headersiz so'rov
      const resWithoutHeader = await app.inject({
        method: 'POST',
        url: '/telegram/webhook',
        payload: { update_id: 123 },
      });

      expect(resWithoutHeader.statusCode).toBe(401);
      const json1 = JSON.parse(resWithoutHeader.body);
      expect(json1.error.code).toBe('UNAUTHORIZED');

      // 2. Noto'g'ri secret token bilan so'rov
      const resWithWrongSecret = await app.inject({
        method: 'POST',
        url: '/telegram/webhook',
        headers: {
          'x-telegram-bot-api-secret-token': 'wrong_secret_token_123',
        },
        payload: { update_id: 124 },
      });

      expect(resWithWrongSecret.statusCode).toBe(401);
      const json2 = JSON.parse(resWithWrongSecret.body);
      expect(json2.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('notifyMastersAboutNewRequest eligibility rules', () => {
    it('faqat mos xizmat va tumandagi APPROVED ustalar tanlanadi, PENDING yoki boshqa tuman ustalari xabar olmaydi', async () => {
      // Bot sendMessage ni mock qilish
      const sendMock = vi.spyOn(bot.api, 'sendMessage').mockImplementation(async () => {
        return {} as unknown as ReturnType<typeof bot.api.sendMessage>;
      });

      // So'rov ma'lumotlari
      const mockRequest = {
        id: 'req_test_notification_1',
        title: 'Krant ta’miri',
        description: 'Oshxonadagi krantdan suv sizib chiqmoqda, almashtirish kerak',
        status: 'OPEN' as const,
        serviceId: 'srv_santexnika',
        districtId: 'dist_chilonzor',
        preferredTime: 'ASAP',
        budgetMin: 50000,
        budgetMax: 100000,
        customerId: 'usr_customer_notif',
        service: { id: 'srv_santexnika', nameUz: 'Santexnika' },
        district: { id: 'dist_chilonzor', nameUz: 'Chilonzor' },
      };

      // 1. Mos va APPROVED usta
      const approvedMaster = {
        id: 'mp_approved_1',
        userId: 'usr_master_approved',
        status: 'APPROVED' as const,
        user: {
          id: 'usr_master_approved',
          telegramId: BigInt(777001),
          isBlocked: false,
        },
      };

      vi.spyOn(prisma.request, 'findUnique').mockResolvedValue(mockRequest as never);
      const findManySpy = vi.spyOn(prisma.masterProfile, 'findMany').mockResolvedValue([approvedMaster] as never);
      vi.spyOn(prisma.notificationLog, 'findUnique').mockResolvedValue(null as never);
      const createLogMock = vi.spyOn(prisma.notificationLog, 'create').mockResolvedValue({} as never);

      await notifyMastersAboutNewRequest('req_test_notification_1');

      // findMany chaqirilganda status: 'APPROVED' ekanligi tekshiriladi
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
          }),
        }),
      );

      // 1 marta APPROVED ustaga sendMessage chaqirilganini tekshiramiz
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(
        777001,
        expect.stringContaining('Santexnika'),
        expect.objectContaining({
          reply_markup: expect.anything(),
        }),
      );

      // Manzil va telefon xabarda yo'qligini tekshiramiz
      const messageText = sendMock.mock.calls[0]?.[1] as string;
      expect(messageText).not.toContain('Chilonzor 9-mavze');
      expect(messageText).not.toContain('+9989');

      // NotificationLog'ga SENT holatida yozilganini tekshiramiz
      expect(createLogMock).toHaveBeenCalledWith({
        data: {
          requestId: 'req_test_notification_1',
          userId: 'usr_master_approved',
          type: 'NEW_REQUEST',
          status: 'SENT',
        },
      });

      sendMock.mockRestore();
    });
  });

  describe('GET /master/requests access and privacy rules', () => {
    it('tasdiqlanmagan (PENDING yoki oddiy) foydalanuvchiga 403 qaytarishi kerak', async () => {
      const pendingUser = {
        id: 'usr_pending_m',
        telegramId: BigInt(88811),
        firstName: 'Ali',
        lastName: null,
        username: null,
        photoUrl: null,
        phone: '+998901112233',
        role: 'CUSTOMER' as const,
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        masterProfile: {
          id: 'mp_pending_m',
          userId: 'usr_pending_m',
          bio: 'Usta bio',
          experienceYears: 2,
          status: 'PENDING' as const,
          rejectReason: null,
          ratingAvg: 0,
          ratingCount: 0,
          completedCount: 0,
          createdAt: new Date(),
        },
      };

      const token = await signToken({
        userId: pendingUser.id,
      });

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(pendingUser as never);
      vi.spyOn(prisma.masterProfile, 'findUnique').mockResolvedValue(pendingUser.masterProfile as never);

      const res = await app.inject({
        method: 'GET',
        url: '/master/requests',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('tasdiqlangan (APPROVED) ustaga so‘rovlar qaytishi kerak, lekin addressDetail ko‘rinmasligi kerak', async () => {
      const approvedMaster = {
        id: 'usr_approved_m',
        telegramId: BigInt(88822),
        firstName: 'Vali',
        lastName: 'Usta',
        username: 'vali_usta',
        photoUrl: null,
        phone: '+998901112244',
        role: 'MASTER' as const,
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        masterProfile: {
          id: 'mp_approved_m',
          userId: 'usr_approved_m',
          bio: 'Santexnik',
          experienceYears: 5,
          status: 'APPROVED' as const,
          rejectReason: null,
          ratingAvg: 5,
          ratingCount: 1,
          completedCount: 1,
          createdAt: new Date(),
          services: [{ id: 'srv_santexnika', slug: 'santexnika', nameUz: 'Santexnika', isActive: true }],
          districts: [{ id: 'dist_chilonzor', nameUz: 'Chilonzor' }],
        },
      };

      const token = await signToken({
        userId: approvedMaster.id,
      });

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(approvedMaster as never);
      vi.spyOn(prisma.masterProfile, 'findUnique').mockResolvedValue(approvedMaster.masterProfile as never);

      const mockOpenRequest = {
        id: 'req_open_1',
        title: 'Truba teshilgan',
        description: 'Zudlik bilan santexnik kerak, suv toshmoqda',
        addressDetail: 'Chilonzor 19-mavze, 44-uy, 12-xonadon (MAXFIY)',
        preferredTime: 'ASAP',
        budgetMin: 80000,
        budgetMax: 150000,
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        service: { id: 'srv_santexnika', nameUz: 'Santexnika' },
        district: { id: 'dist_chilonzor', nameUz: 'Chilonzor' },
        photos: [],
        _count: { offers: 2 },
        offers: [],
      };

      vi.spyOn(prisma.request, 'count').mockResolvedValue(1 as never);
      vi.spyOn(prisma.request, 'findMany').mockResolvedValue([mockOpenRequest] as never);

      const res = await app.inject({
        method: 'GET',
        url: '/master/requests',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.requests).toHaveLength(1);
      expect(json.requests[0].title).toBe('Truba teshilgan');
      expect(json.requests[0].hasOffered).toBe(false);

      // XAVFSIZLIK: addressDetail yoki mijoz telefoni HECH QACHON ko'rinmaydi!
      expect(json.requests[0].addressDetail).toBeUndefined();
      expect(json.requests[0].phone).toBeUndefined();
      expect(res.body).not.toContain('Chilonzor 19-mavze');
    });
  });
});
