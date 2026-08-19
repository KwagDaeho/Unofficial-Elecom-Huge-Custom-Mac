import type { Dispatch, SetStateAction } from "react";
import { resolveCatalogSelection } from "@/domain/profile";
import * as tauri from "@/services/tauri";
import type {
  Action,
  ActionSlot,
  EditorMode,
  MappingTarget,
  Profile,
} from "@/types";
const updateOpenAppEditor = (
  setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  patch: Partial<
    Extract<
      EditorMode,
      {
        kind: "open_app";
      }
    >
  >,
) => {
  setEditor((previousEditor) => {
    if (previousEditor === null || previousEditor.kind !== "open_app") {
      return previousEditor;
    }
    return { ...previousEditor, ...patch };
  });
};
export const applyCatalogSelection = (
  target: MappingTarget,
  slot: ActionSlot,
  value: string,
  profile: Profile | null,
  setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  updateSlot: (target: MappingTarget, slot: ActionSlot, action: Action) => void,
) => {
  const result = resolveCatalogSelection(target, slot, value, profile);
  if (result.kind === "editor") {
    setEditor(result.editor);
    if (result.editor.kind === "open_app") {
      void loadOpenAppList(setEditor);
    }
    return;
  }
  if (result.kind === "action") {
    updateSlot(target, slot, result.action);
  }
};
export const loadOpenAppList = async (
  setEditor: Dispatch<SetStateAction<EditorMode | null>>,
) => {
  try {
    const apps = await tauri.listInstalledApps();
    updateOpenAppEditor(setEditor, {
      apps,
      loading: false,
      error: null,
    });
    void prefetchAppIcons(
      apps.map((app) => app.path),
      setEditor,
    );
  } catch (error) {
    updateOpenAppEditor(setEditor, {
      loading: false,
      error: String(error),
    });
  }
};
const prefetchAppIcons = async (
  appPaths: string[],
  setEditor: Dispatch<SetStateAction<EditorMode | null>>,
) => {
  const pendingPaths = [...appPaths];
  const workers = Array.from({ length: 6 }, async () => {
    while (pendingPaths.length > 0) {
      const appPath = pendingPaths.shift();
      if (appPath === undefined) {
        break;
      }
      try {
        const icon = await tauri.getAppIcon(appPath);
        if (icon === null) {
          continue;
        }
        setEditor((previousEditor) => {
          if (previousEditor === null || previousEditor.kind !== "open_app") {
            return previousEditor;
          }
          return {
            ...previousEditor,
            apps: previousEditor.apps.map((app) =>
              app.path === appPath ? { ...app, icon } : app,
            ),
          };
        });
      } catch {
        /* ignore missing icons */
      }
    }
  });
  await Promise.all(workers);
};
