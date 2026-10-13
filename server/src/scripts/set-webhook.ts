import { bot } from '../bot/bot.js';
import { env } from '../env.js';

async function setTelegramWebhook(): Promise<void> {
  const webhookUrl = `${env.PUBLIC_SERVER_URL}/telegram/webhook`;

  console.log(`📡 Telegram bot uchun webhook sozlanmoqda...`);
  console.log(`URL: ${webhookUrl}`);

  try {
    const success = await bot.api.setWebhook(webhookUrl, {
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });

    if (success) {
      console.log('✅ Webhook muvaffaqiyatli o‘rnatildi!');
    } else {
      console.warn('⚠️ Webhook o‘rnatishda muammo yuz berdi (javob: false).');
    }

    const info = await bot.api.getWebhookInfo();
    console.log('\n🔍 Joriy Webhook holati:');
    console.log(JSON.stringify(info, null, 2));
  } catch (error) {
    console.error('❌ Webhook o‘rnatishda xatolik yuz berdi:', error);
    process.exit(1);
  }
}

void setTelegramWebhook();
