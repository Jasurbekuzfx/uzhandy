import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import {
  notifyCustomerAboutNewOffer,
  notifyMasterAboutSelection,
  notifyRejectedMasters,
} from '../notifications/offerNotification.js';

const CreateOfferBodySchema = z.object({
  price: z
    .number()
    .int('Narx butun son bo‘lishi kerak')
    .min(50000, 'Taklif narxi kamida 50 000 so‘m bo‘lishi kerak')
    .max(50000000, 'Taklif narxi ko‘pi bilan 50 000 000 so‘m bo‘lishi mumkin'),
  message: z
    .string()
    .min(10, 'Taklif izohi kamida 10 ta belgidan iborat bo‘lishi kerak')
    .max(500, 'Taklif izohi ko‘pi bilan 500 ta belgidan oshmasligi kerak'),
});

const SelectOfferBodySchema = z.object({
  offerId: z.string().min(1, 'Taklif ID ko‘rsatilishi shart').max(100),
});

export async function offerRoutes(app: FastifyInstance): Promise<void> {
  // POST /requests/:id/offers - So'rovga yangi taklif yuborish (1 soatda 30 ta)
  app.post<{ Params: { id: string } }>(
    '/requests/:id/offers',
    {
      preHandler: [requireAuth],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 hour',
          keyGenerator: (req) => req.user?.id || req.ip,
        },
      },
    },
    async (request, reply) => {

      const user = request.user;
      if (!user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
        });
      }

      // Usta holatini tekshirish (faqat APPROVED)
      const masterProfile = await prisma.masterProfile.findUnique({
        where: { userId: user.id },
        include: {
          services: true,
          districts: true,
        },
      });

      if (!masterProfile || masterProfile.status !== 'APPROVED') {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Faqat tasdiqlangan (APPROVED) ustalar taklif yubora oladi',
          },
        });
      }

      const parseResult = CreateOfferBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues[0]?.message || 'Noto‘g‘ri ma’lumot kiritildi',
          },
        });
      }

      const { price, message } = parseResult.data;

      // So'rovni tekshirish
      const reqItem = await prisma.request.findUnique({
        where: { id: request.params.id },
        include: {
          customer: true,
          service: true,
          district: true,
        },
      });

      if (!reqItem) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'So‘rov topilmadi' },
        });
      }

      if (reqItem.status !== 'OPEN') {
        return reply.status(400).send({
          error: {
            code: 'REQUEST_NOT_OPEN',
            message: 'Faqat ochiq (OPEN) holatidagi so‘rovlarga taklif berish mumkin',
          },
        });
      }

      // O'zining so'roviga taklif berib bo'lmaydi
      if (reqItem.customerId === user.id) {
        return reply.status(400).send({
          error: {
            code: 'SELF_BID_NOT_ALLOWED',
            message: 'O‘zingiz qoldirgan so‘rovga taklif bera olmaysiz',
          },
        });
      }

      // Usta tanlagan xizmat va tuman so'rovga mos bo'lishi shart
      const hasMatchingService = masterProfile.services.some((s) => s.id === reqItem.serviceId);
      const hasMatchingDistrict = masterProfile.districts.some((d) => d.id === reqItem.districtId);

      if (!hasMatchingService || !hasMatchingDistrict) {
        return reply.status(400).send({
          error: {
            code: 'SERVICE_OR_DISTRICT_MISMATCH',
            message: 'Ushbu so‘rov sizning xizmat turingiz yoki xizmat ko‘rsatish hududingizga mos kelmaydi',
          },
        });
      }

      // Takroriy taklif tekshiruvi (unique: requestId + masterId)
      const existingOffer = await prisma.offer.findUnique({
        where: {
          requestId_masterId: {
            requestId: reqItem.id,
            masterId: masterProfile.id,
          },
        },
      });

      if (existingOffer) {
        return reply.status(409).send({
          error: {
            code: 'ALREADY_OFFERED',
            message: 'Siz ushbu so‘rovga allaqachon taklif bergansiz',
          },
        });
      }

      // Taklif yaratish
      const newOffer = await prisma.offer.create({
        data: {
          requestId: reqItem.id,
          masterId: masterProfile.id,
          price,
          message,
          status: 'PENDING',
        },
      });

      // Audit log yozish
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'CREATE_OFFER',
          entity: 'Offer',
          entityId: newOffer.id,
          meta: { price, requestId: reqItem.id },
        },
      });

      // Mijozga yangi taklif haqida bot orqali bildirishnoma yuborish
      void notifyCustomerAboutNewOffer({
        customerTelegramId: reqItem.customer.telegramId,
        price,
        masterName: `${user.firstName} ${user.lastName || ''}`.trim(),
        masterRating: Number(masterProfile.ratingAvg) || 5,
        requestId: reqItem.id,
        message,
      }).catch((err) => {
        request.log.error(err, 'Mijozga yangi taklif xabarnomasini yuborishda xatolik');
      });

      return reply.status(201).send({
        ok: true,
        offer: newOffer,
      });
    },
  );

  // POST /offers/:id/withdraw - Taklifni qaytarib olish (faqat taklif egasi, faqat PENDING va so'rov OPEN bo'lsa)
  app.post<{ Params: { id: string } }>(
    '/offers/:id/withdraw',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
        });
      }

      const offer = await prisma.offer.findUnique({
        where: { id: request.params.id },
        include: {
          master: true,
          request: true,
        },
      });

      if (!offer || offer.master.userId !== user.id) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Taklif topilmadi' },
        });
      }

      if (offer.status !== 'PENDING') {
        return reply.status(400).send({
          error: {
            code: 'CANNOT_WITHDRAW',
            message: 'Faqat kutilayotgan (PENDING) holatidagi taklifni qaytarib olish mumkin',
          },
        });
      }

      if (offer.request.status !== 'OPEN') {
        return reply.status(400).send({
          error: {
            code: 'REQUEST_NOT_OPEN',
            message: 'Faqat ochiq (OPEN) holatidagi so‘rov taklifini qaytarib olish mumkin',
          },
        });
      }

      const updated = await prisma.offer.update({
        where: { id: offer.id },
        data: { status: 'WITHDRAWN' },
      });

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'WITHDRAW_OFFER',
          entity: 'Offer',
          entityId: offer.id,
          meta: { requestId: offer.requestId },
        },
      });

      return {
        ok: true,
        status: updated.status,
      };
    },
  );

  // GET /requests/:id/offers - Faqat so'rov egasi uchun takliflar ro'yxati (usta raqamisiz!)
  app.get<{ Params: { id: string } }>(
    '/requests/:id/offers',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
        });
      }

      const reqItem = await prisma.request.findUnique({
        where: { id: request.params.id },
      });

      if (!reqItem || reqItem.customerId !== user.id) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'So‘rov topilmadi' },
        });
      }

      const offers = await prisma.offer.findMany({
        where: { requestId: reqItem.id },
        include: {
          master: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                  photoUrl: true,
                  // phone XAVFSIZLIK sababli EXCLUDED!
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        offers: offers.map((o) => ({
          id: o.id,
          price: o.price,
          message: o.message,
          status: o.status,
          createdAt: o.createdAt,
          master: {
            id: o.master.id,
            bio: o.master.bio,
            experienceYears: o.master.experienceYears,
            ratingAvg: Number(o.master.ratingAvg),
            ratingCount: o.master.ratingCount,
            completedCount: o.master.completedCount,
            user: o.master.user,
          },
        })),
      };
    },
  );

  // POST /requests/:id/select - Faqat egasi, OPEN holatda ustani tanlash (Tranzaksiya va konkurentlikdan himoya)
  app.post<{ Params: { id: string } }>(
    '/requests/:id/select',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
        });
      }

      const parseResult = SelectOfferBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues[0]?.message || 'Taklif ID talab qilinadi',
          },
        });
      }

      const { offerId } = parseResult.data;

      const offerToSelect = await prisma.offer.findUnique({
        where: { id: offerId },
        include: { master: { include: { user: true } } },
      });

      if (!offerToSelect || offerToSelect.requestId !== request.params.id) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Tanlanayotgan taklif topilmadi' },
        });
      }

      if (offerToSelect.status !== 'PENDING') {
        return reply.status(400).send({
          error: {
            code: 'INVALID_OFFER_STATUS',
            message: 'Faqat kutilayotgan (PENDING) holatidagi taklifni tanlash mumkin',
          },
        });
      }

      // Konkurent so'rovlardan himoyalangan atomik tranzaksiya
      const transactionResult = await prisma.$transaction(async (tx) => {
        // Status OPEN bo'lishi sharti bilan yangilaymiz (count tekshiruvi)
        const updateCount = await tx.request.updateMany({
          where: {
            id: request.params.id,
            customerId: user.id,
            status: 'OPEN',
          },
          data: {
            status: 'ASSIGNED',
            selectedOfferId: offerId,
          },
        });

        if (updateCount.count === 0) {
          return null;
        }

        // Tanlangan taklifni ACCEPTED qilish
        await tx.offer.update({
          where: { id: offerId },
          data: { status: 'ACCEPTED' },
        });

        // Boshqa PENDING takliflarni REJECTED qilish
        await tx.offer.updateMany({
          where: {
            requestId: request.params.id,
            id: { not: offerId },
            status: 'PENDING',
          },
          data: { status: 'REJECTED' },
        });

        // AuditLog yozish
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'SELECT_OFFER',
            entity: 'Request',
            entityId: request.params.id,
            meta: { selectedOfferId: offerId },
          },
        });

        return tx.request.findUnique({
          where: { id: request.params.id },
          include: {
            customer: true,
            selectedOffer: {
              include: {
                master: {
                  include: { user: true },
                },
              },
            },
            offers: {
              include: {
                master: {
                  include: { user: true },
                },
              },
            },
          },
        });
      });

      // Agar boshqa parallel so'rov avvalroq tanlagan bo'lsa yoki so'rov OPEN bo'lmasa
      if (!transactionResult) {
        return reply.status(409).send({
          error: {
            code: 'CANNOT_SELECT',
            message: 'Ushbu so‘rov allaqachon boshqa ustaga biriktirilgan yoki ochiq emas',
          },
        });
      }

      // 1. Tanlangan ustaga Telegram orqali mijoz kontaktlari va manzilini yuborish
      if (transactionResult.selectedOffer?.master?.user?.telegramId) {
        void notifyMasterAboutSelection({
          masterTelegramId: transactionResult.selectedOffer.master.user.telegramId,
          customerName: `${transactionResult.customer.firstName} ${transactionResult.customer.lastName || ''}`.trim(),
          customerPhone: transactionResult.customer.phone || '',
          customerAddress: transactionResult.addressDetail,
          customerTelegramId: transactionResult.customer.telegramId,
          customerUsername: transactionResult.customer.username,
          requestId: transactionResult.id,
        }).catch((err) => {
          request.log.error(err, 'Tanlangan ustaga bildirishnoma yuborishda xatolik');
        });
      }

      // 2. Rad etilgan ustalarga qisqa xabar yuborish
      const rejectedTelegramIds = transactionResult.offers
        .filter((o) => o.id !== offerId && o.status === 'REJECTED')
        .map((o) => o.master.user.telegramId);

      if (rejectedTelegramIds.length > 0) {
        void notifyRejectedMasters(rejectedTelegramIds).catch((err) => {
          request.log.error(err, 'Rad etilgan ustalarga xabar yuborishda xatolik');
        });
      }

      return {
        ok: true,
        status: 'ASSIGNED',
        selectedOfferId: offerId,
      };
    },
  );

  // GET /offers/mine - Usta uchun o'z takliflari ro'yxati
  app.get('/offers/mine', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
      });
    }

    const masterProfile = await prisma.masterProfile.findUnique({
      where: { userId: user.id },
    });

    if (!masterProfile) {
      return { offers: [] };
    }

    const offers = await prisma.offer.findMany({
      where: { masterId: masterProfile.id },
      include: {
        request: {
          include: {
            service: true,
            district: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      offers: offers.map((o) => ({
        id: o.id,
        price: o.price,
        message: o.message,
        status: o.status,
        createdAt: o.createdAt,
        request: {
          id: o.request.id,
          title: o.request.title,
          status: o.request.status,
          service: o.request.service,
          district: o.request.district,
          preferredTime: o.request.preferredTime,
          budgetMin: o.request.budgetMin,
          budgetMax: o.request.budgetMax,
        },
      })),
    };
  });
}
