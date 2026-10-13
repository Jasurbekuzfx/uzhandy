import { Bot, Keyboard, InlineKeyboard } from 'grammy';
import { prisma } from '../db.js';
import { env } from '../env.js';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

bot.catch((err) => {
  console.error('Botda xatolik yuz berdi:', err.error || err);
});

// /start komandasi
bot.command('start', async (ctx) => {
  const isHttps = env.WEB_APP_URL.startsWith('https://');
  const keyboard = new Keyboard().requestContact('📱 Raqamni yuborish');

  if (isHttps) {
    keyboard.row().webApp('UstaTop’ni ochish', env.WEB_APP_URL);
  }
  keyboard.resized();

  await ctx.reply(
    `Assalomu alaykum, ${ctx.from?.first_name || 'foydalanuvchi'}!\n\n` +
      `UstaTop — Toshkentdagi usta va xizmatlarni topish bo‘yicha Telegram Mini App platformasi.\n\n` +
      `Ilovadan to‘liq foydalanish va ustalardan takliflar olish uchun iltimos, pastdagi "📱 Raqamni yuborish" tugmasi orqali telefon raqamingizni tasdiqlang.` +
      (isHttps ? '' : `\n\n💻 Lokal versiya: ${env.WEB_APP_URL}`),
    {
      reply_markup: keyboard,
    },
  );
});

// Kontakt qabul qilish handleri
bot.on('message:contact', async (ctx) => {
  const contact = ctx.message.contact;
  const from = ctx.from;

  // XAVFSIZLIK: Faqat yuboruvchining shaxsiy kontaktini qabul qilamiz
  if (!from || contact.user_id !== from.id) {
    await ctx.reply(
      '⚠️ Xatolik: Iltimos, faqat o‘zingizning shaxsiy telefon raqamingizni pastdagi "📱 Raqamni yuborish" tugmasi orqali yuboring. Begona kontaktlar qabul qilinmaydi.',
    );
    return;
  }

  // Raqam formatini to'g'rilash (+ bilan boshlanishi)
  const phone = contact.phone_number.startsWith('+')
    ? contact.phone_number
    : `+${contact.phone_number}`;

  const telegramId = BigInt(from.id);

  // Foydalanuvchini yangilash yoki yaratish
  await prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      firstName: from.first_name,
      lastName: from.last_name || null,
      username: from.username || null,
      phone,
      role: 'CUSTOMER',
    },
    update: {
      phone,
      firstName: from.first_name,
      lastName: from.last_name || null,
      username: from.username || null,
    },
  });

  const isHttps = env.WEB_APP_URL.startsWith('https://');
  const keyboard = isHttps
    ? new Keyboard().webApp('UstaTop’ni ochish', env.WEB_APP_URL).resized()
    : undefined;

  await ctx.reply(
    `✅ Rahmat, ${from.first_name}! Telefon raqamingiz (${phone}) muvaffaqiyatli saqlandi va tasdiqlandi.\n\n` +
      `Endi UstaTop ilovasida so‘rov qoldirishingiz yoki usta sifatida faoliyat yuritishingiz mumkin.` +
      (isHttps ? '' : `\n\n💻 Lokal versiya: ${env.WEB_APP_URL}`),
    {
      reply_markup: keyboard,
    },
  );
});

export interface NewMasterApplicationNotification {
  name: string;
  phone: string;
  services: string[];
  districts: string[];
  bio: string;
  experienceYears: number;
}

/**
 * Yangi usta arizasi kelganda barcha adminlarga bot orqali xabar yuborish
 */
export async function notifyAdminsNewMasterApplication(
  details: NewMasterApplicationNotification,
): Promise<void> {
  if (env.adminTelegramIds.length === 0) {
    return;
  }

  const messageText =
    `🔔 Yangi usta arizasi keldi!\n\n` +
    `👤 Ism: ${details.name}\n` +
    `📞 Telefon: ${details.phone}\n` +
    `⏳ Tajriba: ${details.experienceYears} yil\n` +
    `🛠 Xizmatlar: ${details.services.join(', ')}\n` +
    `📍 Tumanlar: ${details.districts.join(', ')}\n` +
    `📝 Bio: ${details.bio}`;

  const isHttps = env.WEB_APP_URL.startsWith('https://');
  const inlineKeyboard = isHttps
    ? new InlineKeyboard().webApp(
        'Admin panelda ko‘rish',
        `${env.WEB_APP_URL}/admin`,
      )
    : undefined;

  for (const adminId of env.adminTelegramIds) {
    try {
      await bot.api.sendMessage(Number(adminId), messageText, {
        reply_markup: inlineKeyboard,
      });
    } catch (err) {
      console.error(`Admin ${adminId} ga xabar yuborishda xatolik:`, err);
    }
  }
}
