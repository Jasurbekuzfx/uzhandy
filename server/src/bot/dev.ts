import { bot } from './bot.js';
import { env } from '../env.js';

if (env.NODE_ENV !== 'development') {
  console.error('❌ Xatolik: bot:dev buyrug‘i faqat NODE_ENV=development rejimida ishlaydi.');
  process.exit(1);
}

console.log('🤖 UstaTop Telegram boti lokal polling rejimida ishga tushmoqda...');

bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot @${botInfo.username} muvaffaqiyatli ishga tushdi!`);
  },
});
