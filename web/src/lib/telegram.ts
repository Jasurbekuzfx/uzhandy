export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TelegramMainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => TelegramMainButton;
  onClick: (callback: () => void) => TelegramMainButton;
  offClick: (callback: () => void) => TelegramMainButton;
  show: () => TelegramMainButton;
  hide: () => TelegramMainButton;
  enable: () => TelegramMainButton;
  disable: () => TelegramMainButton;
  showProgress: (leaveActive?: boolean) => TelegramMainButton;
  hideProgress: () => TelegramMainButton;
}

export interface TelegramBackButton {
  isVisible: boolean;
  onClick: (callback: () => void) => TelegramBackButton;
  offClick: (callback: () => void) => TelegramBackButton;
  show: () => TelegramBackButton;
  hide: () => TelegramBackButton;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  MainButton?: TelegramMainButton;
  BackButton?: TelegramBackButton;
  ready: () => void;
  expand: () => void;
  close: () => void;
  openTelegramLink: (url: string) => void;
  onEvent: (eventType: string, eventHandler: () => void) => void;
  offEvent: (eventType: string, eventHandler: () => void) => void;
}


declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

const THEME_PARAM_TO_CSS_VAR: Record<keyof TelegramThemeParams, string> = {
  bg_color: '--tg-theme-bg-color',
  text_color: '--tg-theme-text-color',
  hint_color: '--tg-theme-hint-color',
  link_color: '--tg-theme-link-color',
  button_color: '--tg-theme-button-color',
  button_text_color: '--tg-theme-button-text-color',
  secondary_bg_color: '--tg-theme-secondary-bg-color',
  header_bg_color: '--tg-theme-header-bg-color',
  section_bg_color: '--tg-theme-section-bg-color',
  section_header_text_color: '--tg-theme-section-header-text-color',
  subtitle_text_color: '--tg-theme-subtitle-text-color',
  destructive_text_color: '--tg-theme-destructive-text-color',
};

export function applyTelegramTheme(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  const root = document.documentElement;
  const themeParams = tg.themeParams;

  if (themeParams) {
    (Object.keys(themeParams) as Array<keyof TelegramThemeParams>).forEach((key) => {
      const cssVar = THEME_PARAM_TO_CSS_VAR[key];
      const val = themeParams[key];
      if (cssVar && val) {
        root.style.setProperty(cssVar, val);
      }
    });
  }

  // Telegram mavzusi o'zgarganda ranglarni yangilash
  tg.onEvent('themeChanged', () => {
    applyTelegramTheme();
  });
}

/**
 * Telegram WebApp'ni ishga tushirish: ready() va expand() chaqirish
 */
export function initTelegram(): TelegramWebApp | null {
  const tg = getTelegramWebApp();
  if (tg) {
    tg.ready();
    tg.expand();
    applyTelegramTheme();
  }
  return tg;
}
