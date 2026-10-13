import { bot } from '../bot/bot.js';
import { env } from '../env.js';

async function runSmokeTest(): Promise<void> {
  const targetServerUrl = (
    process.argv[2] ||
    env.PUBLIC_SERVER_URL ||
    `http://localhost:${env.PORT}`
  ).replace(/\/$/, '');

  console.log('====================================================');
  console.log('🚀 UstaTop Production Smoke Test');
  console.log(`🎯 Server manzili: ${targetServerUrl}`);
  console.log('====================================================\n');

  // 1. Health check tekshiruvi
  console.log('1️⃣ Server Health Check (/health) tekshirilmoqda...');
  const startTime = Date.now();

  try {
    const healthRes = await fetch(`${targetServerUrl}/health`);
    const duration = Date.now() - startTime;

    if (!healthRes.ok) {
      console.error(`❌ Health check xatolik qaytardi! Status: ${healthRes.status}`);
      const errText = await healthRes.text();
      console.error(`Javob matni: ${errText}`);
      process.exit(1);
    }

    const healthData = (await healthRes.json()) as {
      ok: boolean;
      db: boolean;
      time: string;
    };

    console.log(`✅ Server holati: OK (Javob vaqti: ${duration}ms)`);
    console.log(`   - Server: ${healthData.ok ? '🟢 Faol' : '🔴 Nofaol'}`);
    console.log(`   - PostgreSQL baza: ${healthData.db ? '🟢 Ulangan' : '🔴 Aloqa yo‘q'}`);
    console.log(`   - Server vaqti: ${healthData.time}\n`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Serverga ulanib bo‘lmadi: ${msg}`);
    console.error('Server ishga tushganini yoki Render manzili to‘g‘riligini tekshiring.');
    process.exit(1);
  }

  // 2. Telegram Bot Webhook holati
  console.log('2️⃣ Telegram Bot Webhook holati tekshirilmoqda...');
  try {
    const webhookInfo = await bot.api.getWebhookInfo();
    console.log('✅ Webhook ma’lumotlari muvaffaqiyatli olindi:');
    console.log(`   - URL: ${webhookInfo.url || '(Webhook o‘rnatilmagan)'}`);
    console.log(`   - Maxsus sertifikat: ${webhookInfo.has_custom_certificate ? 'Ha' : 'Yo‘q'}`);
    console.log(`   - Navbatdagi xabarlar (pending): ${webhookInfo.pending_update_count}`);

    if (webhookInfo.last_error_date) {
      const errDate = new Date(webhookInfo.last_error_date * 1000).toLocaleString('uz-UZ');
      console.warn(`   ⚠️ Oxirgi xatolik vaqti: ${errDate}`);
      console.warn(`   ⚠️ Xatolik matni: ${webhookInfo.last_error_message}`);
    } else {
      console.log('   - Xatoliklar: Yo‘q (A’lo darajada)');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Telegram bot webhook ma’lumotini olishda xatolik: ${msg}`);
  }

  console.log('\n====================================================');
  console.log('🎉 Smoke test muvaffaqiyatli yakunlandi!');
  console.log('====================================================');
}

void runSmokeTest();
