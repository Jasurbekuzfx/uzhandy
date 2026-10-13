import { bot } from '../bot/bot.js';

export interface MasterNotificationParams {
  telegramId: bigint | string;
}

export interface MasterRejectNotificationParams extends MasterNotificationParams {
  reason: string;
}

export interface MasterSuspendNotificationParams extends MasterNotificationParams {
  reason?: string;
}

/**
 * Usta arizasi tasdiqlanganda botdan xabar yuborish
 */
export async function notifyMasterApproved(
  params: MasterNotificationParams,
): Promise<void> {
  const telegramId =
    typeof params.telegramId === 'bigint'
      ? Number(params.telegramId)
      : Number(params.telegramId);

  const message =
    `🎉 Tabriklaymiz!\n\n` +
    `Sizning usta sifatidagi arizangiz administrator tomonidan tasdiqlandi.\n` +
    `Endi siz o‘z xizmatlaringiz bo‘yicha yangi so‘rovlarni qabul qilishingiz va mijozlarga o‘z narx taklifingizni yuborishingiz mumkin! 🛠️`;

  try {
    await bot.api.sendMessage(telegramId, message);
  } catch (err) {
    console.error(`Usta (${telegramId}) ga tasdiqlash xabarnomasini yuborishda xatolik:`, err);
  }
}

/**
 * Usta arizasi rad etilganda botdan xabar yuborish (sababi bilan)
 */
export async function notifyMasterRejected(
  params: MasterRejectNotificationParams,
): Promise<void> {
  const telegramId =
    typeof params.telegramId === 'bigint'
      ? Number(params.telegramId)
      : Number(params.telegramId);

  const message =
    `⚠️ Arizangiz bo‘yicha ma’lumot:\n\n` +
    `Afsuski, sizning usta sifatidagi arizangiz qabul qilinmadi.\n\n` +
    `📌 Sabab: ${params.reason}\n\n` +
    `Ma’lumotlaringizni to‘g‘rilab, ilova orqali qayta ariza topshirishingiz mumkin.`;

  try {
    await bot.api.sendMessage(telegramId, message);
  } catch (err) {
    console.error(`Usta (${telegramId}) ga rad etish xabarnomasini yuborishda xatolik:`, err);
  }
}

/**
 * Usta faoliyati to‘xtatilganda botdan xabar yuborish
 */
export async function notifyMasterSuspended(
  params: MasterSuspendNotificationParams,
): Promise<void> {
  const telegramId =
    typeof params.telegramId === 'bigint'
      ? Number(params.telegramId)
      : Number(params.telegramId);

  const message =
    `⛔️ Diqqat!\n\n` +
    `Sizning usta profilingiz administrator tomonidan vaqtincha to‘xtatildi (suspend).\n` +
    (params.reason ? `📌 Sabab: ${params.reason}\n\n` : '\n') +
    `Qo‘shimcha ma’lumot uchun qo‘llab-quvvatlash xizmati bilan bog‘laning.`;

  try {
    await bot.api.sendMessage(telegramId, message);
  } catch (err) {
    console.error(`Usta (${telegramId}) ga to‘xtatish xabarnomasini yuborishda xatolik:`, err);
  }
}
