import { InlineKeyboard } from 'grammy';
import { bot } from '../bot/bot.js';
import { env } from '../env.js';

/**
 * Usta ishni boshlaganda mijozga xabar yuborish
 */
export async function notifyCustomerWorkStarted(params: {
  customerTelegramId: bigint;
  masterName: string;
  requestId: string;
}): Promise<void> {
  try {
    const text =
      `🛠 Usta ${params.masterName} so‘rovingiz bo‘yicha ishni boshladi!\n\n` +
      `Ish yakunlangach, ilovada "Ish bajarildi" tugmasi orqali tasdiqlashingiz mumkin.`;

    const keyboard = new InlineKeyboard().webApp(
      'So‘rovni ko‘rish',
      `${env.WEB_APP_URL}/requests/${params.requestId}`,
    );

    await bot.api.sendMessage(Number(params.customerTelegramId), text, {
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('Mijozga ish boshlangani haqida xabar yuborishda xatolik:', err);
  }
}

/**
 * Ish yakunlanganda (mijoz tasdiqlaganida) tomonlarga xabar yuborish
 */
export async function notifyWorkCompleted(params: {
  customerTelegramId: bigint;
  masterTelegramId: bigint;
  masterName: string;
  requestId: string;
}): Promise<void> {
  // 1. Mijozga baholash taklifi
  try {
    const customerText =
      `🎉 Ish muvaffaqiyatli yakunlandi!\n\n` +
      `Iltimos, usta (${params.masterName}) xizmatini baholang. Bu boshqa foydalanuvchilar uchun juda muhim!`;

    const keyboard = new InlineKeyboard().webApp(
      'Ustani baholash ⭐',
      `${env.WEB_APP_URL}/requests/${params.requestId}`,
    );

    await bot.api.sendMessage(Number(params.customerTelegramId), customerText, {
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('Mijozga baholash xabarnomasini yuborishda xatolik:', err);
  }

  // 2. Ustaga tabrik xabari
  try {
    const masterText =
      `✅ Mijoz ish bajarilganini tasdiqladi! Tabriklaymiz!\n\n` +
      `Bajarilgan ishlar hisobingizga qo‘shildi.`;

    const keyboard = new InlineKeyboard().webApp(
      'So‘rovni ochish',
      `${env.WEB_APP_URL}/requests/${params.requestId}`,
    );

    await bot.api.sendMessage(Number(params.masterTelegramId), masterText, {
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('Ustaga ish yakuni xabarnomasini yuborishda xatolik:', err);
  }
}

/**
 * ASSIGNED holatidagi so'rov bekor qilinganda ustaga xabar yuborish
 */
export async function notifyMasterRequestCancelled(params: {
  masterTelegramId: bigint;
  requestTitle: string;
  reason: string;
}): Promise<void> {
  try {
    const text =
      `⚠️ Siz biriktirilgan so‘rov mijoz tomonidan bekor qilindi.\n\n` +
      `📌 So‘rov: ${params.requestTitle}\n` +
      `📝 Bekor qilish sababi: ${params.reason}\n\n` +
      `UstaTop ilovasida boshqa so‘rovlarga taklif berishingiz mumkin.`;

    await bot.api.sendMessage(Number(params.masterTelegramId), text);
  } catch (err) {
    console.error('Ustaga bekor qilish xabarini yuborishda xatolik:', err);
  }
}

/**
 * Usta baholanganda unga xabar yuborish
 */
export async function notifyMasterReviewed(params: {
  masterTelegramId: bigint;
  rating: number;
  comment?: string | null;
  requestTitle: string;
}): Promise<void> {
  try {
    const text =
      `⭐ Mijoz sizga ${params.rating} ball baho qo‘ydi!\n\n` +
      `📌 So‘rov: ${params.requestTitle}` +
      (params.comment ? `\n💬 Mijoz izohi: "${params.comment}"` : '') +
      `\n\nReytingingiz yangilandi. Yaxshi ish uchun tashakkur!`;

    await bot.api.sendMessage(Number(params.masterTelegramId), text);
  } catch (err) {
    console.error('Ustaga baho xabarini yuborishda xatolik:', err);
  }
}
