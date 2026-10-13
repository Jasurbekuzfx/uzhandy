import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken, UserProfile } from '../lib/api';
import { initTelegram } from '../lib/telegram';

export interface AuthContextType {
  user: UserProfile | null;
  role: 'CUSTOMER' | 'MASTER' | 'ADMIN' | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isTelegram: boolean;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  token: null,
  loading: true,
  error: null,
  isTelegram: false,
  refetchUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);

  const authenticate = async () => {
    const tg = initTelegram();
    const initData = tg?.initData;

    // Agar Telegram initData mavjud bo'lmasa (oddiy brauzerda ochilgan)
    if (!initData) {
      setIsTelegram(false);
      setLoading(false);
      return;
    }

    setIsTelegram(true);

    try {
      setLoading(true);
      setError(null);
      // initData orqali serverdan token va userni olish
      const authData = await api.loginTelegram(initData);
      setToken(authData.token);
      setAuthToken(authData.token);
      setUser(authData.user);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Autentifikatsiyada kutilmagan xatolik yuz berdi';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const refetchUser = async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch (err: unknown) {
      console.error('User ma’lumotlarini yangilashda xatolik:', err);
    }
  };

  useEffect(() => {
    void authenticate();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        token,
        loading,
        error,
        isTelegram,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
