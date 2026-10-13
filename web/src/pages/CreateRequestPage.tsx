import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ServiceItem, DistrictItem, PreferredTime } from '../lib/api';
import { uploadCompressedPhoto } from '../lib/image';
import { getTelegramWebApp } from '../lib/telegram';
import { PhoneRequiredModal } from '../components/PhoneRequiredModal';

interface UploadedPhoto {
  path: string;
  previewUrl: string;
}

export const CreateRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // 1-qadam: Xizmat turi
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  // 2-qadam: Sarlavha, tavsif, rasmlar
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // 3-qadam: Tuman, manzil, vaqt, byudjet
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [addressDetail, setAddressDetail] = useState('');
  const [preferredTime, setPreferredTime] = useState<PreferredTime>('ASAP');
  const [budgetMin, setBudgetMin] = useState<string>('');
  const [budgetMax, setBudgetMax] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  // Xizmatlar va tumanlarni yuklash
  useEffect(() => {
    Promise.all([api.getServices(), api.getDistricts()])
      .then(([sRes, dRes]) => {
        setServices(sRes.services.filter((s) => s.isActive));
        setDistricts(dRes.districts);
      })
      .catch((err) => {
        console.error('Xizmat va tumanlarni yuklashda xatolik:', err);
      })
      .finally(() => {
        setLoadingInitial(false);
      });
  }, []);

  // Telefon raqami tekshiruvi
  useEffect(() => {
    if (user && !user.phone) {
      setPhoneModalOpen(true);
    }
  }, [user]);

  // Telegram BackButton va MainButton integratsiyasi
  useEffect(() => {
    const tg = getTelegramWebApp();
    const backBtn = tg?.BackButton;
    if (!backBtn) return undefined;

    const handleBack = () => {
      if (step > 1) {
        setStep((prev) => (prev - 1) as 1 | 2);
        setErrorMessage(null);
      } else {
        navigate('/');
      }
    };

    backBtn.show();
    backBtn.onClick(handleBack);

    return () => {
      backBtn.offClick(handleBack);
      backBtn.hide();
    };
  }, [step, navigate]);

  // Rasmlarni yuklash
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedPhotos.length + files.length > 5) {
      setErrorMessage('Ko‘pi bilan 5 ta rasm yuklash mumkin');
      return;
    }

    setErrorMessage(null);
    setUploadingImage(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (!file) continue;
        const previewUrl = URL.createObjectURL(file);
        const { path } = await uploadCompressedPhoto(file);
        setUploadedPhotos((prev) => [...prev, { path, previewUrl }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rasm yuklashda xatolik yuz berdi';
      setErrorMessage(msg);
    } finally {
      setUploadingImage(false);
      // Input qiymatini tozalash
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setUploadedPhotos((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        updated.splice(index, 1);
      }
      return updated;
    });
  };


  // Qadamlar orasida o'tish tekshiruvlari
  const handleNextStep = () => {
    setErrorMessage(null);

    if (step === 1) {
      if (!selectedServiceId) {
        setErrorMessage('Iltimos, xizmat turini tanlang');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (title.trim().length < 5) {
        setErrorMessage('Sarlavha kamida 5 ta belgidan iborat bo‘lishi kerak');
        return;
      }
      if (title.trim().length > 80) {
        setErrorMessage('Sarlavha ko‘pi bilan 80 ta belgidan oshmasligi kerak');
        return;
      }
      if (description.trim().length < 20) {
        setErrorMessage('Tavsif kamida 20 ta belgidan iborat bo‘lishi kerak');
        return;
      }
      if (description.trim().length > 1000) {
        setErrorMessage('Tavsif ko‘pi bilan 1000 ta belgidan oshmasligi kerak');
        return;
      }
      setStep(3);
      return;
    }
  };

  // Formani yuborish (3-qadam)
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!user?.phone) {
      setPhoneModalOpen(true);
      return;
    }

    if (!selectedDistrictId) {
      setErrorMessage('Iltimos, tumanni tanlang');
      return;
    }

    if (addressDetail.trim().length < 5) {
      setErrorMessage('Aniq manzil kamida 5 ta belgidan iborat bo‘lishi kerak');
      return;
    }

    if (addressDetail.trim().length > 200) {
      setErrorMessage('Aniq manzil 200 ta belgidan oshmasligi kerak');
      return;
    }

    const minNum = budgetMin ? parseInt(budgetMin, 10) : undefined;
    const maxNum = budgetMax ? parseInt(budgetMax, 10) : undefined;

    if (minNum !== undefined && (isNaN(minNum) || minNum <= 0)) {
      setErrorMessage('Minimal byudjet to‘g‘ri musbat son bo‘lishi kerak');
      return;
    }

    if (maxNum !== undefined && (isNaN(maxNum) || maxNum <= 0)) {
      setErrorMessage('Maksimal byudjet to‘g‘ri musbat son bo‘lishi kerak');
      return;
    }

    if (minNum !== undefined && maxNum !== undefined && minNum > maxNum) {
      setErrorMessage('Minimal byudjet maksimal byudjetdan katta bo‘lishi mumkin emas');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createRequest({
        serviceId: selectedServiceId,
        districtId: selectedDistrictId,
        title: title.trim(),
        description: description.trim(),
        addressDetail: addressDetail.trim(),
        preferredTime,
        budgetMin: minNum,
        budgetMax: maxNum,
        photoPaths: uploadedPhotos.map((p) => p.path),
      });

      // Muvaffaqiyatli yaratildi -> So'rov sahifasiga yo'naltirish
      navigate(`/requests/${res.request.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'So‘rov yaratishda xatolik yuz berdi';
      setErrorMessage(msg);
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tg-bg text-tg-text">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text flex flex-col justify-between p-4 max-w-lg mx-auto">
      <div className="space-y-5">
        {/* Yuqori qism: Progress va Sarlavha */}
        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (step > 1) {
                  setStep((prev) => (prev - 1) as 1 | 2);
                  setErrorMessage(null);
                } else {
                  navigate('/');
                }
              }}
              className="text-sm text-tg-link hover:underline inline-flex items-center gap-1"
            >
              ← {step > 1 ? 'Oldingi qadam' : 'Bosh sahifa'}
            </button>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {step}-bosqich / 3
            </span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <div>
            <h1 className="text-xl font-bold">
              {step === 1 && 'Xizmat turini tanlang'}
              {step === 2 && 'Muammoni tasvirlang'}
              {step === 3 && 'Manzil va vaqt'}
            </h1>
            <p className="text-xs text-tg-hint mt-0.5">
              {step === 1 && 'Qanday usta yordami kerak?'}
              {step === 2 && 'Ustalar aniq tushunishi uchun batafsil yozing'}
              {step === 3 && 'Usta qachon va qayerga borishi kerak?'}
            </p>
          </div>
        </header>

        {/* Xatolik xabari */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1-QADAM: Xizmat turini tanlash */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5">
              {services.map((svc) => {
                const isSelected = selectedServiceId === svc.id;
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      setSelectedServiceId(svc.id);
                      setErrorMessage(null);
                    }}
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 font-semibold shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-tg-secondaryBg hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {svc.slug === 'santexnika' && '🔧'}
                        {svc.slug === 'elektrik' && '⚡'}
                        {svc.slug === 'maishiy-texnika' && '🧺'}
                        {!['santexnika', 'elektrik', 'maishiy-texnika'].includes(svc.slug) && '🛠️'}
                      </span>
                      <span>{svc.nameUz}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <span className="text-xs">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2-QADAM: Tavsif va rasmlar */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="req-title" className="block text-xs font-semibold mb-1">
                Sarlavha <span className="text-rose-500">*</span>
              </label>
              <input
                id="req-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: Krantdan suv oqmoqda yoki rozetka ishlamayapti"
                maxLength={80}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-secondaryBg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-between text-[11px] text-tg-hint mt-1">
                <span>Kamida 5 ta belgi</span>
                <span>{title.length}/80</span>
              </div>
            </div>

            <div>
              <label htmlFor="req-desc" className="block text-xs font-semibold mb-1">
                Batafsil tavsif <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="req-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Muammoni batafsil tasvirlang: nima bo‘ldi, qanday materiallar kerak bo‘lishi mumkin..."
                maxLength={1000}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-secondaryBg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex justify-between text-[11px] text-tg-hint mt-1">
                <span>Kamida 20 ta belgi</span>
                <span>{description.length}/1000</span>
              </div>
            </div>

            {/* Rasmlar yuklash qismi */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold">
                  Rasmlar biriktirish <span className="text-tg-hint font-normal">(ixtiyoriy, 0-5 ta)</span>
                </label>
                <span className="text-[11px] text-tg-hint">{uploadedPhotos.length}/5 ta</span>
              </div>

              {/* Yuklangan rasmlar ro'yxati */}
              <div className="grid grid-cols-3 gap-2.5 mb-2.5">
                {uploadedPhotos.map((p, idx) => (
                  <div
                    key={p.path}
                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 group"
                  >
                    <img
                      src={p.previewUrl}
                      alt={`Rasm ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-md hover:bg-rose-700 transition"
                      aria-label="Rasmni o'chirish"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Yangi rasm qo'shish tugmasi */}
                {uploadedPhotos.length < 5 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-tg-secondaryBg flex flex-col items-center justify-center cursor-pointer transition p-2 text-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handlePhotoUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                    {uploadingImage ? (
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-xl mb-0.5">📷</span>
                        <span className="text-[10px] text-tg-hint">Rasm qo‘shish</span>
                      </>
                    )}
                  </label>
                )}
              </div>
              <p className="text-[11px] text-tg-hint">
                Har bir rasm avtomatik ravishda 1600px gacha siqiladi (maks. 5 MB)
              </p>
            </div>
          </div>
        )}

        {/* 3-QADAM: Tuman, Aniq manzil, Vaqt, Byudjet */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="req-district" className="block text-xs font-semibold mb-1">
                Tuman <span className="text-rose-500">*</span>
              </label>
              <select
                id="req-district"
                value={selectedDistrictId}
                onChange={(e) => {
                  setSelectedDistrictId(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-secondaryBg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tumanni tanlang...</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameUz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="req-address" className="block text-xs font-semibold mb-1">
                Aniq manzil <span className="text-rose-500">*</span>
              </label>
              <input
                id="req-address"
                type="text"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="Masalan: Chilonzor 9-mavze, 12-uy, 45-xonadon"
                maxLength={200}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-secondaryBg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                <span>🔒</span>
                <span>Maxfiy: Aniq manzil faqat siz tanlagan ustaga ko‘rinadi</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">Kutilayotgan vaqt</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'ASAP', label: '⚡ Zudlik bilan' },
                    { value: 'TODAY', label: '📅 Bugun' },
                    { value: 'THIS_WEEK', label: '🗓️ Shu hafta' },
                    { value: 'FLEXIBLE', label: '🤝 Kelishilgan holda' },
                  ] as const
                ).map((t) => {
                  const isSel = preferredTime === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setPreferredTime(t.value)}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                        isSel
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-800 bg-tg-secondaryBg hover:border-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Mo‘ljaldagi byudjet (so‘mda, ixtiyoriy)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    min="1"
                    placeholder="Min (masalan: 50000)"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-secondaryBg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    min="1"
                    placeholder="Max (masalan: 150000)"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-tg-secondaryBg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pastki Harakat Tugmasi */}
      <footer className="pt-6">
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNextStep}
            className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <span>Davom etish</span>
            <span>→</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting || uploadingImage}
            className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Yuborilmoqda...</span>
              </>
            ) : (
              <>
                <span>So‘rovni yuborish</span>
                <span>✓</span>
              </>
            )}
          </button>
        )}
      </footer>

      <PhoneRequiredModal
        isOpen={phoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
      />
    </div>
  );
};
