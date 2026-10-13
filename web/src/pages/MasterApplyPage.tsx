import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ServiceItem, DistrictItem } from '../lib/api';
import { PhoneRequiredModal } from '../components/PhoneRequiredModal';

export const MasterApplyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refetchUser } = useAuth();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form maydonlari
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState<number>(3);
  const [bio, setBio] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [isReapplying, setIsReapplying] = useState(false);

  useEffect(() => {
    Promise.all([api.getServices(), api.getDistricts()])
      .then(([sRes, dRes]) => {
        setServices(sRes.services);
        setDistricts(dRes.districts);
      })
      .catch((err) => {
        console.error('Xizmat va tumanlarni yuklashda xatolik:', err);
      })
      .finally(() => {
        setLoadingInitial(false);
      });
  }, []);

  // Agar foydalanuvchida telefon raqami bo'lmasa, modalni ochish
  useEffect(() => {
    if (user && !user.phone) {
      setPhoneModalOpen(true);
    }
  }, [user]);

  const toggleService = (id: string) => {
    if (selectedServiceIds.includes(id)) {
      setSelectedServiceIds(selectedServiceIds.filter((sId) => sId !== id));
    } else {
      if (selectedServiceIds.length >= 3) {
        setFormError('Ko‘pi bilan 3 ta xizmat tanlash mumkin');
        return;
      }
      setFormError(null);
      setSelectedServiceIds([...selectedServiceIds, id]);
    }
  };

  const toggleDistrict = (id: string) => {
    if (selectedDistrictIds.includes(id)) {
      setSelectedDistrictIds(selectedDistrictIds.filter((dId) => dId !== id));
    } else {
      setFormError(null);
      setSelectedDistrictIds([...selectedDistrictIds, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user?.phone) {
      setPhoneModalOpen(true);
      return;
    }

    if (selectedServiceIds.length === 0) {
      setFormError('Iltimos, kamida 1 ta xizmat turini tanlang');
      return;
    }

    if (selectedDistrictIds.length === 0) {
      setFormError('Iltimos, kamida 1 ta xizmat ko‘rsatish tumanini tanlang');
      return;
    }

    if (bio.trim().length < 20) {
      setFormError('O‘zingiz haqingizda (Bio) kamida 20 ta belgi yozing');
      return;
    }

    if (bio.trim().length > 500) {
      setFormError('Bio 500 ta belgidan oshmasligi kerak');
      return;
    }

    try {
      setSubmitting(true);
      await api.applyMaster({
        bio: bio.trim(),
        experienceYears,
        serviceIds: selectedServiceIds,
        districtIds: selectedDistrictIds,
      });
      await refetchUser();
      setIsReapplying(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ariza yuborishda xatolik yuz berdi';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const masterProfile = user?.masterProfile;

  // Agar profil mavjud bo'lsa va qayta topshirish rejimida bo'lmasa -> Holat sahifasi ko'rsatiladi
  if (masterProfile && !isReapplying) {
    return (
      <div className="min-h-screen bg-tg-bg text-tg-text p-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-tg-secondaryBg border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md text-center space-y-5">
          {masterProfile.status === 'PENDING' && (
            <>
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                ⏳
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  Ko‘rib chiqilmoqda
                </span>
                <h2 className="text-xl font-bold">Arizangiz ko‘rib chiqilmoqda</h2>
                <p className="text-sm text-tg-hint leading-relaxed">
                  Adminlar arizangizni ko‘rib chiqmoqda. Tasdiqlangandan so‘ng yangi buyurtmalar
                  haqida Telegram botingizga xabar keladi.
                </p>
              </div>
            </>
          )}

          {masterProfile.status === 'APPROVED' && (
            <>
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                ✅
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Tasdiqlangan usta
                </span>
                <h2 className="text-xl font-bold">Arizangiz tasdiqlandi!</h2>
                <p className="text-sm text-tg-hint leading-relaxed">
                  Siz UstaTop platformasida tasdiqlangan ustasiz. Yangi so‘rovlar tushganda sizga
                  botdan bildirishnoma yuboriladi va taklif berishingiz mumkin bo‘ladi.
                </p>
              </div>
            </>
          )}

          {masterProfile.status === 'REJECTED' && (
            <>
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                ❌
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                  Rad etildi
                </span>
                <h2 className="text-xl font-bold">Arizangiz rad etildi</h2>
                <p className="text-sm text-rose-600 dark:text-rose-400">
                  Sabab: {masterProfile.rejectReason || 'Ko‘rsatilmagan'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReapplying(true)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition"
              >
                Qayta ariza yuborish
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-2.5 text-sm text-tg-hint hover:text-tg-text transition"
          >
            ← Bosh sahifaga qaytish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text p-4 pb-12">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center space-x-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-xl bg-tg-secondaryBg flex items-center justify-center text-lg active:opacity-70"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold">Men ustaman</h1>
            <p className="text-xs text-tg-hint">Usta sifatida ro‘yxatdan o‘tish anketasi</p>
          </div>
        </header>

        {loadingInitial ? (
          <div className="text-center py-12 text-sm text-tg-hint">Ma’lumotlar yuklanmoqda...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {formError}
              </div>
            )}

            {/* Xizmat turlari */}
            <div className="space-y-2.5">
              <label className="block text-sm font-semibold">
                Xizmat sohalari <span className="text-xs font-normal text-tg-hint">(1-3 ta)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => {
                  const isSelected = selectedServiceIds.includes(service.id);
                  return (
                    <button
                      type="button"
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-tg-secondaryBg text-tg-text border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {service.nameUz}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Xizmat tumanlari */}
            <div className="space-y-2.5">
              <label className="block text-sm font-semibold">
                Xizmat ko‘rsatish tumanlari <span className="text-xs font-normal text-tg-hint">(kamida 1 ta)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {districts.map((district) => {
                  const isSelected = selectedDistrictIds.includes(district.id);
                  return (
                    <button
                      type="button"
                      key={district.id}
                      onClick={() => toggleDistrict(district.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-tg-secondaryBg text-tg-text border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {district.nameUz}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tajriba yili */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold">Ish tajribasi</label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {experienceYears} yil
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={experienceYears}
                onChange={(e) => setExperienceYears(parseInt(e.target.value, 10))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-tg-hint">
                <label className="font-semibold text-tg-text">O‘zingiz haqingizda (Bio)</label>
                <span>{bio.length}/500</span>
              </div>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tajribangiz, ish uslubingiz va mijozlarga taklif qiladigan kafolatlaringiz haqida yozing (kamida 20 belgi)..."
                className="w-full p-3 rounded-xl bg-tg-secondaryBg border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-md disabled:opacity-50"
            >
              {submitting ? 'Arizangiz yuborilmoqda...' : 'Arizani yuborish'}
            </button>
          </form>
        )}

        <PhoneRequiredModal
          isOpen={phoneModalOpen}
          onClose={() => setPhoneModalOpen(false)}
        />
      </div>
    </div>
  );
};
