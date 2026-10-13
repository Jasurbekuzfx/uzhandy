import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MasterStatus, RequestStatus } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  notifyMasterApproved,
  notifyMasterRejected,
  notifyMasterSuspended,
} from '../notifications/adminNotification.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Barcha admin marshrutlari requireAuth va requireRole('ADMIN') talab qiladi
  const adminGuard = { preHandler: [requireAuth, requireRole('ADMIN')] };

  // 1. GET /admin/masters - Arizalar va ustalar ro'yxati
  app.get<{
    Querystring: {
      status?: MasterStatus;
    };
  }>('/admin/masters', adminGuard, async (request) => {
    const { status } = request.query;

    const masters = await prisma.masterProfile.findMany({
      where: status ? { status } : undefined,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            username: true,
            phone: true,
            photoUrl: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        services: true,
        districts: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = masters.map((m) => ({
      id: m.id,
      userId: m.userId,
      status: m.status,
      bio: m.bio,
      experienceYears: m.experienceYears,
      rejectReason: m.rejectReason,
      ratingAvg: Number(m.ratingAvg),
      ratingCount: m.ratingCount,
      completedCount: m.completedCount,
      createdAt: m.createdAt,
      user: {
        ...m.user,
        telegramId: m.user.telegramId.toString(),
      },
      services: m.services,
      districts: m.districts,
    }));

    return { masters: formatted };
  });

  // 2. POST /admin/masters/:id/approve - Usta arizasini tasdiqlash
  app.post<{ Params: { id: string } }>(
    '/admin/masters/:id/approve',
    adminGuard,
    async (request, reply) => {
      const admin = request.user!;

      const masterProfile = await prisma.masterProfile.findFirst({
        where: {
          OR: [{ id: request.params.id }, { userId: request.params.id }],
        },
        include: { user: true },
      });

      if (!masterProfile) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Usta profili topilmadi' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.masterProfile.update({
          where: { id: masterProfile.id },
          data: {
            status: 'APPROVED',
            rejectReason: null,
          },
        });

        await tx.user.update({
          where: { id: masterProfile.userId },
          data: { role: 'MASTER' },
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: 'APPROVE_MASTER',
            entity: 'MasterProfile',
            entityId: masterProfile.id,
          },
        });
      });

      // Ustaga botdan bildirishnoma
      void notifyMasterApproved({
        telegramId: masterProfile.user.telegramId,
      }).catch((err) => {
        request.log.error(err, 'Ustaga tasdiqlash xabari yuborishda xatolik');
      });

      return {
        ok: true,
        status: 'APPROVED',
      };
    },
  );

  // 3. POST /admin/masters/:id/reject - Usta arizasini rad etish (sabab majburiy)
  app.post<{ Params: { id: string } }>(
    '/admin/masters/:id/reject',
    adminGuard,
    async (request, reply) => {
      const admin = request.user!;

      const rejectSchema = z.object({
        reason: z
          .string()
          .min(5, 'Rad etish sababi kamida 5 ta belgidan iborat bo‘lishi kerak')
          .max(300, 'Sabab 300 ta belgidan oshmasligi kerak'),
      });

      const parseResult = rejectSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues[0]?.message || 'Rad etish sababi kiritilishi shart',
          },
        });
      }

      const { reason } = parseResult.data;

      const masterProfile = await prisma.masterProfile.findFirst({
        where: {
          OR: [{ id: request.params.id }, { userId: request.params.id }],
        },
        include: { user: true },
      });

      if (!masterProfile) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Usta profili topilmadi' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.masterProfile.update({
          where: { id: masterProfile.id },
          data: {
            status: 'REJECTED',
            rejectReason: reason,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: 'REJECT_MASTER',
            entity: 'MasterProfile',
            entityId: masterProfile.id,
            meta: { reason },
          },
        });
      });

      // Ustaga botdan rad etilganlik haqida xabar
      void notifyMasterRejected({
        telegramId: masterProfile.user.telegramId,
        reason,
      }).catch((err) => {
        request.log.error(err, 'Ustaga rad etish xabari yuborishda xatolik');
      });

      return {
        ok: true,
        status: 'REJECTED',
      };
    },
  );

  // 4. POST /admin/masters/:id/suspend - Usta faoliyatini to'xtatish
  app.post<{ Params: { id: string } }>(
    '/admin/masters/:id/suspend',
    adminGuard,
    async (request, reply) => {
      const admin = request.user!;

      const suspendSchema = z.object({
        reason: z.string().max(300).optional(),
      });

      const parseResult = suspendSchema.safeParse(request.body || {});
      const reason = parseResult.success ? parseResult.data.reason : undefined;

      const masterProfile = await prisma.masterProfile.findFirst({
        where: {
          OR: [{ id: request.params.id }, { userId: request.params.id }],
        },
        include: { user: true },
      });

      if (!masterProfile) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Usta profili topilmadi' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.masterProfile.update({
          where: { id: masterProfile.id },
          data: {
            status: 'SUSPENDED',
            rejectReason: reason || null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: 'SUSPEND_MASTER',
            entity: 'MasterProfile',
            entityId: masterProfile.id,
            meta: { reason: reason || 'Administrator tomonidan to‘xtatildi' },
          },
        });
      });

      // Ustaga bildirishnoma
      void notifyMasterSuspended({
        telegramId: masterProfile.user.telegramId,
        reason,
      }).catch((err) => {
        request.log.error(err, 'Ustaga to‘xtatish xabari yuborishda xatolik');
      });

      return {
        ok: true,
        status: 'SUSPENDED',
      };
    },
  );

  // 5. POST /admin/users/:id/block - Foydalanuvchini bloklash (sabab majburiy)
  app.post<{ Params: { id: string } }>(
    '/admin/users/:id/block',
    adminGuard,
    async (request, reply) => {
      const admin = request.user!;

      const blockSchema = z.object({
        reason: z
          .string()
          .min(5, 'Bloklash sababi kamida 5 ta belgidan iborat bo‘lishi kerak')
          .max(300),
      });

      const parseResult = blockSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues[0]?.message || 'Bloklash sababi kiritilishi shart',
          },
        });
      }

      const { reason } = parseResult.data;

      const targetUser = await prisma.user.findUnique({
        where: { id: request.params.id },
      });

      if (!targetUser) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Foydalanuvchi topilmadi' },
        });
      }

      if (targetUser.role === 'ADMIN') {
        return reply.status(400).send({
          error: { code: 'CANNOT_BLOCK_ADMIN', message: 'Admin hisobini bloklab bo‘lmaydi' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: targetUser.id },
          data: { isBlocked: true },
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: 'BLOCK_USER',
            entity: 'User',
            entityId: targetUser.id,
            meta: { reason },
          },
        });
      });

      return {
        ok: true,
        isBlocked: true,
      };
    },
  );

  // 6. POST /admin/users/:id/unblock - Foydalanuvchini blokdan chiqarish
  app.post<{ Params: { id: string } }>(
    '/admin/users/:id/unblock',
    adminGuard,
    async (request, reply) => {
      const admin = request.user!;

      const targetUser = await prisma.user.findUnique({
        where: { id: request.params.id },
      });

      if (!targetUser) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Foydalanuvchi topilmadi' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: targetUser.id },
          data: { isBlocked: false },
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: 'UNBLOCK_USER',
            entity: 'User',
            entityId: targetUser.id,
          },
        });
      });

      return {
        ok: true,
        isBlocked: false,
      };
    },
  );

  // 7. GET /admin/requests - Barcha so'rovlar ro'yxati (sahifalab)
  app.get<{
    Querystring: {
      status?: RequestStatus;
      page?: string;
      limit?: string;
    };
  }>('/admin/requests', adminGuard, async (request) => {
    const { status } = request.query;
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(request.query.limit || '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where = status ? { status } : undefined;

    const [total, requestsList] = await Promise.all([
      prisma.request.count({ where }),
      prisma.request.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              username: true,
            },
          },
          service: true,
          district: true,
          photos: true,
          selectedOffer: {
            include: {
              master: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: { offers: true },
          },
        },
      }),
    ]);

    const formatted = requestsList.map((req) => ({
      id: req.id,
      title: req.title,
      description: req.description,
      addressDetail: req.addressDetail,
      preferredTime: req.preferredTime,
      budgetMin: req.budgetMin,
      budgetMax: req.budgetMax,
      status: req.status,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      customer: req.customer,
      service: req.service,
      district: req.district,
      photosCount: req.photos.length,
      offersCount: req._count.offers,
      selectedOffer: req.selectedOffer
        ? {
            id: req.selectedOffer.id,
            price: req.selectedOffer.price,
            message: req.selectedOffer.message,
            masterName: `${req.selectedOffer.master.user.firstName} ${req.selectedOffer.master.user.lastName || ''}`.trim(),
            masterPhone: req.selectedOffer.master.user.phone,
          }
        : null,
    }));

    return {
      requests: formatted,
      total,
      page,
      limit,
    };
  });

  // 8. GET /admin/stats - Statistika (Bugungi va jami)
  app.get('/admin/stats', adminGuard, async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalRequests,
      todayRequests,
      totalOffers,
      todayOffers,
      totalAssigned,
      todayAssigned,
      totalCompleted,
      todayCompleted,
      activeMasters,
      pendingMasters,
      totalUsers,
    ] = await Promise.all([
      prisma.request.count(),
      prisma.request.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.offer.count(),
      prisma.offer.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.request.count({
        where: { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'DONE'] } },
      }),
      prisma.request.count({
        where: {
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'DONE'] },
          updatedAt: { gte: todayStart },
        },
      }),
      prisma.request.count({ where: { status: 'DONE' } }),
      prisma.request.count({
        where: { status: 'DONE', updatedAt: { gte: todayStart } },
      }),
      prisma.masterProfile.count({ where: { status: 'APPROVED' } }),
      prisma.masterProfile.count({ where: { status: 'PENDING' } }),
      prisma.user.count(),
    ]);

    return {
      stats: {
        requests: {
          total: totalRequests,
          today: todayRequests,
        },
        offers: {
          total: totalOffers,
          today: todayOffers,
        },
        assigned: {
          total: totalAssigned,
          today: todayAssigned,
        },
        completed: {
          total: totalCompleted,
          today: todayCompleted,
        },
        activeMasters,
        pendingMasters,
        totalUsers,
      },
    };
  });
}
