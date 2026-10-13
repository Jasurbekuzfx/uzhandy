import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, PublicMasterProfile } from '../lib/api';
import { getTelegramWebApp } from '../lib/telegram';

export const MasterProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [master, setMaster] = useState<PublicMasterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getMasterProfile(id)
      .then((res) => {
        setMaster(res.master);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Usta profili topilmadi';
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  // Telegram BackButton
  useEffect(() => {
    const tg = getTelegramWebApp();
    const backBtn = tg?.BackButton;
    if (!backBtn) return undefined;

    const handleBack = () => {
      navigate(-1);
    };

    backBtn.show();
    backBtn.onClick(handleBack);

    return () => {
      backBtn.offClick(handleBack);
      backBtn.hide();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-tg-bg text-tg-text">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-tg-hint">Usta ma’lumotlari yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (error || !master) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-tg-bg text-tg-text">
        <div className="max-w-md w-full bg-tg-secondaryBg rounded-2xl p-6 text-center space-y-4 border border-rose-300 dark:border-rose-900/40">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-base font-bold text-rose-600 dark:text-rose-400">
            {error || 'Usta profili topilmadi'}
          </h2>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Ortga qaytish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text p-4 pb-20 space-y-4 max-w-lg mx-auto">
      {/* Profil bosh qismi */}
      <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 space-y-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl font-extrabold shadow-md overflow-hidden flex-shrink-0">
            {master.photoUrl ? (
              <img
                src={master.photoUrl}
                alt={`${master.firstName} rasmi`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{master.firstName[0]}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold truncate">
              {master.firstName} {master.lastName || ''}
            </h1>
            <div className="flex items-center gap-2 text-xs text-tg-hint mt-0.5">
              <span>Tajriba: {master.experienceYears} yil</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ Tasdiqlangan
              </span>
            </div>

            {master.username && (
              <a
                href={`https://t.me/${master.username}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 font-medium"
              >
                <span>@{master.username}</span>
                <span>↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Asosiy ko'rsatkichlar kartalari */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="text-base font-extrabold text-amber-500">
              ⭐ {Number(master.ratingAvg).toFixed(1)}
            </div>
            <div className="text-[11px] text-tg-hint">{master.ratingCount} ta baho</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
              {master.completedCount}
            </div>
            <div className="text-[11px] text-tg-hint">Bajarilgan ish</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="text-base font-extrabold text-blue-600 dark:text-blue-400">
              {master.experienceYears} yil
            </div>
            <div className="text-[11px] text-tg-hint">Tajriba</div>
          </div>
        </div>
      </section>

      {/* Mutaxassis haqida ma'lumot */}
      {master.bio && (
        <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 space-y-2 shadow-sm">
          <h2 className="text-xs font-semibold text-tg-hint uppercase tracking-wider">
            Mutaxassis haqida
          </h2>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{master.bio}</p>
        </section>
      )}

      {/* Xizmat turlari */}
      {master.services && master.services.length > 0 && (
        <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 space-y-2.5 shadow-sm">
          <h2 className="text-xs font-semibold text-tg-hint uppercase tracking-wider">
            Xizmat yo‘nalishlari ({master.services.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {master.services.map((srv) => (
              <span
                key={srv.id}
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium"
              >
                🛠️ {srv.nameUz}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Xizmat ko'rsatish tumanlari */}
      {master.districts && master.districts.length > 0 && (
        <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 space-y-2.5 shadow-sm">
          <h2 className="text-xs font-semibold text-tg-hint uppercase tracking-wider">
            Xizmat ko‘rsatish hududlari ({master.districts.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {master.districts.map((dst) => (
              <span
                key={dst.id}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-tg-text text-xs font-medium"
              >
                📍 {dst.nameUz}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Mijozlar fikrlari */}
      <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-tg-hint uppercase tracking-wider">
            Mijozlar fikrlari ({master.reviews.length})
          </h2>
          <span className="text-xs font-bold text-amber-500">
            ⭐ {Number(master.ratingAvg).toFixed(1)} / 5.0
          </span>
        </div>

        {master.reviews.length === 0 ? (
          <div className="py-6 text-center space-y-2 text-tg-hint">
            <div className="text-2xl">💬</div>
            <p className="text-xs">Ushbu usta uchun hali fikrlar qoldirilmagan</p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {master.reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[11px]">
                      {rev.customerName[0]}
                    </span>
                    <span>Mijoz {rev.customerName}</span>
                  </div>
                  <span className="text-tg-hint text-[11px]">
                    {new Date(rev.createdAt).toLocaleDateString('uz-UZ', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-amber-500 text-xs">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i}>{i < rev.rating ? '★' : '☆'}</span>
                  ))}
                  <span className="text-[11px] font-semibold text-tg-hint ml-1">
                    ({rev.rating}/5)
                  </span>
                </div>

                {rev.comment && (
                  <p className="text-xs text-tg-text leading-relaxed whitespace-pre-wrap">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
