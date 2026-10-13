import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, MasterRequestItem } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const MasterRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [requests, setRequests] = useState<MasterRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Agar usta hali tasdiqlanmagan bo'lsa
    if (user?.masterProfile?.status !== 'APPROVED') {
      setError('Ushbu bo‘lim faqat tasdiqlangan (APPROVED) ustalar uchun ochiq.');
      setLoading(false);
      return;
    }

    api
      .getMasterRequests({ page: 1, limit: 20 })
      .then((res) => {
        setRequests(res.requests);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'So‘rovlarni yuklashda xatolik yuz berdi';
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  const formatPreferredTime = (time?: MasterRequestItem['preferredTime']) => {
    switch (time) {
      case 'ASAP':
        return '⚡ Zudlik bilan';
      case 'TODAY':
        return '📅 Bugun';
      case 'THIS_WEEK':
        return '🗓️ Shu hafta';
      case 'FLEXIBLE':
        return '🤝 Kelishilgan holda';
      default:
        return 'Kelishilgan holda';
    }
  };

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text p-4 max-w-lg mx-auto space-y-4">
      {/* Yuqori nav */}
      <header className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-tg-link hover:underline inline-flex items-center gap-1"
        >
          ← Bosh sahifa
        </button>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
          Tasdiqlangan usta
        </span>
      </header>

      <div>
        <h1 className="text-xl font-bold">Yangi so‘rovlar</h1>
        <p className="text-xs text-tg-hint">
          Siz tanlagan xizmat turlari va tumanlardagi faol mijoz so‘rovlari
        </p>
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

      {!loading && !error && requests.length === 0 && (
        <div className="py-12 text-center space-y-4 bg-tg-secondaryBg rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60">
          <div className="text-4xl">🔍</div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Hozircha yangi so‘rovlar yo‘q</h2>
            <p className="text-xs text-tg-hint">
              Sizning sohangizda yangi so‘rov paydo bo‘lishi bilan Telegram bot orqali xabar olasiz
            </p>
          </div>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/requests/${item.id}`)}
              className="p-4 rounded-2xl bg-tg-secondaryBg border border-slate-200/60 dark:border-slate-800/60 hover:border-blue-400 dark:hover:border-blue-600 transition shadow-sm cursor-pointer space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      {item.service.nameUz}
                    </span>
                    <span className="text-xs text-tg-hint">{item.district.nameUz}</span>
                  </div>
                  <h2 className="text-sm font-bold line-clamp-1">{item.title}</h2>
                </div>

                {item.hasOffered ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                    ✓ Taklif berilgan
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                    Yangi
                  </span>
                )}
              </div>

              <p className="text-xs text-tg-hint line-clamp-2">{item.description}</p>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-tg-hint">{formatPreferredTime(item.preferredTime)}</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {item.budgetMin || item.budgetMax ? (
                    <>
                      {item.budgetMin ? `${item.budgetMin.toLocaleString()} so‘m` : '0'}
                      {' - '}
                      {item.budgetMax ? `${item.budgetMax.toLocaleString()} so‘m` : 'cheksiz'}
                    </>
                  ) : (
                    'Kelishilgan holda'
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
