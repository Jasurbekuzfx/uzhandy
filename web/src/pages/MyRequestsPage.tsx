import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, RequestItem } from '../lib/api';

export const MyRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMyRequests()
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
  }, []);

  const getStatusBadge = (status: RequestItem['status']) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            🟢 Ochiq
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
            🟡 Usta tanlandi
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
            🔵 Jarayonda
          </span>
        );
      case 'DONE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
            ✅ Bajarildi
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            ✕ Bekor qilingan
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text p-4 max-w-lg mx-auto space-y-4">
      {/* Yuqori qism */}
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
          onClick={() => navigate('/requests/new')}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
        >
          + Yangi so‘rov
        </button>
      </header>

      <div>
        <h1 className="text-xl font-bold">Mening so‘rovlarim</h1>
        <p className="text-xs text-tg-hint">Siz qoldirgan barcha usta chaqirish so‘rovlari</p>
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
          <div className="text-4xl">📝</div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Hozircha so‘rovlar yo‘q</h2>
            <p className="text-xs text-tg-hint">
              Uy ta’miri yoki usta kerak bo‘lsa, yangi so‘rov qoldiring
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/requests/new')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition"
          >
            So‘rov qoldirish
          </button>
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
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.service.nameUz}
                    </span>
                    <span className="text-xs text-tg-hint">{item.district.nameUz}</span>
                  </div>
                  <h2 className="text-sm font-bold line-clamp-1">{item.title}</h2>
                </div>
                {getStatusBadge(item.status)}
              </div>

              <p className="text-xs text-tg-hint line-clamp-2">{item.description}</p>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-tg-hint">
                  {new Date(item.createdAt).toLocaleDateString('uz-UZ', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {item.offersCount !== undefined && item.offersCount > 0
                    ? `💬 ${item.offersCount} ta taklif`
                    : '⏳ Takliflar kutilmoqda'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
