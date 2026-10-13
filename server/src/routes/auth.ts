import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { verifyTelegramInitData, TelegramAuthError } from '../auth/telegram.js';
import { signToken } from '../auth/jwt.js';
import { requireAuth } from '../auth/middleware.js';

const TelegramAuthBodySchema = z.object({
  initData: z
    .string()
    .min(1, 'initData parametri talab qilinadi')
    .max(4096, 'initData hajmi me’yordan oshdi'),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/telegram - Telegram initData orqali kirish / ro'yxatdan o'tish (1 daqiqada 10 ta)
  app.post(
    '/auth/telegram',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.ip,
        },
      },
    },
    async (request, reply) => {

    const parseResult = TelegramAuthBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Noto‘g‘ri ma’lumot yuborildi',
        },
      });
    }

    const { initData } = parseResult.data;

    let telegramUser;
    try {
      telegramUser = verifyTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
    } catch (err) {
      const message =
        err instanceof TelegramAuthError ? err.message : 'Telegram ma’lumotlari yaroqsiz';
      return reply.status(401).send({
        error: {
          code: 'INVALID_TELEGRAM_DATA',
          message,
        },
      });
    }

    const telegramIdBigInt = BigInt(telegramUser.id);
    const isAdmin = env.adminTelegramIds.includes(telegramIdBigInt);

    // Foydalanuvchini bazada telegramId bo'yicha topish yoki yaratish (upsert)
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: telegramIdBigInt },
    });

    let roleToAssign: 'ADMIN' | 'CUSTOMER' | 'MASTER' = 'CUSTOMER';
    if (isAdmin) {
      roleToAssign = 'ADMIN';
    } else if (existingUser) {
      roleToAssign = existingUser.role;
    }

    const user = await prisma.user.upsert({
      where: { telegramId: telegramIdBigInt },
      create: {
        telegramId: telegramIdBigInt,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name || null,
        username: telegramUser.username || null,
        photoUrl: telegramUser.photo_url || null,
        role: roleToAssign,
      },
      update: {
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name || null,
        username: telegramUser.username || null,
        photoUrl: telegramUser.photo_url || null,
        ...(isAdmin ? { role: 'ADMIN' } : {}),
      },
      include: {
        masterProfile: true,
      },
    });

    if (user.isBlocked) {
      return reply.status(403).send({
        error: {
          code: 'USER_BLOCKED',
          message: 'Foydalanuvchi hisobi bloklangan',
        },
      });
    }

    const token = await signToken({ userId: user.id });

    return {
      token,
      user,
    };
  });

  // GET /me - Joriy avtorizatsiyadan o'tgan foydalanuvchi profili
  app.get('/me', { preHandler: [requireAuth] }, async (request) => {
    return {
      user: request.user,
    };
  });
}
