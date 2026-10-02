import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type Dictionary, type Key } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { hi } from "./hi";
import { ja } from "./ja";
import { ko } from "./ko";

export type Lang = "en" | "es" | "hi" | "ko" | "fr" | "ja";

/** Each language in its own name and script, with the tagline as a taste of how it reads. */
export const LANGUAGES: { code: Lang; name: string; tagline: string }[] = [
  { code: "en", name: "English", tagline: "small moments. bigger worlds." },
  { code: "es", name: "Español", tagline: "pequeños momentos. mundos más grandes." },
  { code: "hi", name: "हिन्दी", tagline: "छोटे पल. बड़ी दुनिया." },
  { code: "ko", name: "한국어", tagline: "작은 순간. 더 큰 세상." },
  { code: "fr", name: "Français", tagline: "petits moments. mondes plus grands." },
  { code: "ja", name: "日本語", tagline: "小さな瞬間。もっと大きな世界。" },
];

const DICTIONARIES: Record<Lang, Dictionary> = { en, es, hi, ko, fr, ja };
const STORE = "nest.lang";

type Vars = Record<string, string | number>;
type Translate = (key: Key, vars?: Vars) => string;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Translate }>({ lang: "en", setLang: () => undefined, t: (k) => en[k] });

function firstLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORE) as Lang | null;
    if (saved && saved in DICTIONARIES) return saved;
  } catch {
    /* private mode: fall through to the browser language */
  }
  const wanted = navigator.language.slice(0, 2) as Lang;
  return wanted in DICTIONARIES ? wanted : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(firstLanguage);

  // The <html lang> attribute picks the right fonts and line heights for each script.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORE, l);
    } catch {
      /* not saved; the choice still applies to this visit */
    }
  }, []);

  const t = useCallback<Translate>((key, vars) => {
    let text: string = DICTIONARIES[lang][key] ?? en[key];
    if (vars) for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

/** Turns "line one\n*emphasis*" into lines and <em>. Translators mark emphasis; layout stays in code. */
export function rich(text: string): ReactNode {
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line.split(/(\*[^*]+\*)/).map((part, j) => (part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <em key={j}>{part.slice(1, -1)}</em> : part))}
    </span>
  ));
}

export type { Key };
