import React from 'react';

export const OpenInTelegramScreen: React.FC = () => {
  const botUrl = import.meta.env.VITE_BOT_URL || 'https://t.me/ustatop_bot';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-tg-bg text-tg-text">
      <div className="max-w-md w-full bg-tg-secondaryBg border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-lg">
        <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-8 h-8 fill-current"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06-.01.21-.04.42z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold mb-3">
          Iltimos, ilovani Telegram bot orqali oching
        </h1>

        <p className="text-sm text-tg-hint mb-6 leading-relaxed">
          UstaTop platformasi to‘liq xavfsiz va haqiqiy foydalanuvchilar bilan ishlashi uchun faqat
          Telegram Mini App orqali ishga tushiriladi.
        </p>

        <a
          href={botUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-full px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition shadow"
        >
          Telegram botni ochish
        </a>
      </div>
    </div>
  );
};
