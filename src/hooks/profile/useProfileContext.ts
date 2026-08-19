import { createContext, useContext } from "react";
import type { ProfileState } from "@/types";

export const ProfileContext = createContext<ProfileState | null>(null);

export function useProfileCtx(): ProfileState {
  const context = useContext(ProfileContext);
  if (context === null) {
    throw new Error("useProfileCtx must be used within ProfileProvider");
  }
  return context;
}
