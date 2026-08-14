import { createContext, useContext, type ReactNode } from "react";
import { usePrefsState } from "../hooks/usePrefs";

type PrefsContextValue = ReturnType<typeof usePrefsState>;

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const value = usePrefsState();
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
