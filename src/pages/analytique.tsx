import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { buildAnalyticPnl, buildAnalyticBalance } from "@/lib/engine";
import { countryByName } from "@/lib/countries";
import { cn } from "@/lib/utils";

export function AnalytiquePage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const axes = data.analyticAxes || [];
  const rows = useMemo(() => buildAnalyticPnl(data.journal), [data.journal]);
  const balAx = useMemo(() => buildAnalyticBalance(data.journal, "axeAnalytique"), [data.journal]);
  const [tab, setTab] = useState<"result" | "balance">("result");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");

  function addAxis() {
    if (!code.trim()) {
      toast.error("Code requis.");
      return;
    }
    data.addAnalyticAxis({ code: code.trim().toUpperCase(), label: label || code, active: true });
    toast.success("Axe ajouté.");
    setCode("");
    setLabel("");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pilotage"
        title="Comptabilité analytique"
        description="Axes / sections (style Sage) — résultat par activité, projet ou département."
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg">Axes analytiques</h2>
          <ul className="mb-3 space-y-1 text-sm">
            {axes.map((a) => (
              <li key={a.id} className="flex justify-between">
                <span>
                  <span className="font-mono text-xs">{a.code}</span> — {a.label}
                </span>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-danger"
                  onClick={() => data.removeAnalyticAxis(a.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="COM" />
            </Field>
            <Field label="Libellé">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button type="button" onClick={addAxis}>
                Ajouter
              </Button>
            </div>
          </div>
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3 font-display">Résultat par axe</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-2">Axe</th>
                <th className="px-4 py-2 text-right">Produits</th>
                <th className="px-4 py-2 text-right">Charges</th>
                <th className="px-4 py-2 text-right">Résultat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.axe} className="border-t border-border">
                  <td className="px-4 py-2">{r.axe}</td>
                  <td className="px-4 py-2 text-right">
                    <Money value={r.produits} currency={currency} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Money value={r.charges} currency={currency} />
                  </td>
                  <td className={cn("px-4 py-2 text-right font-medium", r.resultat < 0 && "text-danger")}>
                    <Money value={r.resultat} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              Aucune écriture avec axe. Renseignez l&apos;axe à la saisie du brouillard.
            </p>
          ) : null}
        </Card>
      </div>
      <div className="mb-2 flex gap-2">
        <Button type="button" variant={tab === "result" ? "default" : "secondary"} onClick={() => setTab("result")}>
          Résultat
        </Button>
        <Button type="button" variant={tab === "balance" ? "default" : "secondary"} onClick={() => setTab("balance")}>
          Balance analytique
        </Button>
      </div>
      {tab === "balance" ? (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-2">Axe</th>
                <th className="px-4 py-2">Compte</th>
                <th className="px-4 py-2 text-right">Débit</th>
                <th className="px-4 py-2 text-right">Crédit</th>
                <th className="px-4 py-2 text-right">Solde</th>
              </tr>
            </thead>
            <tbody>
              {balAx.slice(0, 100).map((r) => (
                <tr key={r.axe + r.code} className="border-t border-border">
                  <td className="px-4 py-1.5">{r.axe}</td>
                  <td className="px-4 py-1.5 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-1.5 text-right"><Money value={r.debit} currency={currency} /></td>
                  <td className="px-4 py-1.5 text-right"><Money value={r.credit} currency={currency} /></td>
                  <td className="px-4 py-1.5 text-right"><Money value={r.solde} currency={currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
