# UstaTop — Production Deploy Qo‘llanmasi

Ushbu qo‘llanma **UstaTop** loyihasini (Telegram Mini App + Fastify Server + PostgreSQL) ishlab chiqarish (production) serverlariga to‘liq joylashtirish bo‘yicha qadam-baqadam yo‘riqnomadir.

---

## Arxitektura va Servislar

- **Frontend (Mini App):** Vercel (bepul tarif)
- **Backend (API + Bot):** Render (bepul Web Service, Docker/Node)
- **Ma’lumotlar bazasi & Storage:** Supabase (PostgreSQL + S3 Storage)
- **Monitoring (Keep-alive):** UptimeRobot (bepul HTTP monitoring)

---

## 1-qadam: GitHub Repositoriyasini tayyorlash

1. GitHub'da yangi **Private** repositoriya oching (masalan, `ustatop`).
2. Lokal kompyuteringizdagi terminalda maxfiy `.env` fayllar commitga kirmaganligini tekshiring:
   ```bash
   git ls-files | grep .env
   ```
   *(Faqat `.env.example` chiqishi kerak, haqiqiy `.env` fayllar chiqmasligi shart).*
3. Loyihani GitHub private repositoriyasiga push qiling:
   ```bash
   git add .
   git commit -m "feat: complete ustatop production ready application"
   git branch -M main
   git remote add origin https://github.com/<username>/ustatop.git
   git push -u origin main
   ```

---

## 2-qadam: Supabase (Baza va Storage) Sozlamalari

1. [supabase.com](https://supabase.com) ga kiring va yangi loyiha (Project) oching (Region: masalan, Frankfurt yoki Singapur).
2. **Project Settings → Database** bo‘limiga o‘ting:
   - **Connection string → URI (Session mode / Port 5432)**: `DIRECT_URL` uchun nusxa oling.
   - **Connection string → URI (Transaction mode / Port 6543)**: `DATABASE_URL` uchun nusxa oling.
3. **Storage bo‘limi:**
   - **New Bucket** yarating: nomi aniq `request-photos` bo‘lsin.
   - Bucket turi: **Private** (chunki rasmlar xavfsiz imzolangan Signed URL orqali yuklanadi va o‘qiladi).
4. **Boshlang‘ich ma’lumotlarni joylash (Seed):**
   - Lokal kompyuteringizda terminalda vaqtincha `server/.env` dagi `DATABASE_URL` va `DIRECT_URL` ni Supabase manzillariga o‘zgartiring va bazani migratsiya qilib seed qiling:
   ```bash
   npm run db:deploy
   npm run db:seed
   ```
   *(Bu Toshkent tumanlari va xizmat turlarini bazaga kiritadi).*

---

## 3-qadam: Render (Backend API Server)ni ishga tushirish

1. [render.com](https://render.com) ga kiring va ro‘yxatdan o‘ting.
2. Bosh sahifada **New + → Blueprint** ni tanlang.
3. GitHub private repositoriyangizni ulang (`ustatop`).
4. Render loyiha ildizidagi [`render.yaml`](render.yaml) faylini avtomatik aniqlaydi.
5. So‘ralgan Environment Variables (Muhit o‘zgaruvchilari)ni to‘ldiring:

| Kalit | Qayerdan olinadi / Namunaviy qiymat |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `3001` (yoki `10000`) |
| `DATABASE_URL` | Supabase Transaction Pooler URI (port 6543) |
| `DIRECT_URL` | Supabase Direct Session URI (port 5432) |
| `TELEGRAM_BOT_TOKEN` | BotFather'dan olingan bot tokeni (masalan: `123456:ABC...`) |
| `JWT_SECRET` | 32+ belgili tasodifiy satr: `openssl rand -hex 32` |
| `ADMIN_TELEGRAM_IDS` | Sizning Telegram ID raqamingiz (masalan: `123456789`) |
| `SUPABASE_URL` | Supabase Project URL (`https://xyz.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API → `service_role` (secret) key |
| `STORAGE_BUCKET` | `request-photos` |
| `TELEGRAM_WEBHOOK_SECRET` | 32 belgili maxfiy token: `openssl rand -hex 32` |
| `PUBLIC_SERVER_URL` | Render beradigan server domeni (masalan: `https://ustatop-api.onrender.com`) |
| `WEB_APP_URL` | Vercel domeni (4-qadamda olinadi, hozircha `http://localhost:5173` yozib turing) |

6. **Apply** tugmasini bosing. Render serverni build qiladi va ishga tushiradi.
7. Server domenini nusxalang (masalan: `https://ustatop-api.onrender.com`).

---

## 4-qadam: Vercel (Telegram Mini App Frontend)ni deploy qilish

1. [vercel.com](https://vercel.com) ga kiring va **Add New... → Project** ni bosing.
2. GitHub'dagi `ustatop` repositoriyangizni tanlang.
3. Sozlamalar:
   - **Root Directory**: `web` ni tanlang (**Edit** tugmasini bosib).
   - **Framework Preset**: `Vite`.
4. **Environment Variables**:
   - `VITE_API_URL`: 3-qadamda olingan Render manzili (masalan: `https://ustatop-api.onrender.com`).
   - `VITE_BOT_URL`: Bot havolasi (masalan: `https://t.me/ustatop_bot`).
5. **Deploy** tugmasini bosing.
6. Vercel sizga domen beradi (masalan: `https://ustatop.vercel.app`).
7. **Muhim:** Render dashboardiga qaytib, `WEB_APP_URL` qiymatini Vercel domeniga (`https://ustatop.vercel.app`) o‘zgartiring va Render'ni **Manual Deploy → Deploy latest commit** qiling.

---

## 5-qadam: Telegram Bot Webhookni ulash

Render'dagi serveringizga Telegram xabarlarini yetkazish uchun lokal kompyuteringizdagi `server/.env` faylida production qiymatlarini ko‘rsatib, webhookni o‘rnating:

```bash
npm run bot:set-webhook
```

Natijada quyidagicha muvaffaqiyatli xabar chiqadi:
```text
✅ Webhook muvaffaqiyatli o‘rnatildi!
{
  "url": "https://ustatop-api.onrender.com/telegram/webhook",
  "has_custom_certificate": false,
  "pending_update_count": 0
}
```

---

## 6-qadam: BotFather orqali Mini App menyusini ulash

1. Telegramda [@BotFather](https://t.me/BotFather) ga kiring.
2. `/mybots` buyrug‘ini yuboring va o‘z botingizni tanlang.
3. **Bot Settings → Menu Button → Configure menu button**:
   - URL: `https://ustatop.vercel.app`
   - Matn: `UstaTop`
4. *(Ixtiyoriy)* **Bot Settings → Mini Apps → Create new app** orqali bot uchun qisqa havola (masalan, `t.me/ustatop_bot/app`) yaratishingiz mumkin.

---

## 7-qadam: Serverni uyg‘oq ushlab turish (UptimeRobot)

Render bepul tarifida 15 daqiqa davomida so‘rov kelmasa, server uyqu rejimiga (sleep) o‘tadi. Buning oldini olish uchun:

1. [uptimerobot.com](https://uptimerobot.com) da bepul ro‘yxatdan o‘ting.
2. **Add New Monitor**:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `UstaTop Server`
   - **URL (or IP):** `https://ustatop-api.onrender.com/health`
   - **Monitoring Interval:** `5 minutes`
3. **Create Monitor** ni bosing. Endi server har 5 daqiqada uyg‘otiladi va uxlamaydi.

---

## 8-qadam: Ishga tushganini tekshirish (Smoke Test)

Deploy muvaffaqiyatli yakunlangach, loyiha holatini tekshirish uchun quyidagi buyruqni bering:

```bash
npm run smoke https://ustatop-api.onrender.com
```

Agar barcha qismlar to‘g‘ri sozlangan bo‘lsa:
- Server `/health` 200 qaytaradi;
- PostgreSQL aloqasi tasdiqlanadi;
- Telegram Webhook holatida xatoliklar yo‘qligi ko‘rinadi.
