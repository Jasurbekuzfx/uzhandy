import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { createSignedDownloadUrl } from '../storage/supabase.js';
import { notifyMastersAboutNewRequest } from '../notifications/requestNotification.js';
import {
  notifyCustomerWorkStarted,
  notifyWorkCompleted,
  notifyMasterRequestCancelled,
  notifyMasterReviewed,
} from '../notifications/workflowNotification.js';



const CreateRequestBodySchema = z
  .object({
    serviceId: z.string().min(1, 'Xizmat turi tanlanishi shart').max(100),
    districtId: z.string().min(1, 'Tuman tanlanishi shart').max(100),
    title: z
      .string()
      .min(5, 'Sarlavha kamida 5 ta belgidan iborat bo‘lishi kerak')
      .max(80, 'Sarlavha ko‘pi bilan 80 ta belgidan oshmasligi kerak'),
    description: z
      .string()
      .min(20, 'Tavsif kamida 20 ta belgidan iborat bo‘lishi kerak')
      .max(1000, 'Tavsif ko‘pi bilan 1000 ta belgidan oshmasligi kerak'),
    addressDetail: z
      .string()
      .min(5, 'Aniq manzil kamida 5 ta belgidan iborat bo‘lishi kerak')
      .max(200, 'Aniq manzil ko‘pi bilan 200 ta belgidan oshmasligi kerak'),
    preferredTime: z.enum(['ASAP', 'TODAY', 'THIS_WEEK', 'FLEXIBLE']).optional(),
    budgetMin: z.number().int().positive('Byudjet musbat son bo‘lishi kerak').optional(),
    budgetMax: z.number().int().positive('Byudjet musbat son bo‘lishi kerak').optional(),
    photoPaths: z
      .array(z.string().max(255))
      .min(0)
      .max(5, 'Ko‘pi bilan 5 ta rasm yuklash mumkin')
      .default([]),
  })
  .refine(
    (data) => {
      if (data.budgetMin !== undefined && data.budgetMax !== undefined) {
        return data.budgetMin <= data.budgetMax;
      }
      return true;
    },
    {
      message: 'Minimal byudjet maksimal byudjetdan katta bo‘lishi mumkin emas',
      path: ['budgetMax'],
    },
  );

export async function requestRoutes(app: FastifyInstance): Promise<void> {
  // POST /requests - Yangi so'rov yaratish (1 soatda 10 ta)
  app.post(
    '/requests',
    {
      preHandler: [requireAuth],
      config: {
        rateLimit: {
          max: 10,
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

    // Telefon raqami majburiy tekshiruvi
    if (!user.phone) {
      return reply.status(400).send({
        error: {
          code: 'PHONE_REQUIRED',
          message: 'So‘rov qoldirish uchun telefon raqamingiz bot orqali tasdiqlangan bo‘lishi shart',
        },
      });
    }

    // Bir foydalanuvchi bir vaqtda ko'pi bilan 5 ta OPEN so'rovga ega bo'la oladi
    const openRequestsCount = await prisma.request.count({
      where: {
        customerId: user.id,
        status: 'OPEN',
      },
    });

    if (openRequestsCount >= 5) {
      return reply.status(400).send({
        error: {
          code: 'OPEN_REQUESTS_LIMIT_EXCEEDED',
          message:
            'Sizda allaqachon 5 ta faol (ochiq) so‘rov mavjud. Yangi so‘rov yaratish uchun avvalgilarini yakunlang yoki bekor qiling.',
        },
      });
    }

    const parseResult = CreateRequestBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Noto‘g‘ri ma’lumot kiritildi',
        },
      });
    }

    const {
      serviceId,
      districtId,
      title,
      description,
      addressDetail,
      preferredTime,
      budgetMin,
      budgetMax,
      photoPaths,
    } = parseResult.data;

    // XAVFSIZLIK: har bir rasm yo'li aynan `${userId}/` bilan boshlanishi SHART
    for (const path of photoPaths) {
      if (!path.startsWith(`${user.id}/`)) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_PHOTO_PATH',
            message: 'Begona yoki noqonuniy rasm yo‘li aniqlandi',
          },
        });
      }
    }

    // Xizmat va tuman mavjudligini tekshirish
    const service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
    });
    if (!service) {
      return reply.status(400).send({
        error: { code: 'INVALID_SERVICE', message: 'Tanlangan xizmat turi mavjud emas yoki faol emas' },
      });
    }

    const district = await prisma.district.findUnique({
      where: { id: districtId },
    });
    if (!district) {
      return reply.status(400).send({
        error: { code: 'INVALID_DISTRICT', message: 'Tanlangan tuman mavjud emas' },
      });
    }

    const newRequest = await prisma.request.create({
      data: {
        customerId: user.id,
        serviceId,
        districtId,
        title,
        description,
        addressDetail,
        preferredTime,
        budgetMin,
        budgetMax,
        status: 'OPEN',
        photos: {
          create: photoPaths.map((p) => ({ storagePath: p })),
        },
      },
      include: {
        service: true,
        district: true,
        photos: true,
      },
    });

    // Javobni kutmasdan (fon vazifasi sifatida) mos ustalarga xabar yuborish
    notifyMastersAboutNewRequest(newRequest.id).catch((err) => {
      request.log.error(err, 'Ustalarga xabarnoma yuborishda xatolik yuz berdi');
    });

    return reply.status(201).send({
      ok: true,
      request: newRequest,
    });
  });


  // GET /requests/mine - Foydalanuvchining o'z so'rovlari ro'yxati (takliflar soni bilan)
  app.get('/requests/mine', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
      });
    }

    const requests = await prisma.request.findMany({
      where: { customerId: user.id },
      include: {
        service: true,
        district: true,
        photos: true,
        _count: {
          select: { offers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = requests.map((reqItem) => ({
      ...reqItem,
      offersCount: reqItem._count.offers,
    }));

    return { requests: formatted };
  });

  // GET /requests/:id - So'rov tafsilotlari (maxfiylik qoidalari bilan)
  app.get<{ Params: { id: string } }>(
    '/requests/:id',
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
        include: {
          customer: true,
          service: true,
          district: true,
          photos: true,
          offers: {
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
                    },
                  },
                },
              },
            },
          },
          selectedOffer: {
            include: {
              master: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!reqItem) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'So‘rov topilmadi' },
        });
      }

      const isOwner = reqItem.customerId === user.id;

      // Usta holatini tekshirish
      let isMatchedMaster = false;
      let isSelectedMaster = false;

      if (user.masterProfile && user.masterProfile.status === 'APPROVED') {
        const masterProfileWithRels = await prisma.masterProfile.findUnique({
          where: { id: user.masterProfile.id },
          include: { services: true, districts: true },
        });

        if (masterProfileWithRels) {
          const hasService = masterProfileWithRels.services.some((s) => s.id === reqItem.serviceId);
          const hasDistrict = masterProfileWithRels.districts.some((d) => d.id === reqItem.districtId);
          isMatchedMaster = hasService && hasDistrict;
        }

        if (reqItem.selectedOffer && reqItem.selectedOffer.masterId === user.masterProfile.id) {
          isSelectedMaster = true;
        }
      }

      // XAVFSIZLIK: Egasi yoki mos/tanlangan usta bo'lmasa -> 404
      if (!isOwner && !isMatchedMaster && !isSelectedMaster) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'So‘rov topilmadi' },
        });
      }

      // Rasmlar uchun imzolangan yuklash havolalarini generatsiya qilish
      const photosWithSignedUrls = await Promise.all(
        reqItem.photos.map(async (photo) => {
          let signedUrl = '';
          try {
            signedUrl = await createSignedDownloadUrl(photo.storagePath);
          } catch {
            // Test yoki storage xatosi bo'lsa bo'sh qoladi
          }
          return {
            id: photo.id,
            storagePath: photo.storagePath,
            signedUrl,
            createdAt: photo.createdAt,
          };
        }),
      );

      const myOffer = user.masterProfile
        ? reqItem.offers.find((o) => o.masterId === user.masterProfile?.id)
        : undefined;

      // 1. Egasi: hamma narsa, shu jumladan addressDetail va takliflar
      if (isOwner) {
        return {
          request: {
            id: reqItem.id,
            title: reqItem.title,
            description: reqItem.description,
            addressDetail: reqItem.addressDetail,
            preferredTime: reqItem.preferredTime,
            budgetMin: reqItem.budgetMin,
            budgetMax: reqItem.budgetMax,
            status: reqItem.status,
            service: reqItem.service,
            district: reqItem.district,
            photos: photosWithSignedUrls,
            offers: reqItem.offers,
            selectedOfferId: reqItem.selectedOfferId,
            selectedOffer: reqItem.selectedOffer
              ? {
                  id: reqItem.selectedOffer.id,
                  price: reqItem.selectedOffer.price,
                  message: reqItem.selectedOffer.message,
                  status: reqItem.selectedOffer.status,
                  master: {
                    id: reqItem.selectedOffer.master.id,
                    bio: reqItem.selectedOffer.master.bio,
                    experienceYears: reqItem.selectedOffer.master.experienceYears,
                    ratingAvg: reqItem.selectedOffer.master.ratingAvg,
                    ratingCount: reqItem.selectedOffer.master.ratingCount,
                    user: {
                      id: reqItem.selectedOffer.master.user.id,
                      firstName: reqItem.selectedOffer.master.user.firstName,
                      lastName: reqItem.selectedOffer.master.user.lastName,
                      username: reqItem.selectedOffer.master.user.username,
                      photoUrl: reqItem.selectedOffer.master.user.photoUrl,
                      phone: reqItem.selectedOffer.master.user.phone, // Tanlangan usta raqami mijozga ko'rinadi
                    },
                  },
                }
              : null,
            createdAt: reqItem.createdAt,
            updatedAt: reqItem.updatedAt,
          },
        };
      }

      // 2. Tanlangan usta: addressDetail va mijoz ismi, raqami ham ko'rinadi
      if (isSelectedMaster) {
        return {
          request: {
            id: reqItem.id,
            title: reqItem.title,
            description: reqItem.description,
            addressDetail: reqItem.addressDetail, // Tanlangan ustaga ochiq
            preferredTime: reqItem.preferredTime,
            budgetMin: reqItem.budgetMin,
            budgetMax: reqItem.budgetMax,
            status: reqItem.status,
            service: reqItem.service,
            district: reqItem.district,
            photos: photosWithSignedUrls,
            customer: {
              firstName: reqItem.customer.firstName,
              lastName: reqItem.customer.lastName,
              username: reqItem.customer.username,
              phone: reqItem.customer.phone, // Tanlangan ustaga mijoz raqami ochiq
            },
            selectedOfferId: reqItem.selectedOfferId,
            myOffer: myOffer
              ? {
                  id: myOffer.id,
                  price: myOffer.price,
                  message: myOffer.message,
                  status: myOffer.status,
                  createdAt: myOffer.createdAt,
                }
              : null,
            createdAt: reqItem.createdAt,
            updatedAt: reqItem.updatedAt,
          },
        };
      }

      // 3. Tasdiqlangan mos usta (tanlanmagan): addressDetail va mijoz raqami YO'Q
      return {
        request: {
          id: reqItem.id,
          title: reqItem.title,
          description: reqItem.description,
          preferredTime: reqItem.preferredTime,
          budgetMin: reqItem.budgetMin,
          budgetMax: reqItem.budgetMax,
          status: reqItem.status,
          service: reqItem.service,
          district: reqItem.district,
          photos: photosWithSignedUrls,
          myOffer: myOffer
            ? {
                id: myOffer.id,
                price: myOffer.price,
                message: myOffer.message,
                status: myOffer.status,
                createdAt: myOffer.createdAt,
              }
            : null,
          createdAt: reqItem.createdAt,
          updatedAt: reqItem.updatedAt,
          // addressDetail va mijoz raqami yo'q!
        },
      };
    },
  );


  // POST /requests/:id/start - Faqat tanlangan usta, ASSIGNED -> IN_PROGRESS
  app.post<{ Params: { id: string } }>(
    '/requests/:id/start',
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
        include: {
          customer: true,
          selectedOffer: { include: { master: { include: { user: true } } } },
        },
      });

      if (!reqItem) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'So‘rov topilmadi' },
        });
      }

      if (!reqItem.selectedOffer || reqItem.selectedOffer.master.userId !== user.id) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Faqat tanlangan usta ishni boshlay oladi' },
        });
      }

      if (reqItem.status !== 'ASSIGNED') {
        return reply.status(409).send({
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: 'Faqat usta biriktirilgan (ASSIGNED) holatidagi ishni boshlash mumkin',
          },
        });
      }

      const updated = await prisma.request.update({
        where: { id: reqItem.id },
        data: { status: 'IN_PROGRESS' },
      });

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'START_WORK',
          entity: 'Request',
          entityId: reqItem.id,
        },
      });

      // Mijozga botdan xabar
      void notifyCustomerWorkStarted({
        customerTelegramId: reqItem.customer.telegramId,
        masterName: `${user.firstName} ${user.lastName || ''}`.trim(),
        requestId: reqItem.id,
      }).catch((err) => {
        request.log.error(err, 'Mijozga ish boshlangani haqida xabar yuborishda xatolik');
      });

      return {
        ok: true,
        status: updated.status,
      };
    },
  );

  // POST /requests/:id/complete - Faqat mijoz, IN_PROGRESS -> DONE
  app.post<{ Params: { id: string } }>(
    '/requests/:id/complete',
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
        include: {
          customer: true,
          selectedOffer: { include: { master: { include: { user: true } } } },
        },
      });

      if (!reqItem || reqItem.customerId !== user.id) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'So‘rov topilmadi' },
        });
      }

      if (reqItem.status !== 'IN_PROGRESS') {
        return reply.status(409).send({
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: 'Faqat jarayonda (IN_PROGRESS) bo‘lgan ishni yakunlash mumkin',
          },
        });
      }

      const transactionResult = await prisma.$transaction(async (tx) => {
        const updated = await tx.request.update({
          where: { id: reqItem.id },
          data: { status: 'DONE' },
        });

        if (reqItem.selectedOffer) {
          await tx.masterProfile.update({
            where: { id: reqItem.selectedOffer.masterId },
            data: { completedCount: { increment: 1 } },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'COMPLETE_REQUEST',
            entity: 'Request',
            entityId: reqItem.id,
          },
        });

        return updated;
      });

      // Tomonlarga xabar yuborish
      if (reqItem.selectedOffer?.master?.user) {
        void notifyWorkCompleted({
          customerTelegramId: reqItem.customer.telegramId,
          masterTelegramId: reqItem.selectedOffer.master.user.telegramId,
          masterName: reqItem.selectedOffer.master.user.firstName,
          requestId: reqItem.id,
        }).catch((err) => {
          request.log.error(err, 'Ish yakunlanganida xabar yuborishda xatolik');
        });
      }

      return {
        ok: true,
        status: transactionResult.status,
      };
    },
  );

  // POST /requests/:id/cancel - Mijoz tomonidan bekor qilish (OPEN yoki ASSIGNED'da)
  app.post<{ Params: { id: string } }>(
    '/requests/:id/cancel',
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
        include: {
          selectedOffer: { include: { master: { include: { user: true } } } },
        },
      });

      if (!reqItem || reqItem.customerId !== user.id) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'So‘rov topilmadi' },
        });
      }

      if (reqItem.status !== 'OPEN' && reqItem.status !== 'ASSIGNED') {
        return reply.status(409).send({
          error: {
            code: 'CANNOT_CANCEL',
            message: 'Faqat OPEN yoki ASSIGNED holatidagi so‘rovni bekor qilish mumkin',
          },
        });
      }

      const cancelBodySchema = z.object({
        reason: z.string().min(5, 'Bekor qilish sababi kamida 5 ta belgidan iborat bo‘lishi kerak').max(300).optional(),
      });

      const parseResult = cancelBodySchema.safeParse(request.body || {});
      const reason = parseResult.success ? parseResult.data.reason : undefined;

      // Agar ASSIGNED bo'lsa, sabab majburiy
      if (reqItem.status === 'ASSIGNED' && (!reason || reason.trim().length < 5)) {
        return reply.status(400).send({
          error: {
            code: 'REASON_REQUIRED',
            message: 'Usta tanlangandan keyin bekor qilish uchun sabab ko‘rsatilishi shart (kamida 5 ta belgi)',
          },
        });
      }

      const updated = await prisma.request.update({
        where: { id: reqItem.id },
        data: { status: 'CANCELLED' },
      });

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'CANCEL_REQUEST',
          entity: 'Request',
          entityId: reqItem.id,
          meta: { reason: reason || 'Mijoz tomonidan bekor qilindi' },
        },
      });

      // Agar ASSIGNED holatda bekor qilinsa ustaga xabar boradi
      if (reqItem.status === 'ASSIGNED' && reqItem.selectedOffer?.master?.user && reason) {
        void notifyMasterRequestCancelled({
          masterTelegramId: reqItem.selectedOffer.master.user.telegramId,
          requestTitle: reqItem.title,
          reason,
        }).catch((err) => {
          request.log.error(err, 'Ustaga so‘rov bekor qilingani haqida xabar yuborishda xatolik');
        });
      }

      return {
        ok: true,
        status: updated.status,
      };
    },
  );

  // POST /requests/:id/review - Faqat mijoz, faqat DONE holatda baho qo'yish
  app.post<{ Params: { id: string } }>(
    '/requests/:id/review',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
        });
      }

      const reviewSchema = z.object({
        rating: z.number().int('Baho butun son bo‘lishi kerak').min(1, 'Minimal baho 1').max(5, 'Maksimal baho 5'),
        comment: z.string().max(500, 'Izoh 500 ta belgidan oshmasligi kerak').optional(),
      });

      const parseResult = reviewSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues[0]?.message || 'Baho noto‘g‘ri kiritildi',
          },
        });
      }

      const { rating, comment } = parseResult.data;

      const reqItem = await prisma.request.findUnique({
        where: { id: request.params.id },
        include: {
          selectedOffer: { include: { master: { include: { user: true } } } },
        },
      });

      if (!reqItem || reqItem.customerId !== user.id) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'So‘rov topilmadi' },
        });
      }

      if (reqItem.status !== 'DONE') {
        return reply.status(409).send({
          error: {
            code: 'REQUEST_NOT_DONE',
            message: 'Faqat bajarilgan (DONE) holatidagi so‘rovga baho berish mumkin',
          },
        });
      }

      if (!reqItem.selectedOffer) {
        return reply.status(400).send({
          error: { code: 'NO_MASTER_SELECTED', message: 'Ushbu so‘rov uchun usta tanlanmagan' },
        });
      }

      const masterId = reqItem.selectedOffer.masterId;

      // Takroriy baho tekshiruvi (requestId unique)
      const existingReview = await prisma.review.findUnique({
        where: { requestId: reqItem.id },
      });

      if (existingReview) {
        return reply.status(409).send({
          error: {
            code: 'ALREADY_REVIEWED',
            message: 'Siz ushbu so‘rovga allaqachon baho bergansiz',
          },
        });
      }

      // Tranzaksiyada: Review yaratish va MasterProfile ratingAvg hamda ratingCount qayta hisoblash
      const reviewResult = await prisma.$transaction(async (tx) => {
        const newReview = await tx.review.create({
          data: {
            requestId: reqItem.id,
            customerId: user.id,
            masterId,
            rating,
            comment: comment?.trim() || null,
          },
        });

        // ratingAvg va ratingCount qayta hisoblanadi (AVG va COUNT)
        const aggregate = await tx.review.aggregate({
          where: { masterId },
          _avg: { rating: true },
          _count: { rating: true },
        });

        await tx.masterProfile.update({
          where: { id: masterId },
          data: {
            ratingAvg: aggregate._avg.rating ?? rating,
            ratingCount: aggregate._count.rating,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'CREATE_REVIEW',
            entity: 'Review',
            entityId: newReview.id,
            meta: { rating, requestId: reqItem.id },
          },
        });

        return newReview;
      });

      // Ustaga baho haqida botdan xabar
      if (reqItem.selectedOffer.master.user) {
        void notifyMasterReviewed({
          masterTelegramId: reqItem.selectedOffer.master.user.telegramId,
          rating,
          comment,
          requestTitle: reqItem.title,
        }).catch((err) => {
          request.log.error(err, 'Ustaga baho xabarnomasini yuborishda xatolik');
        });
      }

      return reply.status(201).send({
        ok: true,
        review: reviewResult,
      });
    },
  );
}

