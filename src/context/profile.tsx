import { createContext, useContext, type ReactNode } from "react";
import { useProfileState } from "../hooks/useProfile";

type ProfileContextValue = ReturnType<typeof useProfileState>;

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const value = useProfileState();
  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfileCtx(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfileCtx must be used within ProfileProvider");
  return ctx;
}
