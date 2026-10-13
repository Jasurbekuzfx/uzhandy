import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, RequestItem, OfferItem } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getTelegramWebApp } from '../lib/telegram';

type OfferSortOption = 'cheapest' | 'expensive' | 'newest';

export const RequestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [requestItem, setRequestItem] = useState<RequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rasmni kattalashtirib ko'rish modali
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Bekor qilish modali va holati
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Ustani tanlash modali va holati (Mijoz uchun)
  const [selectedOfferToConfirm, setSelectedOfferToConfirm] = useState<OfferItem | null>(null);
  const [selectingOffer, setSelectingOffer] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [offerSort, setOfferSort] = useState<OfferSortOption>('cheapest');

  // Ish jarayoni holatlari
  const [startingWork, setStartingWork] = useState(false);
  const [startWorkError, setStartWorkError] = useState<string | null>(null);

  const [completingWork, setCompletingWork] = useState(false);
  const [completeWorkError, setCompleteWorkError] = useState<string | null>(null);

  // Baholash (Review) holatlari
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Taklif berish formasi holatlari (Usta uchun)
  const [offerPrice, setOfferPrice] = useState<string>('');
  const [offerMessage, setOfferMessage] = useState<string>('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerFormError, setOfferFormError] = useState<string | null>(null);

  // Taklifni qaytarib olish holati (Usta uchun)
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchRequest = () => {
    if (!id) return;
    setLoading(true);
    api
      .getRequestById(id)
      .then((res) => {
        setRequestItem(res.request);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'So‘rovni yuklab bo‘lmadi';
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRequest();
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

  const isOwner = Boolean(requestItem?.addressDetail && !requestItem?.customer);
  const isSelectedMaster = Boolean(requestItem?.customer);
  const isApprovedMaster = user?.masterProfile?.status === 'APPROVED';

  // Saralangan takliflar
  const sortedOffers = useMemo(() => {
    if (!requestItem?.offers) return [];
    const list = [...requestItem.offers];
    if (offerSort === 'cheapest') {
      list.sort((a, b) => a.price - b.price);
    } else if (offerSort === 'expensive') {
      list.sort((a, b) => b.price - a.price);
    } else if (offerSort === 'newest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [requestItem?.offers, offerSort]);

  // So'rovni bekor qilish (Mijoz)
  const handleCancelRequest = async () => {
    if (!id || !requestItem) return;
    setCancelError(null);

    if (requestItem.status === 'ASSIGNED' && cancelReason.trim().length < 5) {
      setCancelError('Bekor qilish sababini yozing (kamida 5 ta belgi)');
      return;
    }

    setCancelling(true);

    try {
      const res = await api.cancelRequest(id, cancelReason.trim() || undefined);
      if (res.ok) {
        setRequestItem((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
        setCancelModalOpen(false);
        setCancelReason('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'So‘rovni bekor qilishda xatolik yuz berdi';
      setCancelError(msg);
    } finally {
      setCancelling(false);
    }
  };

  // Ishni boshlash (Tanlangan Usta)
  const handleStartWork = async () => {
    if (!id) return;
    setStartWorkError(null);
    setStartingWork(true);
    try {
      const res = await api.startWork(id);
      if (res.ok) {
        setRequestItem((prev) => (prev ? { ...prev, status: 'IN_PROGRESS' } : null));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ishni boshlashda xatolik yuz berdi';
      setStartWorkError(msg);
    } finally {
      setStartingWork(false);
    }
  };

  // Ishni yakunlash (Mijoz)
  const handleCompleteWork = async () => {
    if (!id) return;
    setCompleteWorkError(null);
    setCompletingWork(true);
    try {
      const res = await api.completeWork(id);
      if (res.ok) {
        setRequestItem((prev) => (prev ? { ...prev, status: 'DONE' } : null));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ishni yakunlashda xatolik yuz berdi';
      setCompleteWorkError(msg);
    } finally {
      setCompletingWork(false);
    }
  };

  // Baho berish (Mijoz)
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setReviewError(null);
    setSubmittingReview(true);
    try {
      const res = await api.submitReview(id, {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      if (res.ok) {
        setReviewSubmitted(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Baholashda xatolik yuz berdi';
      setReviewError(msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Ustani tanlash (Mijoz)
  const handleConfirmSelectOffer = async () => {
    if (!id || !selectedOfferToConfirm) return;
    setSelectError(null);
    setSelectingOffer(true);

    try {
      const res = await api.selectOffer(id, selectedOfferToConfirm.id);
      if (res.ok) {
        setSelectedOfferToConfirm(null);
        fetchRequest();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ustani tanlashda xatolik yuz berdi';
      setSelectError(msg);
    } finally {
      setSelectingOffer(false);
    }
  };

  // Taklif berish (Usta)
  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setOfferFormError(null);

    const priceNum = Number(offerPrice);
    if (isNaN(priceNum) || priceNum < 50000 || priceNum > 50000000) {
      setOfferFormError('Narx 50 000 dan 50 000 000 so‘mgacha bo‘lishi kerak');
      return;
    }

    if (offerMessage.trim().length < 10) {
      setOfferFormError('Taklif izohi kamida 10 ta belgidan iborat bo‘lishi kerak');
      return;
    }

    if (offerMessage.trim().length > 500) {
      setOfferFormError('Taklif izohi 500 ta belgidan oshmasligi kerak');
      return;
    }

    setSubmittingOffer(true);
    try {
      await api.createOffer(id, {
        price: priceNum,
        message: offerMessage.trim(),
      });
      setOfferPrice('');
      setOfferMessage('');
      fetchRequest();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Taklif yuborishda xatolik yuz berdi';
      setOfferFormError(msg);
    } finally {
      setSubmittingOffer(false);
    }
  };

  // Taklifni qaytarib olish (Usta)
  const handleWithdrawOffer = async (offerId: string) => {
    setWithdrawing(true);
    try {
      await api.withdrawOffer(offerId);
      fetchRequest();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Taklifni qaytarib olishda xatolik');
    } finally {
      setWithdrawing(false);
    }
  };

  const formatPreferredTime = (time?: RequestItem['preferredTime']) => {
    switch (time) {
      case 'ASAP':
        return '⚡ Zudlik bilan (Tezda)';
      case 'TODAY':
        return '📅 Bugun';
      case 'THIS_WEEK':
        return '🗓️ Shu hafta ichida';
      case 'FLEXIBLE':
        return '🤝 Kelishilgan holda';
      default:
        return 'Belgilanmagan';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tg-bg text-tg-text">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !requestItem) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-tg-bg text-tg-text">
        <div className="max-w-md w-full bg-tg-secondaryBg rounded-2xl p-6 text-center space-y-4 border border-rose-200 dark:border-rose-900/40">
          <div className="text-3xl">🔍</div>
          <h2 className="text-base font-bold text-rose-600 dark:text-rose-400">
            {error || 'So‘rov topilmadi'}
          </h2>
          <p className="text-xs text-tg-hint">
            Ushbu so‘rov mavjud emas yoki sizda uni ko‘rish huquqi yo‘q.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition"
          >
            Bosh sahifaga qaytish
          </button>
        </div>
      </div>
    );
  }

  // Timeline bosqichlari
  const timelineSteps = [
    { key: 'OPEN', label: 'E‘lon berildi', icon: '📝' },
    { key: 'ASSIGNED', label: 'Usta tanlandi', icon: '🤝' },
    { key: 'IN_PROGRESS', label: 'Jarayonda', icon: '⚙️' },
    { key: 'DONE', label: 'Bajarildi', icon: '✅' },
  ];

  const getStepIndex = (status: RequestItem['status']) => {
    switch (status) {
      case 'OPEN':
        return 0;
      case 'ASSIGNED':
        return 1;
      case 'IN_PROGRESS':
        return 2;
      case 'DONE':
        return 3;
      default:
        return -1;
    }
  };

  const currentStepIdx = getStepIndex(requestItem.status);

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text p-4 max-w-lg mx-auto space-y-4 pb-20">
      {/* Yuqori nav */}
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-xs text-tg-link hover:underline inline-flex items-center gap-1 font-semibold"
        >
          ← Ortga
        </button>
        <span className="text-xs text-tg-hint">
          {new Date(requestItem.createdAt).toLocaleDateString('uz-UZ', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </header>

      {/* STATUS TIMELINE STEPPER */}
      {requestItem.status === 'CANCELLED' ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-3.5 flex items-center gap-3 text-rose-700 dark:text-rose-300">
          <span className="text-2xl">🚫</span>
          <div>
            <div className="text-xs font-bold">So‘rov bekor qilingan</div>
            <div className="text-[11px] text-tg-hint">
              Ushbu so‘rov bo‘yicha ishlar to‘xtatilgan
            </div>
          </div>
        </div>
      ) : (
        <section className="bg-tg-secondaryBg rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
          <div className="flex items-center justify-between relative">
            {/* Chiziq */}
            <div className="absolute top-3.5 left-4 right-4 h-0.5 bg-slate-200 dark:bg-slate-700 -z-0" />
            <div
              className="absolute top-3.5 left-4 h-0.5 bg-emerald-500 transition-all duration-300 -z-0"
              style={{
                width: `${Math.min(100, Math.max(0, (currentStepIdx / (timelineSteps.length - 1)) * 90))}%`,
              }}
            />

            {timelineSteps.map((step, idx) => {
              const isPassed = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;

              return (
                <div key={step.key} className="flex flex-col items-center z-10 flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                      isPassed
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/50'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isPassed ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${
                      isCurrent
                        ? 'text-blue-600 dark:text-blue-400 font-bold'
                        : isPassed
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-tg-hint'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Asosiy ma'lumotlar kartasi */}
      <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 space-y-4 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {requestItem.service.nameUz}
            </span>
            <span className="text-xs text-tg-hint">{requestItem.district.nameUz}</span>
          </div>
          <h1 className="text-lg font-bold leading-snug">{requestItem.title}</h1>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-tg-hint uppercase tracking-wider">
            Batafsil tavsif:
          </span>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{requestItem.description}</p>
        </div>

        {/* Rasmlar galereyasi */}
        {requestItem.photos && requestItem.photos.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-tg-hint uppercase tracking-wider">
              Rasmlar ({requestItem.photos.length}):
            </span>
            <div className="grid grid-cols-3 gap-2">
              {requestItem.photos.map((photo, i) => (
                <div
                  key={photo.id}
                  onClick={() => setPreviewPhotoUrl(photo.signedUrl || null)}
                  className="aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer hover:opacity-90 transition"
                >
                  {photo.signedUrl ? (
                    <img
                      src={photo.signedUrl}
                      alt={`Rasm ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-tg-hint">
                      Rasm
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tafsilotlar: Manzil, Vaqt, Byudjet */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
          {requestItem.addressDetail && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <span>🔒</span>
                <span>Aniq manzil:</span>
              </div>
              <p className="text-sm font-medium">{requestItem.addressDetail}</p>
            </div>
          )}

          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
            <span className="text-tg-hint">Kutilayotgan vaqt:</span>
            <span className="font-semibold">{formatPreferredTime(requestItem.preferredTime)}</span>
          </div>

          <div className="flex justify-between py-1">
            <span className="text-tg-hint">Mo‘ljaldagi byudjet:</span>
            <span className="font-semibold">
              {requestItem.budgetMin || requestItem.budgetMax ? (
                <>
                  {requestItem.budgetMin ? `${requestItem.budgetMin.toLocaleString()} so‘m` : '0'}
                  {' - '}
                  {requestItem.budgetMax
                    ? `${requestItem.budgetMax.toLocaleString()} so‘m`
                    : 'cheksiz'}
                </>
              ) : (
                'Kelishilgan holda'
              )}
            </span>
          </div>
        </div>
      </section>

      {/* TANLANGAN USTA KARTASI (Mijoz uchun - ASSIGNED, IN_PROGRESS yoki DONE bo'lganda) */}
      {isOwner &&
        (requestItem.status === 'ASSIGNED' ||
          requestItem.status === 'IN_PROGRESS' ||
          requestItem.status === 'DONE') &&
        requestItem.selectedOffer && (
          <section className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl p-5 border border-emerald-300 dark:border-emerald-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                ✓ Biriktirilgan usta
              </span>
              <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                {requestItem.selectedOffer.price.toLocaleString()} so‘m
              </span>
            </div>

            {/* Ustaning profiliga havola */}
            <div
              onClick={() => navigate(`/masters/${requestItem.selectedOffer!.master.id}`)}
              className="flex items-center gap-3 pt-1 cursor-pointer hover:opacity-90 transition group"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm group-hover:ring-2 ring-emerald-400">
                {requestItem.selectedOffer.master.user.firstName[0]}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold flex items-center gap-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                  <span>
                    {requestItem.selectedOffer.master.user.firstName}{' '}
                    {requestItem.selectedOffer.master.user.lastName || ''}
                  </span>
                  <span className="text-xs opacity-60">↗</span>
                </h3>
                <p className="text-xs text-tg-hint">
                  Tajriba: {requestItem.selectedOffer.master.experienceYears} yil • Reyting: ⭐{' '}
                  {Number(requestItem.selectedOffer.master.ratingAvg).toFixed(1)} (
                  {requestItem.selectedOffer.master.ratingCount} ta)
                </p>
              </div>
            </div>

            {requestItem.selectedOffer.master.user.phone && (
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row gap-2">
                <a
                  href={`tel:${requestItem.selectedOffer.master.user.phone}`}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold text-center shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <span>📞 Qo‘ng‘iroq qilish</span>
                  <span>({requestItem.selectedOffer.master.user.phone})</span>
                </a>

                {requestItem.selectedOffer.master.user.username && (
                  <a
                    href={`https://t.me/${requestItem.selectedOffer.master.user.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-xs font-semibold text-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition flex items-center justify-center gap-1"
                  >
                    <span>💬 Telegram</span>
                  </a>
                )}
              </div>
            )}

            {/* Mijoz uchun: IN_PROGRESS bo'lsa "Ish bajarildi" tugmasi */}
            {requestItem.status === 'IN_PROGRESS' && (
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-900/60 space-y-2">
                {completeWorkError && (
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs">
                    {completeWorkError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCompleteWork}
                  disabled={completingWork}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-1.5"
                >
                  {completingWork ? (
                    'Tasdiqlanmoqda...'
                  ) : (
                    <>
                      <span>Ish bajarildi va qabul qilindi</span>
                      <span>✅</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        )}

      {/* MIJOZ UCHUN BAHOLASH FORMASI (DONE bo'lganda) */}
      {isOwner && requestItem.status === 'DONE' && (
        <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-purple-200 dark:border-purple-900/60 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
              <span>⭐</span>
              <span>Ustaga baho bering</span>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold">
              Yakunlangan
            </span>
          </div>

          {reviewSubmitted ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-center space-y-1">
              <div className="text-2xl">🎉</div>
              <div className="text-xs font-bold">Fikringiz va bahoyingiz qabul qilindi!</div>
              <p className="text-[11px] text-tg-hint">
                Ushbu baho usta reytingini oshirishga va boshqa mijozlarga to‘g‘ri tanlov qilishga
                yordam beradi.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <p className="text-xs text-tg-hint">
                Usta ishidan mamnun bo‘ldingizmi? Fikringizni qoldiring:
              </p>

              {/* 5 yulduzli baholash selectori */}
              <div className="flex items-center justify-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="text-3xl transition transform hover:scale-125 active:scale-95 focus:outline-none"
                  >
                    {star <= reviewRating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>

              <div className="text-center text-xs font-bold text-amber-500">
                {reviewRating === 5 && 'A’lo darajada! 😍'}
                {reviewRating === 4 && 'Yaxshi ishlandi! 👍'}
                {reviewRating === 3 && 'Qoniqarli 🙂'}
                {reviewRating === 2 && 'Kamchiliklar bor 😕'}
                {reviewRating === 1 && 'Yoqmadi 😞'}
              </div>

              {reviewError && (
                <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs">
                  {reviewError}
                </div>
              )}

              <div>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Usta haqida izoh yozing (ixtiyoriy)..."
                  maxLength={500}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-bg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
                <div className="text-right text-[11px] text-tg-hint">
                  {reviewComment.length}/500
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                {submittingReview ? 'Yuborilmoqda...' : 'Bahoni yuborish ⭐'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* TANLANGAN USTA UCHUN MIJOZ KONTAKTLARI VA ISHNI BOSHLASH TUGMASI (Usta uchun) */}
      {isSelectedMaster && requestItem.customer && (
        <section className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl p-5 border border-emerald-300 dark:border-emerald-800 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
              {requestItem.status === 'ASSIGNED' && '🎉 Siz tanlandingiz!'}
              {requestItem.status === 'IN_PROGRESS' && '⚙️ Ish jarayonda'}
              {requestItem.status === 'DONE' && '✅ Ish yakunlandi'}
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold">
              Mijoz: {requestItem.customer.firstName} {requestItem.customer.lastName || ''}
            </h3>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Telefon: {requestItem.customer.phone}
            </p>
            {requestItem.addressDetail && (
              <p className="text-xs text-tg-hint">Manzil: {requestItem.addressDetail}</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <a
              href={`tel:${requestItem.customer.phone}`}
              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold text-center shadow-sm transition"
            >
              📞 Qo‘ng‘iroq qilish
            </a>
            {requestItem.customer.username && (
              <a
                href={`https://t.me/${requestItem.customer.username}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-4 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-xs font-semibold text-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
              >
                💬 Telegram
              </a>
            )}
          </div>

          {/* Usta uchun: ASSIGNED holatida "Ishni boshlash" tugmasi */}
          {requestItem.status === 'ASSIGNED' && (
            <div className="pt-2 border-t border-emerald-200 dark:border-emerald-900/60 space-y-2">
              {startWorkError && (
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs">
                  {startWorkError}
                </div>
              )}
              <button
                type="button"
                onClick={handleStartWork}
                disabled={startingWork}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                {startingWork ? (
                  'Boshlanmoqda...'
                ) : (
                  <>
                    <span>Ishni boshlash</span>
                    <span>🚀</span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      )}

      {/* USTANING O'Z TAKLIFI KO'RINISHI (Usta uchun - agar tanlangan usta bo'lmasa) */}
      {!isSelectedMaster && requestItem.myOffer && (
        <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Sizning taklifingiz</h2>
            {requestItem.myOffer.status === 'PENDING' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                ⏳ Kutilmoqda
              </span>
            )}
            {requestItem.myOffer.status === 'ACCEPTED' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                ✅ Qabul qilindi
              </span>
            )}
            {requestItem.myOffer.status === 'REJECTED' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                ✕ Rad etildi
              </span>
            )}
            {requestItem.myOffer.status === 'WITHDRAWN' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                ↩️ Qaytarib olingan
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-tg-hint">Narx:</span>
              <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                {requestItem.myOffer.price.toLocaleString()} so‘m
              </span>
            </div>
            <p className="text-xs text-tg-text pt-1">💬 {requestItem.myOffer.message}</p>
          </div>

          {requestItem.myOffer.status === 'PENDING' && requestItem.status === 'OPEN' && (
            <button
              type="button"
              onClick={() => handleWithdrawOffer(requestItem.myOffer!.id)}
              disabled={withdrawing}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition disabled:opacity-50"
            >
              {withdrawing ? 'Qaytarib olinmoqda...' : 'Taklifni qaytarib olish'}
            </button>
          )}
        </section>
      )}

      {/* TAKLIF BERISH FORMASI (Usta uchun - agar hali taklif bermagan bo'lsa va so'rov OPEN bo'lsa) */}
      {!isOwner && isApprovedMaster && !requestItem.myOffer && requestItem.status === 'OPEN' && (
        <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-blue-200 dark:border-blue-900/60 space-y-4 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-blue-600 dark:text-blue-400">
              Ushbu ishga taklif berish
            </h2>
            <p className="text-xs text-tg-hint">
              Mijozga o‘z narxingiz va ish shartlaringizni taklif qiling
            </p>
          </div>

          {offerFormError && (
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs">
              {offerFormError}
            </div>
          )}

          <form onSubmit={handleCreateOffer} className="space-y-3">
            <div>
              <label htmlFor="offer-price" className="block text-xs font-semibold mb-1">
                Taklif narxi (so‘mda) <span className="text-rose-500">*</span>
              </label>
              <input
                id="offer-price"
                type="number"
                min={50000}
                max={50000000}
                step={5000}
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                placeholder="Masalan: 120000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-[11px] text-tg-hint">50 000 dan 50 000 000 so‘mgacha</span>
            </div>

            <div>
              <label htmlFor="offer-msg" className="block text-xs font-semibold mb-1">
                Taklif izohi <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="offer-msg"
                rows={3}
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                placeholder="Ishni qachon boshlay olasiz, qanday materiallar kerak yoki tajribangiz haqida yozing..."
                maxLength={500}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                required
              />
              <div className="flex justify-between text-[11px] text-tg-hint mt-0.5">
                <span>Kamida 10 ta belgi</span>
                <span>{offerMessage.length}/500</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingOffer}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition active:scale-[0.99] flex items-center justify-center gap-1.5"
            >
              {submittingOffer ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Yuborilmoqda...</span>
                </>
              ) : (
                <span>Taklifni yuborish 📨</span>
              )}
            </button>
          </form>
        </section>
      )}

      {/* MIJOZ UCHUN TAKLIFLAR RO'YXATI (Faqat OPEN bo'lganda) */}
      {isOwner && requestItem.status === 'OPEN' && (
        <section className="bg-tg-secondaryBg rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Ustalar takliflari</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {requestItem.offers ? `${requestItem.offers.length} ta` : '0 ta'}
            </span>
          </div>

          {/* Saralash tugmalari */}
          {sortedOffers.length > 1 && (
            <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs">
              <button
                type="button"
                onClick={() => setOfferSort('cheapest')}
                className={`flex-1 py-1 px-2 rounded-lg font-medium transition ${
                  offerSort === 'cheapest'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-tg-hint hover:text-tg-text'
                }`}
              >
                Arzonroq
              </button>
              <button
                type="button"
                onClick={() => setOfferSort('expensive')}
                className={`flex-1 py-1 px-2 rounded-lg font-medium transition ${
                  offerSort === 'expensive'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-tg-hint hover:text-tg-text'
                }`}
              >
                Qimmatroq
              </button>
              <button
                type="button"
                onClick={() => setOfferSort('newest')}
                className={`flex-1 py-1 px-2 rounded-lg font-medium transition ${
                  offerSort === 'newest'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-tg-hint hover:text-tg-text'
                }`}
              >
                Eng yangi
              </button>
            </div>
          )}

          {sortedOffers.length === 0 && (
            <div className="py-6 text-center space-y-2 text-tg-hint">
              <div className="text-2xl">⏳</div>
              <p className="text-xs">
                Hozircha ustalar tomonidan taklif berilmagan. Ular xabardor qilinmoqda...
              </p>
            </div>
          )}

          {sortedOffers.length > 0 && (
            <div className="space-y-3">
              {sortedOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-tg-bg hover:border-slate-300 transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => navigate(`/masters/${offer.master.id}`)}
                      className="flex items-center gap-2.5 cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm group-hover:ring-2 ring-blue-400">
                        {offer.master.user.firstName[0]}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold flex items-center gap-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          <span>
                            {offer.master.user.firstName} {offer.master.user.lastName || ''}
                          </span>
                          <span className="text-[10px] opacity-60">↗</span>
                        </h3>
                        <p className="text-[11px] text-tg-hint">
                          Tajriba: {offer.master.experienceYears} yil • ⭐{' '}
                          {Number(offer.master.ratingAvg).toFixed(1)} ({offer.master.ratingCount}{' '}
                          baho)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                        {offer.price.toLocaleString()} so‘m
                      </span>
                    </div>
                  </div>

                  {offer.message && (
                    <p className="text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg text-tg-text">
                      💬 {offer.message}
                    </p>
                  )}

                  {offer.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => setSelectedOfferToConfirm(offer)}
                      className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition active:scale-[0.99] flex items-center justify-center gap-1"
                    >
                      <span>Shu ustani tanlash</span>
                      <span>✓</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Bekor qilish tugmasi (Mijoz uchun: OPEN yoki ASSIGNED bo'lganda) */}
      {isOwner && (requestItem.status === 'OPEN' || requestItem.status === 'ASSIGNED') && (
        <section className="pt-2">
          <button
            type="button"
            onClick={() => {
              setCancelReason('');
              setCancelError(null);
              setCancelModalOpen(true);
            }}
            className="w-full py-3 px-4 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/40 transition active:scale-[0.99]"
          >
            So‘rovni bekor qilish
          </button>
        </section>
      )}

      {/* Ustani tanlashni tasdiqlash modali (Mijoz uchun) */}
      {selectedOfferToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-tg-secondaryBg rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="text-center space-y-2">
              <div className="text-3xl">🤝</div>
              <h3 className="text-base font-bold">Ustani tanlaysizmi?</h3>
              <p className="text-xs text-tg-hint">
                <strong className="text-tg-text">
                  {selectedOfferToConfirm.master.user.firstName}{' '}
                  {selectedOfferToConfirm.master.user.lastName || ''}
                </strong>{' '}
                ustani tanlashni tasdiqlaysizmi?
              </p>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-extrabold text-sm">
                Taklif narxi: {selectedOfferToConfirm.price.toLocaleString()} so‘m
              </div>
              <p className="text-[11px] text-tg-hint">
                Tanlaganingizdan so‘ng, ustaga sizning aniq manzilingiz va telefon raqamingiz
                ko‘rinadi.
              </p>
            </div>

            {selectError && (
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs">
                {selectError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedOfferToConfirm(null)}
                disabled={selectingOffer}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Ortga
              </button>
              <button
                type="button"
                onClick={handleConfirmSelectOffer}
                disabled={selectingOffer}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                {selectingOffer ? 'Tanlanmoqda...' : 'Ha, tanlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bekor qilishni tasdiqlash modali */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-tg-secondaryBg rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="text-center space-y-2">
              <div className="text-3xl">⚠️</div>
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
                So‘rovni bekor qilmoqchimisiz?
              </h3>
              <p className="text-xs text-tg-hint">
                {requestItem.status === 'ASSIGNED'
                  ? 'Usta tanlangan so‘rovni bekor qilish uchun sababini ko‘rsatishingiz shart. Bu usta botiga yuboriladi.'
                  : 'Bekor qilingan so‘rovga ustalar boshqa taklif bera olmaydi.'}
              </p>
            </div>

            {requestItem.status === 'ASSIGNED' && (
              <div>
                <label
                  htmlFor="cancel-reason"
                  className="block text-xs font-semibold mb-1 text-tg-text"
                >
                  Bekor qilish sababi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="cancel-reason"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Masalan: Rejalar o‘zgardi yoki boshqa muammo bo‘ldi..."
                  maxLength={300}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-bg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  required
                />
                <div className="text-[11px] text-tg-hint mt-0.5">Kamida 5 ta belgi</div>
              </div>
            )}

            {cancelError && (
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs">
                {cancelError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelling}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Ortga
              </button>
              <button
                type="button"
                onClick={handleCancelRequest}
                disabled={cancelling}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                {cancelling ? 'Bekor qilinmoqda...' : 'Ha, bekor qilish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rasm to'liq ekranda ko'rish modali */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 cursor-pointer"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={previewPhotoUrl}
              alt="Kattalashtirilgan rasm"
              className="max-h-[85vh] max-w-[95vw] rounded-xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
