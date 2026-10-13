import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTelegramWebApp } from '../lib/telegram';

interface PhoneRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhoneRequiredModal: React.FC<PhoneRequiredModalProps> = ({ isOpen, onClose }) => {
  const { refetchUser } = useAuth();
  const [checking, setChecking] = useState(false);

  if (!isOpen) return null;

  const botUrl = import.meta.env.VITE_BOT_URL || 'https://t.me/ustatop_bot';

  const handleOpenBot = () => {
    const tg = getTelegramWebApp();
    if (tg && typeof tg.openTelegramLink === 'function') {
      tg.openTelegramLink(botUrl);
    } else {
      window.open(botUrl, '_blank');
    }
  };

  const handleCheckPhone = async () => {
    setChecking(true);
    await refetchUser();
    setChecking(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="max-w-sm w-full bg-tg-secondaryBg border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl">
          📱
        </div>

        <h3 className="text-lg font-bold text-tg-text">
          Avval botda raqamingizni yuboring
        </h3>

        <p className="text-sm text-tg-hint leading-relaxed">
          Platformada so‘rov qoldirish yoki usta sifatida faoliyat yuritish uchun telefon raqamingiz
          bot orqali tasdiqlangan bo‘lishi shart.
        </p>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleOpenBot}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition shadow flex items-center justify-center space-x-2"
          >
            <span>Botga o‘tib, raqamni yuborish</span>
            <span>↗</span>
          </button>

          <button
            type="button"
            onClick={() => void handleCheckPhone()}
            disabled={checking}
            className="w-full py-2.5 px-4 rounded-xl bg-tg-bg hover:bg-slate-100 dark:hover:bg-slate-800 text-tg-text font-medium border border-slate-300 dark:border-slate-700 transition disabled:opacity-50"
          >
            {checking ? 'Tekshirilmoqda...' : 'Raqamni yubordim, tekshirish'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs text-tg-hint hover:text-tg-text transition"
          >
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
};
