import { InlineKeyboard } from 'grammy';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { bot } from '../bot/bot.js';

/**
 * Yangi so'rov yaratilganda, unga mos (xizmati va tumani to'g'ri keladigan),
 * tasdiqlangan (APPROVED) va bloklanmagan ustalarga Telegram orqali xabar yuborish.
 *
 * Telegram tezlik limiti (max 25 msg/s) inobatga olinadi.
 * 403 (bot bloklangan) xatosi butun jarayonni to'xtatmaydi, NotificationLog'ga yoziladi.
 */
export async function notifyMastersAboutNewRequest(requestId: string): Promise<void> {
  const requestItem = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      service: true,
      district: true,
    },
  });

  if (!requestItem || requestItem.status !== 'OPEN') {
    return;
  }

  // 1. Mos ustalarni topish:
  // - status === 'APPROVED'
  // - user.isBlocked === false
  // - user.id !== requestItem.customerId (mijozning o'ziga xabar yuborilmaydi)
  // - xizmati va tumani mos
  const eligibleMasters = await prisma.masterProfile.findMany({
    where: {
      status: 'APPROVED',
      user: {
        isBlocked: false,
        id: { not: requestItem.customerId },
      },
      services: {
        some: { id: requestItem.serviceId },
      },
      districts: {
        some: { id: requestItem.districtId },
      },
    },
    include: {
      user: true,
    },
  });

  // 2. Agar mos usta topilmasa -> Adminlarga xabar yuborish
  if (eligibleMasters.length === 0) {
    if (env.adminTelegramIds.length > 0) {
      const adminNotice =
        `⚠️ UstaTop: Yangi so‘rov uchun mos usta topilmadi!\n\n` +
        `🆔 So‘rov: ${requestItem.title}\n` +
        `🛠 Xizmat: ${requestItem.service.nameUz}\n` +
        `📍 Tuman: ${requestItem.district.nameUz}\n` +
        `💡 Tavsiya: Ushbu tuman va yo‘nalish bo‘yicha yangi ustalarni jalb qilish zarur.`;

      for (const adminId of env.adminTelegramIds) {
        try {
          await bot.api.sendMessage(Number(adminId), adminNotice);
        } catch (adminErr) {
          console.error(`Admin ${adminId} ga ogohlantirish yuborishda xatolik:`, adminErr);
        }
      }
    }
    return;
  }

  // 3. Xabar matnini tayyorlash (Maxfiy manzil va telefon raqami YO'Q!)
  const shortDescription =
    requestItem.description.length > 150
      ? `${requestItem.description.slice(0, 150)}...`
      : requestItem.description;

  let timeText = 'Kelishilgan holda';
  if (requestItem.preferredTime === 'ASAP') timeText = '⚡ Zudlik bilan (Tezda)';
  else if (requestItem.preferredTime === 'TODAY') timeText = '📅 Bugun';
  else if (requestItem.preferredTime === 'THIS_WEEK') timeText = '🗓️ Shu hafta ichida';
  else if (requestItem.preferredTime === 'FLEXIBLE') timeText = '🤝 Kelishilgan holda';

  let budgetText = 'Kelishilgan holda';
  if (requestItem.budgetMin || requestItem.budgetMax) {
    const minStr = requestItem.budgetMin ? `${requestItem.budgetMin.toLocaleString()} so‘m` : '0';
    const maxStr = requestItem.budgetMax ? `${requestItem.budgetMax.toLocaleString()} so‘m` : 'cheksiz';
    budgetText = `${minStr} - ${maxStr}`;
  }

  const messageText =
    `🔔 Yangi so‘rov qoldirildi!\n\n` +
    `🛠 Xizmat: ${requestItem.service.nameUz}\n` +
    `📍 Tuman: ${requestItem.district.nameUz}\n` +
    `📌 Sarlavha: ${requestItem.title}\n` +
    `📝 Tavsif: ${shortDescription}\n` +
    `⏱ Vaqt: ${timeText}\n` +
    `💰 Byudjet: ${budgetText}\n\n` +
    `Mijoz sizning taklifingizni kutmoqda:`;

  const inlineKeyboard = new InlineKeyboard().webApp(
    "Ko'rish va taklif berish",
    `${env.WEB_APP_URL}/requests/${requestItem.id}`,
  );

  // 4. Har bir ustaga xabar yuborish (navbat + tezlik cheklovi)
  for (const master of eligibleMasters) {
    // Takroriy yuborishni oldini olish
    const alreadySent = await prisma.notificationLog.findUnique({
      where: {
        requestId_userId: {
          requestId: requestItem.id,
          userId: master.userId,
        },
      },
    });

    if (alreadySent) {
      continue;
    }

    try {
      await bot.api.sendMessage(Number(master.user.telegramId), messageText, {
        reply_markup: inlineKeyboard,
      });

      await prisma.notificationLog.create({
        data: {
          requestId: requestItem.id,
          userId: master.userId,
          type: 'NEW_REQUEST',
          status: 'SENT',
        },
      });
    } catch (sendErr: unknown) {
      const errMessage = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.warn(
        `Ustaga (${master.user.telegramId}) xabar yuborishda xatolik:`,
        errMessage,
      );

      await prisma.notificationLog.create({
        data: {
          requestId: requestItem.id,
          userId: master.userId,
          type: 'NEW_REQUEST',
          status: 'FAILED',
          error: errMessage.slice(0, 500),
        },
      });
    }

    // Telegram rate limitini (25 msg/s) buzmaslik uchun 45ms kutish
    await new Promise((resolve) => setTimeout(resolve, 45));
  }
}
