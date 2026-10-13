import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OpenInTelegramScreen } from './components/OpenInTelegramScreen';
import { getTelegramWebApp } from './lib/telegram';
import { HomePage } from './pages/HomePage';
import { MasterApplyPage } from './pages/MasterApplyPage';
import { CreateRequestPage } from './pages/CreateRequestPage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { MasterRequestsPage } from './pages/MasterRequestsPage';
import { MyOffersPage } from './pages/MyOffersPage';
import { MasterProfilePage } from './pages/MasterProfilePage';
import { AdminPage } from './pages/AdminPage';

function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const tg = getTelegramWebApp();
    const startParam = (tg?.initDataUnsafe as { start_param?: string } | undefined)?.start_param;
    if (startParam) {
      if (startParam.startsWith('req_')) {
        const id = startParam.slice(4);
        navigate(`/requests/${id}`, { replace: true });
      } else if (startParam.startsWith('master_prof_')) {
        const id = startParam.slice(12);
        navigate(`/masters/${id}`, { replace: true });
      } else if (startParam === 'master_requests') {
        navigate('/master/requests', { replace: true });
      } else if (startParam === 'admin') {
        navigate('/admin', { replace: true });
      } else if (startParam) {
        navigate(`/requests/${startParam}`, { replace: true });
      }
    }
  }, [navigate]);

  return null;
}

function AppContent() {
  const { isTelegram, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tg-bg text-tg-text">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-tg-hint">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  // Agar oddiy brauzerda ochilgan bo'lsa (Telegram initData mavjud emas)
  if (!isTelegram) {
    return <OpenInTelegramScreen />;
  }

  // Autentifikatsiyada xatolik bo'lsa
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-tg-bg text-tg-text">
        <div className="max-w-md w-full bg-tg-secondaryBg rounded-2xl p-6 text-center space-y-4 border border-rose-300 dark:border-rose-900/40">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400">
            Kirishda xatolik yuz berdi
          </h2>
          <p className="text-sm text-tg-hint">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <DeepLinkHandler />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/master/apply" element={<MasterApplyPage />} />
        <Route path="/master/requests" element={<MasterRequestsPage />} />
        <Route path="/master/offers" element={<MyOffersPage />} />
        <Route path="/requests/new" element={<CreateRequestPage />} />
        <Route path="/requests/mine" element={<MyRequestsPage />} />
        <Route path="/requests/:id" element={<RequestDetailPage />} />
        <Route path="/masters/:id" element={<MasterProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}




export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
