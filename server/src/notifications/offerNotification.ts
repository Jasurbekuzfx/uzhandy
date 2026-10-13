import { InlineKeyboard } from 'grammy';
import { bot } from '../bot/bot.js';
import { env } from '../env.js';

export interface NewOfferNotificationParams {
  customerTelegramId: bigint;
  price: number;
  masterName: string;
  masterRating: number | string;
  requestId: string;
  message?: string;
}

export interface OfferSelectedNotificationParams {
  masterTelegramId: bigint;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerTelegramId: bigint;
  customerUsername?: string | null;
  requestId: string;
}

/**
 * Mijozga yangi taklif kelganida xabar yuborish
 */
export async function notifyCustomerAboutNewOffer(
  params: NewOfferNotificationParams,
): Promise<void> {
  try {
    const text =
      `🔔 Yangi taklif keldi!\n\n` +
      `👤 Usta: ${params.masterName}\n` +
      `⭐ Reyting: ${params.masterRating}\n` +
      `💰 Taklif qilingan narx: ${params.price.toLocaleString()} so‘m` +
      (params.message ? `\n\n💬 Izoh: ${params.message}` : '');

    const keyboard = new InlineKeyboard().webApp(
      'Takliflarni ko‘rish',
      `${env.WEB_APP_URL}/requests/${params.requestId}`,
    );

    await bot.api.sendMessage(Number(params.customerTelegramId), text, {
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('Mijozga yangi taklif haqida xabar yuborishda xatolik:', err);
  }
}

/**
 * Tanlangan ustaga mijozning kontakt va manzil ma'lumotlarini yuborish
 */
export async function notifyMasterAboutSelection(
  params: OfferSelectedNotificationParams,
): Promise<void> {
  try {
    const text =
      `🎉 Tabriklaymiz! Sizning taklifingiz tanlandi!\n\n` +
      `👤 Mijoz: ${params.customerName}\n` +
      `📞 Telefon: ${params.customerPhone}\n` +
      `📍 Aniq manzil: ${params.customerAddress}\n\n` +
      `Iltimos, mijoz bilan bog‘lanib, ish boshlash vaqtini kelishib oling.`;

    const contactUrl = params.customerUsername
      ? `https://t.me/${params.customerUsername}`
      : `tg://user?id=${params.customerTelegramId}`;

    const keyboard = new InlineKeyboard()
      .url('Mijozga yozish 💬', contactUrl)
      .row()
      .webApp('So‘rovni ochish', `${env.WEB_APP_URL}/requests/${params.requestId}`);

    await bot.api.sendMessage(Number(params.masterTelegramId), text, {
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('Tanlangan ustaga xabar yuborishda xatolik:', err);
  }
}

/**
 * Boshqa taklif bergan ustalarga rad etilgani haqida qisqa xabarnoma
 */
export async function notifyRejectedMasters(
  telegramIds: bigint[],
): Promise<void> {
  const text =
    `ℹ️ Siz taklif bergan so‘rov bo‘yicha mijoz boshqa ustani tanladi.\n\n` +
    `UstaTop ilovasida boshqa yangi so‘rovlarga taklif berishingiz mumkin.`;

  for (const tgId of telegramIds) {
    try {
      await bot.api.sendMessage(Number(tgId), text);
    } catch {
      // Xatolik bo'lsa (masalan usta botni bloklagan bo'lsa) tinch davom etiladi
    }
    await new Promise((r) => setTimeout(r, 45)); // Rate limiting
  }
}
