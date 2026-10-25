import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { buildTft, budgetVsActual, buildBilan, buildPnl, buildEss, kpis, computeIs } from "@/lib/engine";
import { countryByName } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Download, CheckCircle2, Circle } from "lucide-react";

type Tab = "tft" | "budget" | "cloture" | "export";

export function GestionPage() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const currency = tax.currency;
  const [tab, setTab] = useState<Tab>("tft");

  const tft = useMemo(() => buildTft(data.journal), [data.journal]);
  const budgetRows = useMemo(
    () => budgetVsActual(data.journal, data.budget || []),
    [data.journal, data.budget],
  );
  const closing = data.closingSteps || [];
  const doneCount = closing.filter((c) => c.done).length;

  return (
    <div>
      <PageHeader
        eyebrow="Pilotage"
        title="Gestion & clôture"
        description="TFT, budget vs réalisé, checklist de clôture et export des états."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["tft", "TFT"],
            ["budget", "Budget"],
            ["cloture", "Clôture"],
            ["export", "Export"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            variant={tab === id ? "default" : "secondary"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "tft" ? <TftTab lines={tft} currency={currency} /> : null}
      {tab === "budget" ? (
        <BudgetTab rows={budgetRows} currency={currency} data={data} />
      ) : null}
      {tab === "cloture" ? (
        <ClotureTab
          steps={closing}
          doneCount={doneCount}
          toggle={data.toggleClosingStep}
          reset={data.resetClosingSteps}
        />
      ) : null}
      {tab === "export" ? <ExportTab data={data} currency={currency} /> : null}
    </div>
  );
}

function TftTab({
  lines,
  currency,
}: {
  lines: { label: string; amount: number; indent?: number; bold?: boolean; total?: boolean }[];
  currency: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-lg">Tableau des flux de trésorerie</h2>
        <p className="text-sm text-muted">Forme simplifiée SYSCOHADA (CAFG → exploitation → investissement → financement).</p>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {lines.map((l) => (
            <tr
              key={l.label}
              className={cn(
                "border-t border-border",
                l.total && "bg-elevated/50",
                l.bold && "font-semibold",
              )}
            >
              <td className={cn("px-4 py-2", l.indent && "pl-8")}>{l.label}</td>
              <td className="px-4 py-2 text-right">
                <Money value={l.amount} currency={currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function BudgetTab({
  rows,
  currency,
  data,
}: {
  rows: { label: string; prefix: string; budget: number; actual: number; variance: number; pct: number }[];
  currency: string;
  data: ReturnType<typeof useAppStore.getState>;
}) {
  const [label, setLabel] = useState("");
  const [prefix, setPrefix] = useState("70");
  const [amount, setAmount] = useState(0);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-lg">Budget vs réalisé</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2">Poste</th>
              <th className="px-4 py-2">Cpt</th>
              <th className="px-4 py-2 text-right">Budget</th>
              <th className="px-4 py-2 text-right">Réalisé</th>
              <th className="px-4 py-2 text-right">Écart</th>
              <th className="px-4 py-2 text-right">%</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.prefix + r.label} className="border-t border-border">
                <td className="px-4 py-2">{r.label}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.prefix}</td>
                <td className="px-4 py-2 text-right">
                  <Money value={r.budget} currency={currency} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Money value={r.actual} currency={currency} />
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right",
                    r.variance > 0 ? "text-danger" : r.variance < 0 ? "text-success" : "",
                  )}
                >
                  <Money value={r.variance} currency={currency} />
                </td>
                <td className="px-4 py-2 text-right">{r.pct.toFixed(0)} %</td>
                <td className="px-2 py-2">
                  <button
                    className="text-xs text-muted hover:text-danger"
                    type="button"
                    onClick={() => {
                      const line = (data.budget || []).find(
                        (b) => b.accountPrefix === r.prefix && b.label === r.label,
                      );
                      if (line) data.removeBudgetLine(line.id);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="p-4">
        <h3 className="mb-3 font-medium">Ajouter une ligne budgétaire</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Libellé">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label="Préfixe compte">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="701" />
          </Field>
          <Field label="Montant annuel">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={() => {
                if (!label || !prefix) {
                  toast.error("Libellé et préfixe requis.");
                  return;
                }
                data.addBudgetLine({ label, accountPrefix: prefix, amount });
                setLabel("");
                setAmount(0);
                toast.success("Ligne budgétaire ajoutée.");
              }}
            >
              Ajouter
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ClotureTab({
  steps,
  doneCount,
  toggle,
  reset,
}: {
  steps: { id: string; label: string; done: boolean }[];
  doneCount: number;
  toggle: (id: string) => void;
  reset: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Checklist de clôture</h2>
          <p className="text-sm text-muted">
            {doneCount} / {steps.length} étapes validées
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={reset}>
          Réinitialiser
        </Button>
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => toggle(s.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[12px] border border-border px-4 py-3 text-left text-sm transition",
                s.done ? "border-success/40 bg-success/5" : "hover:bg-elevated",
              )}
            >
              {s.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-success" />
              ) : (
                <Circle className="size-5 shrink-0 text-muted" />
              )}
              <span className={s.done ? "line-through opacity-70" : ""}>{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {doneCount === steps.length && steps.length > 0 ? (
        <p className="mt-4 text-sm text-success">Clôture prête — exportez les états (onglet Export).</p>
      ) : null}
    </Card>
  );
}

function ExportTab({
  data,
  currency,
}: {
  data: ReturnType<typeof useAppStore.getState>;
  currency: string;
}) {
  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pro-compta-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    data.markBackedUp();
    toast.success("Sauvegarde JSON téléchargée.");
  }

  function exportEtatsPrintable() {
    const bil = buildBilan(data.journal);
    const pnl = buildPnl(data.journal);
    const tft = buildTft(data.journal);
    const k = kpis(data);
    const isc = computeIs(data);
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><title>États PRO COMPTA OHADA</title>
<style>
  body{font-family:system-ui,sans-serif;margin:24px;color:#111}
  h1{font-size:20px;margin:0 0 4px}
  h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
  .meta{color:#555;font-size:12px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px}
  td,th{padding:4px 8px;border-bottom:1px solid #eee}
  td.r,th.r{text-align:right}
  .total{font-weight:700;background:#f5f5f5}
  @media print{button{display:none}}
</style></head><body>
<button onclick="window.print()">Imprimer / PDF</button>
<h1>${data.settings.companyName || "Entreprise"} — États financiers SYSCOHADA</h1>
<p class="meta">${data.settings.country} · Exercice ${data.settings.fyStart} → ${data.settings.fyEnd} · ${currency}</p>
<h2>Indicateurs</h2>
<table>
<tr><td>Chiffre d'affaires</td><td class="r">${k.caYear.toLocaleString("fr-FR")}</td></tr>
<tr><td>Résultat net</td><td class="r">${k.rn.toLocaleString("fr-FR")}</td></tr>
<tr><td>Trésorerie nette</td><td class="r">${k.treso.toLocaleString("fr-FR")}</td></tr>
<tr><td>IS dû</td><td class="r">${isc.isDue.toLocaleString("fr-FR")}</td></tr>
</table>
<h2>Compte de résultat</h2>
<table>${pnl.map((l) => `<tr class="${l.total ? "total" : ""}"><td>${l.label}</td><td class="r">${l.amount.toLocaleString("fr-FR")}</td></tr>`).join("")}</table>
<h2>Bilan — Actif</h2>
<table>${bil.actif.map((l) => `<tr class="${l.total ? "total" : ""}"><td>${l.label}</td><td class="r">${l.amount.toLocaleString("fr-FR")}</td></tr>`).join("")}</table>
<h2>Bilan — Passif</h2>
<table>${bil.passif.map((l) => `<tr class="${l.total ? "total" : ""}"><td>${l.label}</td><td class="r">${l.amount.toLocaleString("fr-FR")}</td></tr>`).join("")}</table>
<p class="meta">Écart actif/passif : ${bil.ecart.toLocaleString("fr-FR")} ${currency}</p>
<h2>ESS / Soldes intermédiaires de gestion</h2>
<table>${buildEss(data.journal).map((l) => `<tr class="${l.total ? "total" : ""}"><td>${l.label}</td><td class="r">${l.amount.toLocaleString("fr-FR")}</td></tr>`).join("")}</table>
<h2>Notes annexes</h2>
${(data.annexNotes || []).map((n) => `<h3>${n.code} — ${n.title}</h3><p>${n.body.replace(/</g, "&lt;")}</p>`).join("")}
<h2>Tableau des flux de trésorerie</h2>
<table>${tft.map((l) => `<tr class="${l.total ? "total" : ""}"><td>${l.label}</td><td class="r">${l.amount.toLocaleString("fr-FR")}</td></tr>`).join("")}</table>
<p class="meta">Document généré par PRO COMPTA OHADA v2 — à vérifier par un expert-comptable.</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Autorisez les pop-ups pour l'export.");
      return;
    }
    w.document.write(html);
    w.document.close();
    toast.success("États ouverts — utilisez Imprimer → Enregistrer en PDF.");
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-4">
        <h2 className="font-display text-lg">Sauvegarde JSON</h2>
        <p className="mt-1 text-sm text-muted">
          Export complet des données (journal, documents, stocks, paramètres).
        </p>
        <Button type="button" className="mt-4" onClick={exportJson}>
          <Download className="mr-2 size-4" /> Télécharger la sauvegarde
        </Button>
      </Card>
      <Card className="p-4">
        <h2 className="font-display text-lg">États imprimables / PDF</h2>
        <p className="mt-1 text-sm text-muted">
          CR, Bilan, TFT et indicateurs — impression navigateur ou « Enregistrer en PDF ».
        </p>
        <Button type="button" className="mt-4" onClick={exportEtatsPrintable}>
          <Download className="mr-2 size-4" /> Générer les états
        </Button>
      </Card>
    </div>
  );
}
