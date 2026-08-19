import type { ReactNode } from "react";
import { EditorProvider } from "./EditorProvider";
import { PrefsProvider } from "./PrefsProvider";
import { ProfileProvider } from "./ProfileProvider";
import { SessionProvider } from "./SessionProvider";
interface AppProvidersProps {
  children: ReactNode;
}
export const AppProviders = (props: AppProvidersProps) => {
  return (
    <PrefsProvider>
      <ProfileProvider>
        <EditorProvider>
          <SessionProvider>{props.children}</SessionProvider>
        </EditorProvider>
      </ProfileProvider>
    </PrefsProvider>
  );
};
