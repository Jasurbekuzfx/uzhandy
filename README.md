# UstaTop — Toshkent Ustalari va Uy Egalari Uchun Telegram Mini App

**UstaTop** — Toshkent shahridagi uy egalari va mohir ustalarni (santexnik, elektrik, maishiy texnika ta’mirlash va boshqalar) bog‘laydigan, real ma’lumotlar bazasi va Telegram bot xabarnomalar tizimiga ega to‘liq ishlab chiqarish (production-grade) Telegram Mini App monorepo ilovasi.

---

## 🏗 Arxitektura va Texnologiyalar

- **Frontend (`/web`):**
  - React 18, Vite, TypeScript (Strict rejim)
  - Telegram WebApp SDK (`@twa-dev/sdk`), moslashuvchan dizayn (Mobile-first)
  - Vercel deploy konfiguratsiyasi (`web/vercel.json`)
- **Backend (`/server`):**
  - Node.js 20+, Fastify v5, TypeScript
  - Zod orqali qat’iy validatsiya (fail-fast runtime env checks)
  - Prisma ORM + Supabase PostgreSQL (Row Level Security bilan to‘liq himoyalangan)
  - JWT autentifikatsiya (Telegram `initData` HMAC-SHA256 tekshiruvi orqali)
  - grammY Telegram Bot (Webhook va dev polling rejimi)
  - Render deploy konfiguratsiyasi (`render.yaml`)
- **Sifat va Xavfsizlik:**
  - TypeScript strict rejimi (`any` butunlay taqiqlangan)
  - ESLint Flat Config + Vitest
  - @fastify/rate-limit va @fastify/helmet himoyasi
  - Foydalanuvchi telefon va aniq manzillari ommaviy ro‘yxatlarda hech qachon chiqmaydi (kelishuvdan keyingina ochiladi)

---

## 📁 Loyiha Tuzilmasi

```text
├── web/                  # React 18 + Vite + TypeScript (Telegram Mini App)
│   ├── src/
│   │   ├── lib/          # api.ts (fetch o'rami, auth header), telegram.ts
│   │   ├── pages/        # Bosh sahifa, buyurtmalar, takliflar, usta profili, admin panel
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vercel.json       # Vercel SPA rewrite qoidalari
│   ├── .env.example      # Frontend muhit o'zgaruvchilari namunasi
│   └── package.json
├── server/               # Fastify + Prisma + grammY (REST API & Bot)
│   ├── prisma/
│   │   ├── schema.prisma # PostgreSQL ma'lumotlar sxemasi (User, MasterProfile, Request, Offer, Review)
│   │   └── seed.ts       # Toshkent tumanlari va xizmat turlarini dastlabki yuklash
│   ├── src/
│   │   ├── app.ts        # Fastify app konfiguratsiyasi, CORS, Helmet, Rate-limit
│   │   ├── env.ts        # Zod yordamida env o'zgaruvchilarini tekshirish
│   │   ├── db.ts         # Prisma ulanishi
│   │   ├── auth/         # Telegram HMAC tekshiruvi va JWT tokenlar
│   │   ├── bot/          # grammY boti, komandalar va polling
│   │   ├── routes/       # Auth, Requests, Offers, Workflow, Admin, Webhook, Masters
│   │   ├── notifications/# Telegram orqali xabarnomalar
│   │   ├── scripts/      # set-webhook.ts va smoke.ts
│   │   └── index.ts      # Server entry point
│   ├── .env.example      # Server muhit o'zgaruvchilari namunasi
│   └── package.json
├── render.yaml           # Render Web Service Blueprint (Free tier)
├── DEPLOY.md             # Supabase + Render + Vercel + Telegram bot deploy qo'llanmasi
├── MANUAL_TESTING.md     # 2 ta Telegram akkaunt bilan qo'lda sinovdan o'tkazish qo'llanmasi
├── eslint.config.js      # Monorepo ESLint qoidalari
├── package.json          # Ildiz npm workspaces va boshqaruv skriptlari
└── vitest.config.ts      # Vitest test konfiguratsiyasi
```

---

## 🚀 Ishga Tushirish (Local Development)

### 1. Bog‘liqliklarni o‘rnatish:
```bash
npm install
```

### 2. Muhit o‘zgaruvchilarini sozlash:
`server/.env.example` va `web/.env.example` namunalaridan nusxa olib `.env` fayllarini yarating:

- **`server/.env`:**
  ```env
  NODE_ENV=development
  PORT=3001
  DATABASE_URL=postgresql://postgres:...@...pooler.supabase.com:6543/postgres?pgbouncer=true
  DIRECT_URL=postgresql://postgres:...@...supabase.com:5432/postgres
  BOT_TOKEN=123456789:AA...
  BOT_WEBHOOK_SECRET=your_32_chars_random_secret_string
  JWT_SECRET=your_32_chars_random_jwt_secret_key
  ADMIN_TELEGRAM_IDS=123456789
  WEB_APP_URL=http://localhost:5173
  ```

- **`web/.env`:**
  ```env
  VITE_API_URL=http://localhost:3001
  ```

### 3. Ma’lumotlar bazasini tayyorlash:
```bash
# Migratsiyalarni qo'llash
npm run db:deploy

# Toshkent tumanlari va xizmat turlarini bazaga kiritish
npm run db:seed
```

### 4. Ishlab chiqish serverlarini ishga tushirish:
```bash
# Frontend va Backendni bir vaqtda ishga tushirish:
npm run dev

# Alohida terminalda Telegram botni polling rejimida yoqish:
npm run bot:dev
```

---

## 🧪 Sinov va Sifat Nazorati

Loyihada barcha 12 bosqich funksiyalari to‘liq qamrab olingan va avtomatlashtirilgan:

```bash
# 1. Qat'iy TypeScript tekshiruvi (0 errors):
npm run typecheck

# 2. ESLint sifat tekshiruvi (0 warnings/errors):
npm run lint

# 3. Avtomatlashtirilgan testlar (12 test to'plami, 66 ta test):
npm run test

# 4. Production build:
npm run build
```

---

## 📖 Qo‘llanmalar

1. **[DEPLOY.md](./DEPLOY.md)** — Supabase, Render, Vercel va Telegram Webhook orqali bepul production deploy qilish bo‘yicha 8 qadamli qo‘llanma.
2. **[MANUAL_TESTING.md](./MANUAL_TESTING.md)** — 2 ta haqiqiy Telegram hisobi (Mijoz va Usta) hamda Admin yordamida tizimni bosqichma-bosqich qo‘lda tekshirish ssenariylari.

---

## 🛡 Xavfsizlik Qoidalari
1. **Mock va soxta ma'lumotlar mavjud emas:** Barcha amallar real API va PostgreSQL orqali bajariladi.
2. **Sirlar kodga yozilmaydi:** Faqat `.env` orqali Zod tekshiruvidan o‘tib yuklanadi.
3. **Maxfiylik:** Mijozning telefon raqami va aniq manzili ommaviy so‘rovlarda berilmaydi, faqat usta tanlanib kelishuvga erishilgach o‘zaro ochiladi.
