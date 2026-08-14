import type { ReactNode } from "react";
import { PrefsProvider } from "../context/prefs";
import { ProfileProvider } from "../context/profile";
import { SessionProvider } from "../context/session";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PrefsProvider>
      <ProfileProvider>
        <SessionProvider>{children}</SessionProvider>
      </ProfileProvider>
    </PrefsProvider>
  );
}
