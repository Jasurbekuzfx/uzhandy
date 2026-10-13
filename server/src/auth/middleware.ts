import { FastifyRequest, FastifyReply } from 'fastify';
import { User, MasterProfile, UserRole } from '@prisma/client';
import { prisma } from '../db.js';
import { verifyToken } from './jwt.js';

export type AuthenticatedUser = User & {
  masterProfile: MasterProfile | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Bearer tokenni tekshiradi va foydalanuvchini bevosita bazadan oladi
 * Rol va bloklanganlik holati faqat bazadan tekshiriladi
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Avtorizatsiya talab qilinadi (token yo‘q)',
      },
    });
    return;
  }

  const token = authHeader.slice(7).trim();

  let userId: string;
  try {
    const payload = await verifyToken(token);
    userId = payload.userId;
  } catch {
    reply.status(401).send({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Yaroqsiz yoki muddati o‘tgan token',
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { masterProfile: true },
  });

  if (!user) {
    reply.status(401).send({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Foydalanuvchi topilmadi',
      },
    });
    return;
  }

  if (user.isBlocked) {
    reply.status(403).send({
      error: {
        code: 'USER_BLOCKED',
        message: 'Foydalanuvchi hisobi bloklangan',
      },
    });
    return;
  }

  request.user = user;
}

/**
 * Foydalanuvchi rolini tekshiruvchi yordamchi preHandler
 */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Avtorizatsiya talab qilinadi',
        },
      });
      return;
    }

    if (!roles.includes(request.user.role)) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Ushbu amalni bajarish uchun huquq yetarli emas',
        },
      });
      return;
    }
  };
}
