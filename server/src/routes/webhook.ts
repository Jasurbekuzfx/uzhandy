import { FastifyInstance } from 'fastify';
import { webhookCallback } from 'grammy';
import { bot } from '../bot/bot.js';
import { env } from '../env.js';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  const callback = webhookCallback(bot, 'fastify');

  // POST /telegram/webhook - Telegram bot webhook qabul qiluvchi endpoint
  app.post(
    '/telegram/webhook',
    {
      preHandler: async (request, reply) => {
        const secret = request.headers['x-telegram-bot-api-secret-token'];
        if (!secret || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
          return reply.status(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Secret token noto‘g‘ri yoki taqdim etilmagan',
            },
          });
        }
      },
    },
    async (request, reply) => {
      return callback(request, reply);
    },
  );
}
