import type { ReactNode } from "react";
import { ProfileContext, useProfileState } from "@/hooks/profile";
interface ProfileProviderProps {
  children: ReactNode;
}
export const ProfileProvider = (props: ProfileProviderProps) => {
  const value = useProfileState();
  return (
    <ProfileContext.Provider value={value}>
      {props.children}
    </ProfileContext.Provider>
  );
};
