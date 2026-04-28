import { useAuthStore } from '@/stores/authStore';
import { translations, TranslationKey } from '@/lib/translations';

export function useTranslation() {
  const role = useAuthStore((s) => s.user?.role);
  const preferredLanguage = useAuthStore((s) => s.user?.preferredLanguage) ?? 'ko';
  /** 해외 프리랜서는 프로필 언어와 관계없이 UI를 항상 영어로 표시 */
  const lang =
    role === 'FOREIGN_FREELANCER'
      ? 'en'
      : preferredLanguage === 'ja'
        ? 'ja'
        : 'ko';

  const t = (key: TranslationKey): string => {
    const dict = translations[lang] as Record<TranslationKey, string>;
    return dict[key] ?? translations.ko[key] ?? key;
  };

  return { t, lang };
}
