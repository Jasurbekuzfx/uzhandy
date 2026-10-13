import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, HealthResponse } from '../lib/api';
import { PhoneRequiredModal } from '../components/PhoneRequiredModal';

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  useEffect(() => {
    api
      .getHealth()
      .then(setHealth)
      .catch(() => {
        // Health check error handled silently
      });
  }, []);

  const displayName = user?.firstName || 'Foydalanuvchi';

  const handleOrderRequest = () => {
    if (!user?.phone) {
      setPhoneModalOpen(true);
      return;
    }
    navigate('/requests/new');
  };

  const handleMasterApply = () => {
    if (!user?.phone) {
      setPhoneModalOpen(true);
      return;
    }
    navigate('/master/apply');
  };

  const handleMyRequests = () => {
    navigate('/requests/mine');
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-tg-bg text-tg-text">
      <div className="w-full max-w-md p-6 rounded-2xl bg-tg-secondaryBg shadow-sm border border-slate-200/60 dark:border-slate-800/60 space-y-6">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-tg-button text-tg-buttonText font-bold text-2xl shadow-md">
            UT
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Salom, {displayName}!</h1>
          <p className="text-sm text-tg-hint">
            UstaTop orqali usta toping yoki usta sifatida xizmat ko‘rsating
          </p>
        </header>

        {/* Asosiy harakat tugmalari */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleOrderRequest}
            className="w-full py-4 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-md transition-all active:scale-[0.98] flex items-center justify-between"
          >
            <span>Usta kerak</span>
            <span className="text-xl">🛠️</span>
          </button>

          <button
            type="button"
            onClick={handleMasterApply}
            className="w-full py-4 px-5 rounded-xl bg-tg-bg hover:bg-slate-100 dark:hover:bg-slate-800 text-tg-text font-semibold text-base border border-slate-300 dark:border-slate-700 shadow-sm transition-all active:scale-[0.98] flex items-center justify-between"
          >
            <span>Men ustaman</span>
            <span className="text-xl">👨‍🔧</span>
          </button>

          <button
            type="button"
            onClick={handleMyRequests}
            className="w-full py-3 px-5 rounded-xl bg-tg-bg hover:bg-slate-100 dark:hover:bg-slate-800 text-tg-text font-medium text-sm border border-slate-200 dark:border-slate-800 shadow-sm transition-all active:scale-[0.98] flex items-center justify-between"
          >
            <span>Mening so‘rovlarim</span>
            <span className="text-base">📋</span>
          </button>

          {user?.masterProfile?.status === 'APPROVED' && (
            <>
              <button
                type="button"
                onClick={() => navigate('/master/requests')}
                className="w-full py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-between"
              >
                <span>Yangi so‘rovlar (Usta uchun)</span>
                <span className="text-lg">⚡</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/master/offers')}
                className="w-full py-3 px-5 rounded-xl bg-tg-bg hover:bg-slate-100 dark:hover:bg-slate-800 text-tg-text font-medium text-sm border border-slate-200 dark:border-slate-800 shadow-sm transition-all active:scale-[0.98] flex items-center justify-between"
              >
                <span>Mening takliflarim (Usta)</span>
                <span className="text-base">💼</span>
              </button>
            </>
          )}

          {user?.role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-between"
            >
              <span>Admin Panel (Boshqaruv)</span>
              <span className="text-lg">🛡️</span>
            </button>
          )}
        </div>



        {/* Server va baza holati */}
        <section className="p-3 rounded-xl bg-tg-bg border border-slate-200/40 dark:border-slate-700/40 text-xs text-tg-hint flex items-center justify-between">
          <span>Server & Baza holati:</span>
          <span
            className={`font-medium ${
              health?.ok && health.db
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-500'
            }`}
          >
            {health?.ok && health.db ? '🟢 Faol (Online)' : '🟡 Tekshirilmoqda...'}
          </span>
        </section>

        <PhoneRequiredModal
          isOpen={phoneModalOpen}
          onClose={() => setPhoneModalOpen(false)}
        />
      </div>
    </main>
  );
}
