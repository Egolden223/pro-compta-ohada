import type { WorkspaceMeta } from "./types";

export const WORKSPACE_PREFIX = "pro-compta-ohada-ws-";
export const WORKSPACE_INDEX_KEY = "pro-compta-ohada-ws-index";

export function loadWorkspaceIndex(): WorkspaceMeta[] {
  try {
    const raw = localStorage.getItem(WORKSPACE_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWorkspaceIndex(list: WorkspaceMeta[]) {
  try {
    localStorage.setItem(WORKSPACE_INDEX_KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode */
  }
}
