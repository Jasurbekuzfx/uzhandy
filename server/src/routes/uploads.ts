import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { createSignedUploadUrl } from '../storage/supabase.js';

const SignUploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({
      message: 'Faqat image/jpeg, image/png yoki image/webp formatlaridagi rasmlar qabul qilinadi',
    }),
  }),
});

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  // POST /uploads/sign - Imzolangan rasm yuklash havolasini olish
  app.post('/uploads/sign', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
      });
    }

    const parseResult = SignUploadSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Yaroqsiz rasm formati',
        },
      });
    }

    const { contentType } = parseResult.data;
    const ext = EXTENSION_MAP[contentType] || '.jpg';
    const uuid = crypto.randomUUID();
    const path = `${user.id}/${uuid}${ext}`;

    try {
      const { signedUrl, token } = await createSignedUploadUrl(path);
      return reply.status(200).send({
        path,
        signedUrl,
        token,
      });
    } catch (err: unknown) {
      request.log.error(err, 'Yuklash havolasini imzolashda xatolik');
      return reply.status(500).send({
        error: {
          code: 'STORAGE_ERROR',
          message: 'Rasm yuklash havolasini yaratishda xatolik yuz berdi',
        },
      });
    }
  });
}
