import { useEffect, useState } from "react";
import { Download, WifiOff, RefreshCw, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import {
  startAutoSync,
  flushSyncQueue,
  getSyncMeta,
  enqueueSnapshot,
  persistToIdb,
} from "@/lib/sync";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function PwaRoot() {
  const online = useOnline();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    // Auto-sync + IndexedDB mirror
    const stop = startAutoSync(() => {
      const s = useAppStore.getState();
      const {
        hydrated: _h,
        setHydrated: _s,
        resetDemo: _r,
        importData: _i,
        ...data
      } = s as unknown as Record<string, unknown>;
      // Prefer explicit slice of AppData fields from store
      const state = useAppStore.getState();
      const snapshot = {
        settings: state.settings,
        journal: state.journal,
        partners: state.partners,
        articles: state.articles,
        documents: state.documents,
        assets: state.assets,
        employees: state.employees,
        stockMoves: state.stockMoves,
        bankImports: state.bankImports,
        journalPrevious: state.journalPrevious,
        financialInstruments: state.financialInstruments,
        severanceCalcs: state.severanceCalcs,
      } as import("@/lib/types").AppData;
      void persistToIdb(snapshot);
      return snapshot;
    }, 90_000);

    setPending(getSyncMeta().pending);

    return () => {
      stop();
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function syncNow() {
    const state = useAppStore.getState();
    const snapshot = {
      settings: state.settings,
      journal: state.journal,
      partners: state.partners,
      articles: state.articles,
      documents: state.documents,
      assets: state.assets,
      employees: state.employees,
      stockMoves: state.stockMoves,
      bankImports: state.bankImports,
      journalPrevious: state.journalPrevious,
      financialInstruments: state.financialInstruments,
      severanceCalcs: state.severanceCalcs,
    } as import("@/lib/types").AppData;
    enqueueSnapshot(snapshot);
    await persistToIdb(snapshot);
    const r = await flushSyncQueue();
    setSyncMsg(r.message);
    setPending(getSyncMeta().pending);
    setTimeout(() => setSyncMsg(""), 4000);
  }

  return (
    <div className="flex items-center gap-2 no-print">
      {!online ? (
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-3 text-xs font-medium text-warn">
          <WifiOff className="size-3.5" />
          Hors ligne — données locales
        </span>
      ) : (
        <span className="hidden h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted sm:inline-flex">
          <Cloud className="size-3.5" />
          En ligne{pending > 0 ? ` · ${pending} en file` : ""}
        </span>
      )}
      <Button size="sm" variant="secondary" onClick={() => void syncNow()} title="Synchroniser maintenant">
        <RefreshCw className="size-3.5" />
        Sync
      </Button>
      {syncMsg ? <span className="hidden text-xs text-muted md:inline">{syncMsg}</span> : null}
      {deferred && !installed ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await deferred.prompt();
            setDeferred(null);
          }}
        >
          <Download className="size-3.5" />
          Installer
        </Button>
      ) : null}
    </div>
  );
}
