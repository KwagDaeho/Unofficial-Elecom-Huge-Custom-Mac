import type { ReactNode } from "react";
import { PrefsContext, usePrefsState } from "@/hooks/prefs";
interface PrefsProviderProps {
  children: ReactNode;
}
export const PrefsProvider = (props: PrefsProviderProps) => {
  const value = usePrefsState();
  return (
    <PrefsContext.Provider value={value}>
      {props.children}
    </PrefsContext.Provider>
  );
};
