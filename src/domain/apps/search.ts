import type { InstalledApp, OpenAppEditorState } from "@/types";
export const matchesInstalledAppSearch = (
  app: InstalledApp,
  query: string,
): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return true;
  }
  return (
    app.name.toLowerCase().includes(normalizedQuery) ||
    app.bundleId.toLowerCase().includes(normalizedQuery)
  );
};
export const filterOpenAppEditorApps = (
  editor: OpenAppEditorState,
  limit = 80,
) => {
  return editor.apps
    .filter((app) => matchesInstalledAppSearch(app, editor.query))
    .slice(0, limit);
};
export const isOpenAppSelection = (
  editor: OpenAppEditorState,
  bundleId: string,
): boolean => {
  if (editor.selected === null) {
    return false;
  }
  return editor.selected.bundleId === bundleId;
};
