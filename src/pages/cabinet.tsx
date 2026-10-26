import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import type { WorkspaceMeta } from "@/lib/types";

export function CabinetPage() {
  const data = useAppStore();
  const [name, setName] = useState(data.settings.companyName || "");
  const [list, setList] = useState<WorkspaceMeta[]>(() => {
    try {
      return data.listWorkspaces?.() ?? [];
    } catch {
      return [];
    }
  });

  function refresh() {
    setList((() => { try { return data.listWorkspaces?.() ?? []; } catch { return []; } })());
  }

  function save() {
    const id = data.saveAsWorkspace(name.trim() || data.settings.companyName || "Dossier");
    toast.success(`Dossier enregistré (${id.slice(0, 8)}…).`);
    refresh();
  }

  function load(id: string) {
    data.switchWorkspace(id);
    toast.success("Dossier chargé.");
    refresh();
  }

  function remove(id: string) {
    data.deleteWorkspace(id);
    toast("Dossier supprimé du navigateur.");
    refresh();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cabinet"
        title="Multi-dossiers"
        description="Enregistrez plusieurs clients / sociétés dans le navigateur et basculez d'un dossier à l'autre."
      />
      <Card className="mb-4 p-4">
        <h2 className="mb-3 font-display text-lg">Dossier courant</h2>
        <p className="mb-2 text-sm">
          <strong>{data.settings.companyName}</strong> — {data.settings.country} ·{" "}
          {data.settings.accountingSystem || "NORMAL"} ·{" "}
          {data.settings.entityProfile || "SYSCOHADA"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Field label="Nom sous lequel enregistrer">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={save}>
              Enregistrer ce dossier
            </Button>
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3 font-display">Dossiers sauvegardés</div>
        <ul className="divide-y divide-border">
          {list.length === 0 ? (
            <li className="p-6 text-sm text-muted">Aucun dossier enregistré pour l&apos;instant.</li>
          ) : (
            list
              .slice()
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <strong>{w.name}</strong>
                    <p className="text-xs text-muted">
                      {w.country} · {w.accountingSystem} · {w.entityProfile} ·{" "}
                      {new Date(w.updatedAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => load(w.id)}>
                      Ouvrir
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => remove(w.id)}>
                      Supprimer
                    </Button>
                  </div>
                </li>
              ))
          )}
        </ul>
      </Card>
    </div>
  );
}
