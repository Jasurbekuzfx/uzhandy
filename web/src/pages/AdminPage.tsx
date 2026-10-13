import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  api,
  AdminMasterItem,
  AdminRequestItem,
  AdminStatsResponse,
} from '../lib/api';
import { getTelegramWebApp } from '../lib/telegram';

type AdminTab = 'masters' | 'requests' | 'stats';
type MasterStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('masters');

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

  // --- ARIZALAR (MASTERS) HOLATI ---
  const [masters, setMasters] = useState<AdminMasterItem[]>([]);
  const [masterStatusFilter, setMasterStatusFilter] = useState<MasterStatusFilter>('PENDING');
  const [mastersLoading, setMastersLoading] = useState(false);
  const [masterActionLoading, setMasterActionLoading] = useState<string | null>(null);

  // Rad etish modali
  const [rejectModalMaster, setRejectModalMaster] = useState<AdminMasterItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Bloklash modali
  const [blockModalUser, setBlockModalUser] = useState<{ id: string; name: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);

  // --- SO'ROVLAR (REQUESTS) HOLATI ---
  const [requests, setRequests] = useState<AdminRequestItem[]>([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL');
  const [requestsPage, setRequestsPage] = useState<number>(1);
  const [requestsTotal, setRequestsTotal] = useState<number>(0);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // --- STATISTIKA HOLATI ---
  const [stats, setStats] = useState<AdminStatsResponse['stats'] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // 1. Arizalarni yuklash
  const fetchMasters = () => {
    setMastersLoading(true);
    const filter = masterStatusFilter === 'ALL' ? undefined : masterStatusFilter;
    api
      .getAdminMasters(filter)
      .then((res) => {
        setMasters(res.masters);
      })
      .catch((err) => {
        console.error('Arizalarni yuklashda xatolik:', err);
      })
      .finally(() => {
        setMastersLoading(false);
      });
  };

  // 2. So'rovlarni yuklash
  const fetchRequests = (page = 1) => {
    setRequestsLoading(true);
    const filter = requestStatusFilter === 'ALL' ? undefined : requestStatusFilter;
    api
      .getAdminRequests({ status: filter, page, limit: 15 })
      .then((res) => {
        setRequests(res.requests);
        setRequestsTotal(res.total);
        setRequestsPage(res.page);
      })
      .catch((err) => {
        console.error('So‘rovlarni yuklashda xatolik:', err);
      })
      .finally(() => {
        setRequestsLoading(false);
      });
  };

  // 3. Statistikani yuklash
  const fetchStats = () => {
    setStatsLoading(true);
    api
      .getAdminStats()
      .then((res) => {
        setStats(res.stats);
      })
      .catch((err) => {
        console.error('Statistikani yuklashda xatolik:', err);
      })
      .finally(() => {
        setStatsLoading(false);
      });
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      if (activeTab === 'masters') fetchMasters();
      if (activeTab === 'requests') fetchRequests(1);
      if (activeTab === 'stats') fetchStats();
    }
  }, [activeTab, masterStatusFilter, requestStatusFilter, user?.role]);

  // Agar admin bo'lmasa -> 404 sahifa ko'rsatiladi
  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-tg-bg text-tg-text">
        <div className="max-w-md w-full bg-tg-secondaryBg rounded-2xl p-6 text-center space-y-4 border border-slate-200 dark:border-slate-800">
          <div className="text-4xl">🔍</div>
          <h1 className="text-lg font-bold">404 - Sahifa topilmadi</h1>
          <p className="text-xs text-tg-hint">
            Kechirasiz, siz qidirgan sahifa mavjud emas yoki ko‘rish huquqi cheklangan.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Bosh sahifaga qaytish
          </button>
        </div>
      </div>
    );
  }

  // --- USTANI TASDIQLASH ---
  const handleApproveMaster = async (masterId: string) => {
    setMasterActionLoading(masterId);
    try {
      await api.approveMaster(masterId);
      fetchMasters();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Tasdiqlashda xatolik');
    } finally {
      setMasterActionLoading(null);
    }
  };

  // --- USTANI RAD ETISH ---
  const handleConfirmReject = async () => {
    if (!rejectModalMaster) return;
    if (rejectReason.trim().length < 5) {
      setRejectError('Rad etish sababini yozing (kamida 5 ta belgi)');
      return;
    }

    setMasterActionLoading(rejectModalMaster.id);
    try {
      await api.rejectMaster(rejectModalMaster.id, rejectReason.trim());
      setRejectModalMaster(null);
      setRejectReason('');
      fetchMasters();
    } catch (err: unknown) {
      setRejectError(err instanceof Error ? err.message : 'Rad etishda xatolik');
    } finally {
      setMasterActionLoading(null);
    }
  };

  // --- USTANI SUSPEND QILISH ---
  const handleSuspendMaster = async (masterId: string) => {
    const reason = prompt('To‘xtatish sababi (ixtiyoriy):');
    if (reason === null) return;

    setMasterActionLoading(masterId);
    try {
      await api.suspendMaster(masterId, reason.trim() || undefined);
      fetchMasters();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'To‘xtatishda xatolik');
    } finally {
      setMasterActionLoading(null);
    }
  };

  // --- FOYDALANUVCHINI BLOKLASH ---
  const handleConfirmBlock = async () => {
    if (!blockModalUser) return;
    if (blockReason.trim().length < 5) {
      setBlockError('Bloklash sababini yozing (kamida 5 ta belgi)');
      return;
    }

    try {
      await api.blockUser(blockModalUser.id, blockReason.trim());
      setBlockModalUser(null);
      setBlockReason('');
      fetchMasters();
    } catch (err: unknown) {
      setBlockError(err instanceof Error ? err.message : 'Bloklashda xatolik');
    }
  };

  // --- FOYDALANUVCHINI BLOKDAN CHIQARISH ---
  const handleUnblockUser = async (userId: string) => {
    try {
      await api.unblockUser(userId);
      fetchMasters();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Blokdan chiqarishda xatolik');
    }
  };

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text p-4 max-w-xl mx-auto space-y-4 pb-20">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black flex items-center gap-1.5">
            <span>🛡️</span>
            <span>Admin Panel</span>
          </h1>
          <p className="text-xs text-tg-hint">Boshqaruv va moderatsiya markazi</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-xs text-tg-link hover:underline font-semibold"
        >
          Ilovaga qaytish →
        </button>
      </header>

      {/* Tablar */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('masters')}
          className={`flex-1 py-2 px-3 rounded-lg transition ${
            activeTab === 'masters'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-tg-hint hover:text-tg-text'
          }`}
        >
          📋 Arizalar
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2 px-3 rounded-lg transition ${
            activeTab === 'requests'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-tg-hint hover:text-tg-text'
          }`}
        >
          📦 So‘rovlar
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2 px-3 rounded-lg transition ${
            activeTab === 'stats'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-tg-hint hover:text-tg-text'
          }`}
        >
          📊 Statistika
        </button>
      </div>

      {/* TAB 1: ARIZALAR */}
      {activeTab === 'masters' && (
        <section className="space-y-3">
          {/* Status filterlari */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ALL'] as MasterStatusFilter[]).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setMasterStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                    masterStatusFilter === st
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-tg-secondaryBg border border-slate-200 dark:border-slate-800 text-tg-hint hover:text-tg-text'
                  }`}
                >
                  {st === 'PENDING' && '⏳ Yangi arizalar'}
                  {st === 'APPROVED' && '✅ Tasdiqlangan'}
                  {st === 'REJECTED' && '✕ Rad etilgan'}
                  {st === 'SUSPENDED' && '⛔ To‘xtatilgan'}
                  {st === 'ALL' && 'Hammasi'}
                </button>
              ),
            )}
          </div>

          {mastersLoading && (
            <div className="py-12 text-center text-tg-hint text-xs">Arizalar yuklanmoqda...</div>
          )}

          {!mastersLoading && masters.length === 0 && (
            <div className="py-12 text-center text-tg-hint space-y-2 bg-tg-secondaryBg rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="text-3xl">📭</div>
              <p className="text-xs font-medium">Ushbu holatda arizalar topilmadi</p>
            </div>
          )}

          {!mastersLoading &&
            masters.map((m) => (
              <div
                key={m.id}
                className="bg-tg-secondaryBg rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      {m.user.firstName[0]}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">
                        {m.user.firstName} {m.user.lastName || ''}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-tg-hint">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          📞 {m.user.phone || 'Raqam yo‘q'}
                        </span>
                        {m.user.username && <span>• @{m.user.username}</span>}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        : m.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : m.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                {/* Tafsilotlar */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-tg-hint">Tajriba:</span>
                    <span className="font-semibold">{m.experienceYears} yil</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-tg-hint">Bajarilgan ishlar:</span>
                    <span className="font-semibold">{m.completedCount} ta</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-tg-hint">Reyting:</span>
                    <span className="font-semibold">
                      ⭐ {m.ratingAvg.toFixed(1)} ({m.ratingCount} ta baho)
                    </span>
                  </div>
                  {m.bio && (
                    <div className="pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-tg-hint font-medium">Bio: </span>
                      <span>{m.bio}</span>
                    </div>
                  )}
                  {m.rejectReason && (
                    <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[11px]">
                      <strong>Rad etish sababi:</strong> {m.rejectReason}
                    </div>
                  )}
                </div>

                {/* Xizmatlar va Tumanlar */}
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {m.services.map((s) => (
                      <span
                        key={s.id}
                        className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium"
                      >
                        🛠️ {s.nameUz}
                      </span>
                    ))}
                    {m.districts.map((d) => (
                      <span
                        key={d.id}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-tg-hint text-[10px] font-medium"
                      >
                        📍 {d.nameUz}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Admin harakatlari */}
                <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                  {m.status !== 'APPROVED' && (
                    <button
                      type="button"
                      disabled={masterActionLoading === m.id}
                      onClick={() => handleApproveMaster(m.id)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      {masterActionLoading === m.id ? '...' : '✓ Tasdiqlash'}
                    </button>
                  )}

                  {m.status !== 'REJECTED' && (
                    <button
                      type="button"
                      disabled={masterActionLoading === m.id}
                      onClick={() => {
                        setRejectModalMaster(m);
                        setRejectReason('');
                        setRejectError(null);
                      }}
                      className="flex-1 py-2 px-3 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-semibold transition"
                    >
                      ✕ Rad etish
                    </button>
                  )}

                  {m.status === 'APPROVED' && (
                    <button
                      type="button"
                      disabled={masterActionLoading === m.id}
                      onClick={() => handleSuspendMaster(m.id)}
                      className="py-2 px-3 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-semibold transition"
                    >
                      To‘xtatish
                    </button>
                  )}

                  {/* Foydalanuvchini bloklash / blokdan chiqarish */}
                  {m.user.isBlocked ? (
                    <button
                      type="button"
                      onClick={() => handleUnblockUser(m.user.id)}
                      className="py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition"
                    >
                      Blokdan ochish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setBlockModalUser({
                          id: m.user.id,
                          name: `${m.user.firstName} ${m.user.lastName || ''}`.trim(),
                        });
                        setBlockReason('');
                        setBlockError(null);
                      }}
                      className="py-2 px-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-xs font-semibold"
                    >
                      Bloklash
                    </button>
                  )}
                </div>
              </div>
            ))}
        </section>
      )}

      {/* TAB 2: SO'ROVLAR */}
      {activeTab === 'requests' && (
        <section className="space-y-3">
          {/* Status filterlari */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setRequestStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                  requestStatusFilter === st
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-tg-secondaryBg border border-slate-200 dark:border-slate-800 text-tg-hint hover:text-tg-text'
                }`}
              >
                {st === 'ALL' && 'Hammasi'}
                {st === 'OPEN' && '🟢 Ochiq'}
                {st === 'ASSIGNED' && '🟡 Usta tanlangan'}
                {st === 'IN_PROGRESS' && '🔵 Jarayonda'}
                {st === 'DONE' && '✅ Bajarilgan'}
                {st === 'CANCELLED' && '✕ Bekor qilingan'}
              </button>
            ))}
          </div>

          {requestsLoading && (
            <div className="py-12 text-center text-tg-hint text-xs">So‘rovlar yuklanmoqda...</div>
          )}

          {!requestsLoading && requests.length === 0 && (
            <div className="py-12 text-center text-tg-hint bg-tg-secondaryBg rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="text-3xl">📦</div>
              <p className="text-xs font-medium">Ushbu holatda so‘rovlar topilmadi</p>
            </div>
          )}

          {!requestsLoading &&
            requests.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/requests/${r.id}`)}
                className="bg-tg-secondaryBg rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 space-y-2.5 shadow-sm cursor-pointer hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      {r.service.nameUz}
                    </span>
                    <span className="text-tg-hint">📍 {r.district.nameUz}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === 'OPEN'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : r.status === 'ASSIGNED'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : r.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : r.status === 'DONE'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold">{r.title}</h3>

                <div className="text-xs text-tg-hint space-y-1">
                  <div>
                    Mijoz: {r.customer.firstName} {r.customer.lastName || ''} ({r.customer.phone || 'Raqam yo‘q'})
                  </div>
                  {r.addressDetail && <div>Manzil: {r.addressDetail}</div>}
                  {r.selectedOffer && (
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Usta: {r.selectedOffer.masterName} ({r.selectedOffer.price.toLocaleString()} so‘m)
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center text-[11px] text-tg-hint pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span>Takliflar: {r.offersCount} ta</span>
                  <span>
                    {new Date(r.createdAt).toLocaleDateString('uz-UZ', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}

          {/* Pagination */}
          {requestsTotal > 15 && (
            <div className="flex justify-between items-center pt-2 text-xs">
              <button
                type="button"
                disabled={requestsPage <= 1}
                onClick={() => fetchRequests(requestsPage - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40"
              >
                ← Oldingi
              </button>
              <span className="text-tg-hint">
                Sahifa {requestsPage} / {Math.ceil(requestsTotal / 15)}
              </span>
              <button
                type="button"
                disabled={requestsPage * 15 >= requestsTotal}
                onClick={() => fetchRequests(requestsPage + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40"
              >
                Keyingi →
              </button>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: STATISTIKA */}
      {activeTab === 'stats' && (
        <section className="space-y-3">
          {statsLoading && (
            <div className="py-12 text-center text-tg-hint text-xs">
              Statistika hisoblanmoqda...
            </div>
          )}

          {!statsLoading && stats && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-tg-secondaryBg rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <div className="text-xs text-tg-hint">Jami so‘rovlar</div>
                  <div className="text-2xl font-black mt-1 text-blue-600 dark:text-blue-400">
                    {stats.requests.total}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    +{stats.requests.today} ta bugun
                  </div>
                </div>

                <div className="bg-tg-secondaryBg rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <div className="text-xs text-tg-hint">Jami takliflar</div>
                  <div className="text-2xl font-black mt-1 text-indigo-600 dark:text-indigo-400">
                    {stats.offers.total}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    +{stats.offers.today} ta bugun
                  </div>
                </div>

                <div className="bg-tg-secondaryBg rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <div className="text-xs text-tg-hint">Tanlangan ishlar</div>
                  <div className="text-2xl font-black mt-1 text-amber-500">
                    {stats.assigned.total}
                  </div>
                  <div className="text-[11px] text-tg-hint mt-0.5">
                    +{stats.assigned.today} ta bugun
                  </div>
                </div>

                <div className="bg-tg-secondaryBg rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <div className="text-xs text-tg-hint">Tugatilgan ishlar</div>
                  <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                    {stats.completed.total}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    +{stats.completed.today} ta bugun
                  </div>
                </div>
              </div>

              {/* Qo'shimcha ko'rsatkichlar */}
              <div className="bg-tg-secondaryBg rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 space-y-2.5 shadow-sm text-xs">
                <h3 className="font-bold text-sm">Foydalanuvchilar va Ustalar</h3>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-tg-hint">Faol tasdiqlangan ustalar:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {stats.activeMasters} nafar
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-tg-hint">Kutayotgan arizalar (PENDING):</span>
                  <span className="font-extrabold text-amber-500">
                    {stats.pendingMasters} ta
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-tg-hint">Jami ro‘yxatdan o‘tgan foydalanuvchilar:</span>
                  <span className="font-extrabold">{stats.totalUsers} nafar</span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* RAD ETISH MODALI */}
      {rejectModalMaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-tg-secondaryBg rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="text-center space-y-2">
              <div className="text-3xl">⚠️</div>
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
                Arizani rad etish
              </h3>
              <p className="text-xs text-tg-hint">
                <strong>{rejectModalMaster.user.firstName}</strong> ustaga arizasi rad etilgani va
                sababi haqida botdan xabar yuboriladi.
              </p>
            </div>

            <div>
              <label htmlFor="reject-reason" className="block text-xs font-semibold mb-1">
                Rad etish sababi <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Masalan: Ma’lumotlar to‘liq emas yoki rasm noaniq..."
                maxLength={300}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-bg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                required
              />
              <div className="text-[11px] text-tg-hint mt-0.5">Kamida 5 ta belgi</div>
            </div>

            {rejectError && (
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs">
                {rejectError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalMaster(null)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition"
              >
                Rad etish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOKLASH MODALI */}
      {blockModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-tg-secondaryBg rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="text-center space-y-2">
              <div className="text-3xl">🚫</div>
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
                Foydalanuvchini bloklash
              </h3>
              <p className="text-xs text-tg-hint">
                <strong>{blockModalUser.name}</strong> hisobi bloklanadi va u ilovadan foydalana
                olmaydi.
              </p>
            </div>

            <div>
              <label htmlFor="block-reason" className="block text-xs font-semibold mb-1">
                Bloklash sababi <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="block-reason"
                rows={3}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Masalan: Qoidabuzarlik yoki soxta ma’lumot..."
                maxLength={300}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-bg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                required
              />
              <div className="text-[11px] text-tg-hint mt-0.5">Kamida 5 ta belgi</div>
            </div>

            {blockError && (
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs">
                {blockError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBlockModalUser(null)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Ortga
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition"
              >
                Bloklash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
