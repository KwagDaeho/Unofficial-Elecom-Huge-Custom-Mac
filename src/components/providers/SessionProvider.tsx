import type { ReactNode } from "react";
import { SessionContext, useSessionState } from "@/hooks/session";

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider(props: SessionProviderProps) {
  const value = useSessionState();
  return (
    <SessionContext.Provider value={value}>{props.children}</SessionContext.Provider>
  );
}
