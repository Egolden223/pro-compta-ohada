import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { ECRITURES_TYPES } from "@/lib/engine";
import { searchDictionary, type DictEntry } from "@/lib/dictionary";
import {
  diagnoseAccounting,
  generateReport,
  suggestActions,
  type ReportAudience,
} from "@/lib/ai-engine";
import { todayISO, cn } from "@/lib/utils";

type Tab = "dictionnaire" | "rapports" | "diagnostic" | "modeles";

const AUDIENCES: { id: ReportAudience; label: string }[] = [
  { id: "dirigeants", label: "Dirigeants" },
  { id: "associes", label: "Associés" },
  { id: "banque", label: "Banque" },
  { id: "impots", label: "Impôts / DGI" },
  { id: "cnss", label: "CNSS / social" },
  { id: "comptable", label: "Comptable" },
];

const CAT_LABEL: Record<DictEntry["category"], string> = {
  comptable: "Comptable",
  financier: "Financier",
  economique: "Économique",
  fiscal: "Fiscal",
  social: "Social",
  ohada: "OHADA",
};

export function AssistantPage() {
  const data = useAppStore();
  const add = useAppStore((s) => s.addJournalLine);
  const consume = useAppStore((s) => s.consumeNumber);
  const [tab, setTab] = useState<Tab>("diagnostic");
  const [amount, setAmount] = useState(0);
  const [qModel, setQModel] = useState("");
  const [qDict, setQDict] = useState("");
  const [cat, setCat] = useState<DictEntry["category"] | "">("");
  const [audience, setAudience] = useState<ReportAudience>("dirigeants");
  const [report, setReport] = useState("");

  const filteredModels = ECRITURES_TYPES.filter(
    (e) =>
      e.label.toLowerCase().includes(qModel.toLowerCase()) ||
      e.debit.includes(qModel) ||
      e.credit.includes(qModel),
  );

  const dictResults = useMemo(
    () => searchDictionary(qDict, cat || undefined),
    [qDict, cat],
  );

  const alerts = useMemo(() => diagnoseAccounting(data), [data.journal, data.employees, data.settings]);
  const actions = useMemo(() => suggestActions(data), [data.journal, data.employees, data.settings]);

  function applyModel(id: string) {
    const t = ECRITURES_TYPES.find((e) => e.id === id);
    if (!t) return;
    if (amount <= 0) {
      toast.error("Indiquez un montant.");
      return;
    }
    const piece = consume("PIECE_BROUILLARD");
    add({
      date: todayISO(),
      piece,
      journal: t.journal,
      debit: t.debit,
      credit: t.credit,
      libelle: t.libelle,
      amount: Math.round(amount),
      source: "manual",
    });
    toast.success(`Écriture « ${t.label} » enregistrée`);
  }

  function buildReport() {
    const text = generateReport(data, audience);
    setReport(text);
    toast.success("Rapport rédigé automatiquement");
  }

  function printReport() {
    if (!report) buildReport();
    const text = report || generateReport(data, audience);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Rapport</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;max-width:800px;margin:auto;white-space:pre-wrap;font-size:12px;line-height:1.45}</style>
</head><body>${text.replace(/</g, "&lt;")}</body></html>`);
    w.document.close();
    w.print();
  }

  function copyReport() {
    const text = report || generateReport(data, audience);
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Rapport copié"),
      () => toast.error("Copie impossible"),
    );
  }

  const crit = alerts.filter((a) => a.severity === "critique").length;
  const alt = alerts.filter((a) => a.severity === "alerte").length;

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence assistée"
        title="Assistant · Dictionnaire · IA"
        description="Glossaire SYSCOHADA, diagnostic automatique des écritures, rapports pour dirigeants, associés, banques et administrations."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["diagnostic", `Diagnostic IA${crit ? ` (${crit})` : ""}`],
            ["rapports", "Rapports IA"],
            ["dictionnaire", "Dictionnaire"],
            ["modeles", "Modèles d'écritures"],
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

      {tab === "diagnostic" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-3">
              <p className="text-xs text-muted">Critiques</p>
              <p className={cn("text-2xl font-semibold", crit > 0 && "text-danger")}>{crit}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Alertes</p>
              <p className="text-2xl font-semibold">{alt}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Infos</p>
              <p className="text-2xl font-semibold">
                {alerts.filter((a) => a.severity === "info").length}
              </p>
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 font-display">
              Anomalies détectées automatiquement
            </div>
            {alerts.length === 0 ? (
              <p className="p-4 text-sm text-muted">Aucune anomalie détectée sur le journal actuel.</p>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">
                      <span
                        className={cn(
                          "mr-2 rounded px-1.5 py-0.5 text-xs uppercase",
                          a.severity === "critique" && "bg-danger/15 text-danger",
                          a.severity === "alerte" && "bg-amber-500/15 text-amber-700",
                          a.severity === "info" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {a.severity}
                      </span>
                      {a.title}
                      <span className="ml-2 font-mono text-xs text-muted">{a.code}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">{a.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="font-display mb-2">Actions suggérées</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === "rapports" ? (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-display mb-2">Rédaction automatique multi-destinataires</h2>
            <p className="mb-3 text-xs text-muted">
              Le moteur analyse bilan, CR, TFT, IS/IMF et alertes, puis rédige un rapport structuré
              adapté au destinataire. Aucune clé API requise (analyse locale). Vous pouvez ensuite
              brancher un LLM externe pour enrichir le style (voir documentation ci-dessous).
            </p>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => (
                <Button
                  key={a.id}
                  type="button"
                  variant={audience === a.id ? "default" : "secondary"}
                  onClick={() => setAudience(a.id)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={buildReport}>
                Rédiger le rapport
              </Button>
              <Button type="button" variant="secondary" onClick={printReport}>
                Imprimer
              </Button>
              <Button type="button" variant="secondary" onClick={copyReport}>
                Copier
              </Button>
            </div>
          </Card>
          {report ? (
            <Card className="p-4">
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
                {report}
              </pre>
            </Card>
          ) : (
            <Card className="p-6 text-sm text-muted">
              Choisissez un destinataire puis cliquez sur « Rédiger le rapport ».
            </Card>
          )}
          <Card className="p-4 text-xs text-muted">
            <p className="font-medium text-foreground">Brancher une IA générative externe (optionnel)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Exportez le rapport ci-dessus (contexte chiffré déjà calculé).</li>
              <li>
                Envoyez-le à un LLM (API OpenAI, Claude, Grok, endpoint privé) avec l&apos;instruction :
                « Reformule de façon professionnelle pour [destinataire], sans inventer de chiffres ».
              </li>
              <li>
                En production : ajouter une route serveur{" "}
                <code className="text-foreground">/api/ai-report</code> qui appelle le fournisseur
                avec la clé côté serveur uniquement.
              </li>
            </ol>
          </Card>
        </div>
      ) : null}

      {tab === "dictionnaire" ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Rechercher un terme">
                <Input
                  placeholder="Ex. BFR, TVA, SYSCOHADA, amortissement…"
                  value={qDict}
                  onChange={(e) => setQDict(e.target.value)}
                />
              </Field>
              <Field label="Catégorie">
                <select
                  className="rounded border border-border bg-transparent px-2 py-1.5 text-sm"
                  value={cat}
                  onChange={(e) => setCat(e.target.value as DictEntry["category"] | "")}
                >
                  <option value="">Toutes</option>
                  {Object.entries(CAT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted">{dictResults.length} entrée(s)</p>
          </Card>
          <ul className="space-y-2">
            {dictResults.map((e) => (
              <li key={e.term}>
                <Card className="p-4">
                  <p className="font-display text-base">
                    {e.term}{" "}
                    <span className="text-xs font-normal text-muted">
                      {CAT_LABEL[e.category]}
                      {e.aliases?.length ? ` · ${e.aliases.join(", ")}` : ""}
                    </span>
                  </p>
                  <p className="mt-1 text-sm">{e.definition}</p>
                  {e.example ? (
                    <p className="mt-1 text-xs italic text-muted">Ex. : {e.example}</p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "modeles" ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Montant">
                <Input
                  type="number"
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Filtrer les modèles">
                <Input value={qModel} onChange={(e) => setQModel(e.target.value)} />
              </Field>
            </div>
          </Card>
          <ul className="divide-y divide-border rounded-[12px] border border-border">
            {filteredModels.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{e.label}</p>
                  <p className="text-xs text-muted">
                    {e.debit} → {e.credit} · {e.libelle}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => applyModel(e.id)}>
                  Appliquer
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
