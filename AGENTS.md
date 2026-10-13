Sen UstaTop loyihasini noldan quryapsan: Toshkentdagi uy egalari va ustalarni bog'laydigan Telegram Mini App. Bu haqiqiy production ilova, demo emas.

Qat'iy qoidalar:
1. Hech qanday mock, soxta ma'lumot, localStorage'da saqlanadigan "baza", hardcode qilingan foydalanuvchi yoki demo akkaunt yozma. Barcha ma'lumot faqat server API va PostgreSQL orqali.
2. Hech qanday sir (token, kalit, parol) kodga yozilmaydi. Faqat process.env orqali o'qiladi va ishga tushishda zod bilan tekshiriladi. Yo'q bo'lsa server ishga tushmasdan aniq xato beradi.
3. .env fayllar .gitignore'da bo'ladi. Faqat .env.example (bo'sh qiymatlar bilan) commit qilinadi.
4. TypeScript strict rejimda. `any` ishlatma.
5. Har bir API endpoint kiruvchi ma'lumotni zod bilan tekshiradi va kim chaqirayotganini (rol, egalik) tekshiradi.
6. Foydalanuvchining telefon raqami va aniq manzili hech qachon ommaviy ro'yxatlarda qaytmaydi.
7. Faqat shu bosqichda so'ralgan ishni qil. Keyingi bosqichlarni oldindan qurma.
8. Ish oxirida: `npm run typecheck`, `npm run lint`, `npm test` ishga tushir va natijasini ko'rsat. Qaysi fayllarni o'zgartirganingni ro'yxat qilib ber.
9. Interfeys matnlari o'zbek tilida (lotin).
10. Biror narsani bilmasang yoki ikki xil yo'l bo'lsa, taxmin qilma, menga savol ber.
