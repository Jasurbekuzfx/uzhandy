import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, MyOfferItem } from '../lib/api';

export const MyOffersPage: React.FC = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<MyOfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMyOffers()
      .then((res) => {
        setOffers(res.offers);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Takliflarni yuklashda xatolik yuz berdi';
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const getStatusBadge = (status: MyOfferItem['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
            ⏳ Kutilmoqda
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            ✅ Qabul qilindi
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
            ✕ Rad etildi
          </span>
        );
      case 'WITHDRAWN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            ↩️ Qaytarib olingan
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text p-4 max-w-lg mx-auto space-y-4">
      <header className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-tg-link hover:underline inline-flex items-center gap-1"
        >
          ← Bosh sahifa
        </button>
        <button
          type="button"
          onClick={() => navigate('/master/requests')}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
        >
          Yangi so‘rovlar
        </button>
      </header>

      <div>
        <h1 className="text-xl font-bold">Mening takliflarim</h1>
        <p className="text-xs text-tg-hint">Siz turli so‘rovlarga yuborgan narx takliflaringiz</p>
      </div>

      {loading && (
        <div className="py-12 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && offers.length === 0 && (
        <div className="py-12 text-center space-y-4 bg-tg-secondaryBg rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60">
          <div className="text-4xl">💼</div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Hozircha takliflar yo‘q</h2>
            <p className="text-xs text-tg-hint">
              Mijoz so‘rovlariga o‘z narxingizni taklif qiling va buyurtmalarni oling
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/master/requests')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition"
          >
            Yangi so‘rovlarni ko‘rish
          </button>
        </div>
      )}

      {!loading && !error && offers.length > 0 && (
        <div className="space-y-3">
          {offers.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/requests/${item.request.id}`)}
              className="p-4 rounded-2xl bg-tg-secondaryBg border border-slate-200/60 dark:border-slate-800/60 hover:border-blue-400 dark:hover:border-blue-600 transition shadow-sm cursor-pointer space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.request.service.nameUz}
                    </span>
                    <span className="text-xs text-tg-hint">{item.request.district.nameUz}</span>
                  </div>
                  <h2 className="text-sm font-bold line-clamp-1">{item.request.title}</h2>
                </div>
                {getStatusBadge(item.status)}
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-tg-hint">Taklifingiz:</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {item.price.toLocaleString()} so‘m
                  </span>
                </div>
                <p className="text-xs text-tg-hint line-clamp-2">💬 {item.message}</p>
              </div>

              <div className="flex items-center justify-between text-xs text-tg-hint pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <span>
                  {new Date(item.createdAt).toLocaleDateString('uz-UZ', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">Batafsil ko‘rish →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
