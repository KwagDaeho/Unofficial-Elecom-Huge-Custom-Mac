import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useDeviceProbe } from "../hooks/useDeviceProbe";
import { useKeyCapture } from "../hooks/useKeyCapture";
import { usePermissions } from "../hooks/usePermissions";
import { useProfileCtx } from "./profile";
import * as tauri from "../services/tauri";
import type { ActionSlot, ButtonId, DeviceInfo, EditorMode, LastReport } from "../types";

type SessionContextValue = {
  connected: DeviceInfo | null;
  report: LastReport | null;
  trusted: boolean;
  grantAccess: () => Promise<void>;
  autostartOn: boolean;
  setAutostartOn: (on: boolean) => Promise<void>;
  editor: EditorMode | null;
  setEditor: Dispatch<SetStateAction<EditorMode | null>>;
  selectCatalogValue: (buttonId: ButtonId, slot: ActionSlot, value: string) => void;
  selectCustomCatalogValue: (entryId: string, slot: ActionSlot, value: string) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { actions } = useProfileCtx();
  const { connected, report } = useDeviceProbe();
  const { trusted, grantAccess } = usePermissions();
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [autostartOn, setAutostartOnState] = useState(false);

  useKeyCapture(editor, setEditor, (slot, activator) => {
    actions.assignBallScrollActivator(slot, activator);
  });

  useEffect(() => {
    void tauri.autostartIsEnabled().then(setAutostartOnState);
  }, []);

  async function setAutostartOn(on: boolean) {
    try {
      setAutostartOnState(await tauri.autostartSet(on));
    } catch (err) {
      actions.setBootError(String(err));
    }
  }

  function selectCatalogValue(
    buttonId: ButtonId,
    slot: ActionSlot,
    value: string,
  ) {
    actions.selectCatalogValue(buttonId, slot, value, setEditor);
  }

  function selectCustomCatalogValue(
    entryId: string,
    slot: ActionSlot,
    value: string,
  ) {
    actions.selectCustomCatalogValue(entryId, slot, value, setEditor);
  }

  return (
    <SessionContext.Provider
      value={{
        connected,
        report,
        trusted,
        grantAccess,
        autostartOn,
        setAutostartOn,
        editor,
        setEditor,
        selectCatalogValue,
        selectCustomCatalogValue,
      }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
