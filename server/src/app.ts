import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastify, { FastifyInstance, FastifyError } from 'fastify';
import { prisma } from './db.js';
import { env } from './env.js';
import { authRoutes } from './routes/auth.js';
import { masterRoutes } from './routes/master.js';
import { uploadRoutes } from './routes/uploads.js';
import { requestRoutes } from './routes/requests.js';
import { webhookRoutes } from './routes/webhook.js';
import { offerRoutes } from './routes/offers.js';
import { adminRoutes } from './routes/admin.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  // Bo'sh JSON tana kelganda xatolik bermaslik uchun xavfsiz JSON parser
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const raw = typeof body === 'string' ? body : body.toString('utf-8');
    if (!raw || raw.trim() === '') {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(raw));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Xavfsizlik sarlavhalari (Helmet)
  app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  // CORS - WEB_APP_URL va vercel domenlariga ruxsat beradi
  const allowedOrigins = env.WEB_APP_URL.split(',').map((u) => u.trim().replace(/\/$/, ''));

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      const cleanOrigin = origin.replace(/\/$/, '');
      const isAllowed =
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.vercel.app') ||
        cleanOrigin === 'http://localhost:5173';

      if (isAllowed) {
        cb(null, true);
        return;
      }
      cb(new Error("CORS ruxsati berilmadi"), false);
    },
    credentials: true,
  });

  // So'rovlar sonini cheklash - global sozlama (userId yoki IP bo'yicha)
  app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    hook: 'preHandler',
    keyGenerator: (req) => req.user?.id || req.ip,
    errorResponseBuilder: (_req, context) => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `So'rovlar soni me'yordan oshdi. Qayta urinish uchun ${context.after} kuting.`,
      },
    }),
  });


  // Markaziy xatolarni qayta ishlash (Centralized Error Handler)
  app.setErrorHandler(
    (
      error: FastifyError & { error?: { code?: string; message?: string } },
      request,
      reply,
    ) => {
      // Ichki xatolik tafsilotini faqat logga yozish
      request.log.error(error);

      // Agar Rate Limit xatoligi bo'lsa
      if (error.statusCode === 429 || error.error?.code === 'RATE_LIMIT_EXCEEDED') {
        return reply.status(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: error.error?.message || 'So‘rovlar soni me’yordan oshdi',
          },
        });
      }

      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500;

      const code =
        error.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');

      // Foydalanuvchiga faqat xavfsiz xabar qaytariladi, ichki xato ma'lumotlari yashiriladi
      const message =
        statusCode === 500
          ? 'Serverda ichki xatolik yuz berdi'
          : error.message || 'Xato so‘rov yuborildi';

      return reply.status(statusCode).send({
        error: {
          code,
          message,
        },
      });
    },
  );


  // Health check endpoint - bazaga SELECT 1 qiladi va { ok, db: true } qaytaradi
  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        db: true,
        time: new Date().toISOString(),
      };
    } catch (err) {
      app.log.error(err, 'Database health check failed');
      return reply.status(503).send({
        ok: false,
        db: false,
        time: new Date().toISOString(),
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Ma’lumotlar bazasi bilan aloqa mavjud emas',
        },
      });
    }
  });

  // Autentifikatsiya, Usta, Yuklash, So'rov va Admin marshrutlari
  app.register(authRoutes);
  app.register(masterRoutes);
  app.register(uploadRoutes);
  app.register(requestRoutes);
  app.register(webhookRoutes);
  app.register(offerRoutes);
  app.register(adminRoutes);

  return app;
}

