"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "./translations";

const STORAGE_KEY = "bhadebook:language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "mr" ? "mr" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // Read the persisted language after mount to avoid SSR/client hydration
  // mismatches (localStorage isn't available on the server).
  useEffect(() => {
    setLanguageState(readStoredLanguage());
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "mr" : "en");
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
