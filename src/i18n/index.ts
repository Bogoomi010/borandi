// i18n 엔진 — 다국어(영/한/일/중) 지원.
// ------------------------------------------------------------------
// 사용:
//   import { t, setLocale, onLocaleChange } from "../i18n";
//   <button>{t("common.confirm")}</button>
//   t("toast.reportSaved", { path })   // {path} 보간
//
// 설계 메모:
//  - i18n은 settings에 의존하지 않는다(순환 방지). 영속화는 main이 settings.lang을
//    읽어 setLocale()을 호출하고, 언어 변경 시 settings에 다시 써서 처리한다.
//  - 키 누락은 컴파일 타임에 막힌다: 각 사전이 Record<I18nKey, string>이라서
//    en에 있는 키가 없으면 빌드가 실패한다.
//  - 런타임 폴백: 현재 언어 → 영어 → 키 문자열.
// ------------------------------------------------------------------

import en, { type I18nKey } from "./locales/en";
import ko from "./locales/ko";
import ja from "./locales/ja";
import zh from "./locales/zh";

export type Locale = "en" | "ko" | "ja" | "zh";
export type { I18nKey };

/** 언어 선택 UI용 목록 (네이티브 표기) */
export const LOCALES: { id: Locale; label: string }[] = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
  { id: "zh", label: "中文" },
];

const DICTS: Record<Locale, Record<I18nKey, string>> = { en, ko, ja, zh };

const LOCALE_IDS: Locale[] = ["en", "ko", "ja", "zh"];
export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALE_IDS as string[]).includes(v);
}

/** 브라우저/OS 언어로부터 기본 언어 추론 (저장된 설정이 없을 때) */
export function detectLocale(fallback: Locale = "ko"): Locale {
  const nav = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "";
  if (nav.startsWith("ko")) return "ko";
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("en")) return "en";
  return fallback;
}

let current: Locale = "ko";
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

/** 언어 변경. 실제로 바뀐 경우에만 리스너를 호출한다. */
export function setLocale(next: Locale): void {
  if (next === current || !isLocale(next)) return;
  current = next;
  for (const cb of listeners) cb();
}

/** 언어 변경 구독. 해제 함수를 반환한다. */
export function onLocaleChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** 번역 조회. {key} 형태의 토큰을 params로 치환한다. */
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  let s: string = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
