import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { notifyAdminsNewMasterApplication } from '../bot/bot.js';
import { createSignedDownloadUrl } from '../storage/supabase.js';


// Kesh uchun vaqtinchalik o'zgaruvchilar
let cachedServices: { data: unknown; expiresAt: number } | null = null;
let cachedDistricts: { data: unknown; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 soniya

const MasterApplyBodySchema = z.object({
  bio: z
    .string()
    .min(20, 'Bio kamida 20 ta belgidan iborat bo‘lishi kerak')
    .max(500, 'Bio ko‘pi bilan 500 ta belgidan oshmasligi kerak'),
  experienceYears: z
    .number()
    .int('Tajriba butun son bo‘lishi kerak')
    .min(0, 'Tajriba 0 dan kam bo‘lishi mumkin emas')
    .max(50, 'Tajriba 50 yildan oshmasligi kerak'),
  serviceIds: z
    .array(z.string().min(1).max(100))
    .min(1, 'Kamida 1 ta xizmat tanlanishi kerak')
    .max(3, 'Ko‘pi bilan 3 ta xizmat tanlash mumkin'),
  districtIds: z
    .array(z.string().min(1).max(100))
    .min(1, 'Kamida 1 ta tuman tanlanishi kerak')
    .max(12, 'Ko‘pi bilan 12 ta tuman tanlash mumkin'),
});


export async function masterRoutes(app: FastifyInstance): Promise<void> {
  // GET /services - Ommaviy, faol xizmatlar ro'yxati (keshlanadi)
  app.get('/services', async () => {
    const now = Date.now();
    if (cachedServices && cachedServices.expiresAt > now) {
      return cachedServices.data;
    }

    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { nameUz: 'asc' },
    });

    const response = { services };
    cachedServices = { data: response, expiresAt: now + CACHE_TTL_MS };
    return response;
  });

  // GET /districts - Ommaviy, tumanlar ro'yxati (keshlanadi)
  app.get('/districts', async () => {
    const now = Date.now();
    if (cachedDistricts && cachedDistricts.expiresAt > now) {
      return cachedDistricts.data;
    }

    const districts = await prisma.district.findMany({
      orderBy: { nameUz: 'asc' },
    });

    const response = { districts };
    cachedDistricts = { data: response, expiresAt: now + CACHE_TTL_MS };
    return response;
  });

  // POST /master/apply - Usta bo'lib ro'yxatdan o'tish arizasi
  app.post('/master/apply', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
      });
    }

    // Telefon raqami majburiy tekshiruvi (faqat bot orqali tasdiqlangan bo'lishi shart)
    if (!user.phone) {
      return reply.status(400).send({
        error: {
          code: 'PHONE_REQUIRED',
          message: 'Usta bo‘lib ro‘yxatdan o‘tish uchun avval botda telefon raqamingizni yuboring',
        },
      });
    }

    const parseResult = MasterApplyBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Noto‘g‘ri ma’lumot kiritildi',
        },
      });
    }

    const { bio, experienceYears, serviceIds, districtIds } = parseResult.data;

    // Faqat faol xizmatlar tanlanganini tekshirish
    const validServices = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        isActive: true,
      },
    });

    if (validServices.length !== serviceIds.length) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_SERVICES',
          message: 'Tanlangan xizmatlar orasida nofaol yoki mavjud bo‘lmagan xizmatlar bor',
        },
      });
    }

    // Tanlangan tumanlarni tekshirish
    const validDistricts = await prisma.district.findMany({
      where: {
        id: { in: districtIds },
      },
    });

    if (validDistricts.length !== districtIds.length) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_DISTRICTS',
          message: 'Tanlangan tumanlar orasida mavjud bo‘lmagan tumanlar bor',
        },
      });
    }

    // Allaqachon ariza bor-yo'qligini tekshirish
    const existingProfile = await prisma.masterProfile.findUnique({
      where: { userId: user.id },
    });

    if (existingProfile && existingProfile.status !== 'REJECTED') {
      return reply.status(409).send({
        error: {
          code: 'ALREADY_APPLIED',
          message: 'Siz allaqachon usta sifatida ariza topshirgansiz',
        },
      });
    }

    let masterProfile;

    if (existingProfile && existingProfile.status === 'REJECTED') {
      // Rad etilgan bo'lsa qayta ariza topshirishga ruxsat
      masterProfile = await prisma.masterProfile.update({
        where: { id: existingProfile.id },
        data: {
          bio,
          experienceYears,
          status: 'PENDING',
          rejectReason: null,
          services: {
            set: serviceIds.map((id) => ({ id })),
          },
          districts: {
            set: districtIds.map((id) => ({ id })),
          },
        },
        include: {
          services: true,
          districts: true,
        },
      });
    } else {
      // Yangi profil yaratish
      masterProfile = await prisma.masterProfile.create({
        data: {
          userId: user.id,
          bio,
          experienceYears,
          status: 'PENDING',
          services: {
            connect: serviceIds.map((id) => ({ id })),
          },
          districts: {
            connect: districtIds.map((id) => ({ id })),
          },
        },
        include: {
          services: true,
          districts: true,
        },
      });
    }

    // Adminlarga bot orqali bildirishnoma yuborish (orqa fonda, xatolik berilsa ham API to'xtamaydi)
    void notifyAdminsNewMasterApplication({
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      phone: user.phone,
      services: validServices.map((s) => s.nameUz),
      districts: validDistricts.map((d) => d.nameUz),
      bio,
      experienceYears,
    }).catch((err) => {
      request.log.error(err, 'Adminlarga usta arizasi haqida xabar yuborishda xatolik');
    });

    return reply.status(201).send({
      ok: true,
      masterProfile,
    });
  });

  // GET /master/requests - Faqat tasdiqlangan (APPROVED) usta uchun o'z xizmatlari va tumanlaridagi OPEN so'rovlar
  app.get('/master/requests', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' },
      });
    }

    // Usta profilini va uning tasdiqlangan holatini tekshirish
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
          message: 'Faqat tasdiqlangan (APPROVED) ustalar so‘rovlar ro‘yxatini ko‘ra oladi',
        },
      });
    }

    const querySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(50).default(20),
    });

    const parsedQuery = querySchema.safeParse(request.query);
    const { page, limit } = parsedQuery.success ? parsedQuery.data : { page: 1, limit: 20 };
    const skip = (page - 1) * limit;

    const serviceIds = masterProfile.services.map((s) => s.id);
    const districtIds = masterProfile.districts.map((d) => d.id);

    if (serviceIds.length === 0 || districtIds.length === 0) {
      return {
        requests: [],
        total: 0,
        page,
        limit,
      };
    }

    const whereClause = {
      status: 'OPEN' as const,
      serviceId: { in: serviceIds },
      districtId: { in: districtIds },
      customerId: { not: user.id }, // Usta o'zining so'rovini ko'rmaydi
    };

    const [total, requests] = await Promise.all([
      prisma.request.count({ where: whereClause }),
      prisma.request.findMany({
        where: whereClause,
        include: {
          service: true,
          district: true,
          photos: true,
          _count: {
            select: { offers: true },
          },
          offers: {
            where: { masterId: masterProfile.id },
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const formattedRequests = await Promise.all(
      requests.map(async (reqItem) => {
        const signedPhotos = await Promise.all(
          reqItem.photos.map(async (p) => {
            let signedUrl = '';
            try {
              signedUrl = await createSignedDownloadUrl(p.storagePath);
            } catch {
              // Storage xatosi bo'lsa bo'sh qoladi
            }
            return {
              id: p.id,
              storagePath: p.storagePath,
              signedUrl,
              createdAt: p.createdAt,
            };
          }),
        );

        return {
          id: reqItem.id,
          title: reqItem.title,
          description: reqItem.description,
          preferredTime: reqItem.preferredTime,
          budgetMin: reqItem.budgetMin,
          budgetMax: reqItem.budgetMax,
          status: reqItem.status,
          service: reqItem.service,
          district: reqItem.district,
          photos: signedPhotos,
          offersCount: reqItem._count.offers,
          hasOffered: reqItem.offers.length > 0,
          createdAt: reqItem.createdAt,
          updatedAt: reqItem.updatedAt,
          // XAVFSIZLIK: addressDetail va mijoz telefoni HECH QACHON qaytarilmaydi!
        };
      }),
    );

    return {
      requests: formattedRequests,
      total,
      page,
      limit,
    };
  });

  // GET /masters/:id - Ommaviy usta profili (faqat APPROVED ustalar)
  app.get<{ Params: { id: string } }>('/masters/:id', async (request, reply) => {
    const masterProfile = await prisma.masterProfile.findFirst({
      where: {
        OR: [{ id: request.params.id }, { userId: request.params.id }],
        status: 'APPROVED',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
            // phone XAVFSIZLIK: HECH QACHON ommaviy profilda qaytmaydi!
          },
        },
        services: true,
        districts: true,
        reviewsReceived: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: {
              select: {
                firstName: true,
              },
            },
          },
        },
      },
    });

    if (!masterProfile) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Usta profili topilmadi yoki tasdiqlanmagan' },
      });
    }

    const formattedReviews = masterProfile.reviewsReceived.map((r) => {
      const firstLetter = r.customer.firstName ? `${r.customer.firstName[0]}.` : 'M.';
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        customerName: firstLetter,
      };
    });

    return {
      master: {
        id: masterProfile.id,
        userId: masterProfile.userId,
        firstName: masterProfile.user.firstName,
        lastName: masterProfile.user.lastName,
        username: masterProfile.user.username,
        photoUrl: masterProfile.user.photoUrl,
        bio: masterProfile.bio,
        experienceYears: masterProfile.experienceYears,
        ratingAvg: Number(masterProfile.ratingAvg),
        ratingCount: masterProfile.ratingCount,
        completedCount: masterProfile.completedCount,
        services: masterProfile.services,
        districts: masterProfile.districts,
        reviews: formattedReviews,
      },
    };
  });
}


