/**
 * Synchronisation hors ligne → en ligne.
 * - Les données métier vivent en local (zustand + localStorage / IndexedDB).
 * - Une file d'attente enregistre les mutations hors ligne.
 * - Dès que le réseau revient, la file est poussée vers /api/sync (si configuré).
 */
import type { AppData } from "./types";

const QUEUE_KEY = "pro-compta-sync-queue-v1";
const META_KEY = "pro-compta-sync-meta-v1";
const SNAPSHOT_KEY = "pro-compta-ohada-v6"; // même clé que le store

export type SyncOp = {
  id: string;
  at: string;
  kind: "full_snapshot" | "mutation";
  payload: unknown;
  retries: number;
};

export type SyncMeta = {
  lastSyncAt: string | null;
  lastError: string | null;
  pending: number;
  endpoint: string;
};

function readQueue(): SyncOp[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as SyncOp[];
  } catch {
    return [];
  }
}

function writeQueue(q: SyncOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function getSyncMeta(): SyncMeta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || "{}") as Partial<SyncMeta>;
    return {
      lastSyncAt: m.lastSyncAt ?? null,
      lastError: m.lastError ?? null,
      pending: readQueue().length,
      endpoint: m.endpoint || "/api/sync",
    };
  } catch {
    return { lastSyncAt: null, lastError: null, pending: 0, endpoint: "/api/sync" };
  }
}

function setMeta(patch: Partial<SyncMeta>) {
  const cur = getSyncMeta();
  localStorage.setItem(META_KEY, JSON.stringify({ ...cur, ...patch, pending: readQueue().length }));
}

export function setSyncEndpoint(url: string) {
  setMeta({ endpoint: url });
}

/** Enregistre un snapshot complet à synchroniser. */
export function enqueueSnapshot(data: AppData) {
  const q = readQueue();
  // Garder un seul full_snapshot (le plus récent)
  const filtered = q.filter((o) => o.kind !== "full_snapshot");
  filtered.push({
    id: `snap-${Date.now()}`,
    at: new Date().toISOString(),
    kind: "full_snapshot",
    payload: data,
    retries: 0,
  });
  writeQueue(filtered);
  setMeta({ pending: filtered.length });
}

/** Tente d'envoyer la file vers le serveur. No-op silencieux si offline ou 404. */
export async function flushSyncQueue(): Promise<{ ok: boolean; sent: number; message: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, sent: 0, message: "Hors ligne — synchro différée" };
  }
  const meta = getSyncMeta();
  const q = readQueue();
  if (!q.length) {
    setMeta({ lastSyncAt: new Date().toISOString(), lastError: null });
    return { ok: true, sent: 0, message: "Rien à synchroniser" };
  }

  let sent = 0;
  const remaining: SyncOp[] = [];

  for (const op of q) {
    try {
      const res = await fetch(meta.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op),
      });
      if (res.ok || res.status === 204) {
        sent += 1;
      } else if (res.status === 404 || res.status === 501) {
        // Endpoint non déployé : on considère le local comme source de vérité
        setMeta({
          lastSyncAt: new Date().toISOString(),
          lastError: "Endpoint sync non configuré (mode local pur)",
        });
        writeQueue([]);
        return {
          ok: true,
          sent: 0,
          message: "Mode local — déployez /api/sync pour multi-appareils",
        };
      } else {
        remaining.push({ ...op, retries: op.retries + 1 });
      }
    } catch (e) {
      remaining.push({ ...op, retries: op.retries + 1 });
      setMeta({ lastError: e instanceof Error ? e.message : "Erreur réseau" });
    }
  }

  writeQueue(remaining);
  setMeta({
    lastSyncAt: new Date().toISOString(),
    lastError: remaining.length ? "Certaines opérations en attente" : null,
    pending: remaining.length,
  });
  return {
    ok: remaining.length === 0,
    sent,
    message: remaining.length
      ? `${sent} envoyée(s), ${remaining.length} en attente`
      : `${sent} opération(s) synchronisée(s)`,
  };
}

/** Démarre l'écoute online + sync périodique. */
export function startAutoSync(getData: () => AppData, intervalMs = 60_000) {
  const onOnline = () => {
    enqueueSnapshot(getData());
    void flushSyncQueue();
  };
  window.addEventListener("online", onOnline);

  // Message du SW
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SYNC_NOW") {
        enqueueSnapshot(getData());
        void flushSyncQueue();
      }
    });
  }

  const timer = window.setInterval(() => {
    if (navigator.onLine) {
      enqueueSnapshot(getData());
      void flushSyncQueue();
    }
  }, intervalMs);

  // Premier passage
  if (navigator.onLine) {
    enqueueSnapshot(getData());
    void flushSyncQueue();
  }

  // Background Sync API si dispo
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then((reg) => {
        // @ts-expect-error SyncManager
        return reg.sync?.register("pro-compta-sync");
      })
      .catch(() => undefined);
  }

  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(timer);
  };
}

/** Export de sauvegarde fichier (backup manuel). */
export function downloadBackup(data: AppData, filename = "pro-compta-ohada-backup.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lecture d'un backup JSON. */
export async function readBackupFile(file: File): Promise<AppData> {
  const text = await file.text();
  return JSON.parse(text) as AppData;
}

/** Snapshot IndexedDB optionnel (plus robuste que localStorage pour gros volumes). */
export async function persistToIdb(data: AppData): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("pro-compta-ohada", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots");
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").put(data, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function loadFromIdb(): Promise<AppData | null> {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve) => {
    const req = indexedDB.open("pro-compta-ohada", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots");
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction("snapshots", "readonly");
        const g = tx.objectStore("snapshots").get("current");
        g.onsuccess = () => resolve((g.result as AppData) || null);
        g.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

void SNAPSHOT_KEY;
