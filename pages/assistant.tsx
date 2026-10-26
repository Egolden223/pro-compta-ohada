import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { ECRITURES_TYPES } from "@/lib/engine";
import { accountLabel } from "@/lib/accounts";
import { searchDictionary, type DictEntry } from "@/lib/dictionary";
import { diagnoseAccounting, generateReport, suggestActions, type ReportAudience } from "@/lib/ai-engine";
import { cn } from "@/lib/utils";
import { countryByName } from "@/lib/countries";

type Tab = "modeles" | "diagnostic" | "rapports" | "dictionnaire";
type EcritureType = (typeof ECRITURES_TYPES)[number];

const EXPLI: Record<string, string> = {
  achat_march: "Facture fournisseur non payee : debit 601 (achats), credit 401 (fournisseur).",
  tva_ach: "TVA deductible sur achat : debit 4452, credit 401.",
  vente_credit: "Facture client HT : debit 411 (client), credit 701 (vente).",
  tva_vte: "TVA collectee : debit 411, credit 4431.",
  regl_client_bq: "Encaissement client banque : debit 521, credit 411.",
  regl_client_caisse: "Encaissement especes : debit 571, credit 411.",
  regl_fourn: "Paiement fournisseur : debit 401, credit 521.",
  dot_amort: "Dotation amortissement : debit 681, credit 28x.",
  var_stock: "Sortie de stock : debit 6031, credit 311.",
  prov_clients: "Provision clients douteux : debit 691, credit 491.",
  prov_risques: "Provision pour risques : debit 691, credit 191.",
  salaire_brut: "Salaire brut : debit 661, credit 422.",
};

function expli(t: EcritureType) {
  return EXPLI[t.id] || `Debit ${t.debit} (${accountLabel(t.debit)}) / Credit ${t.credit} (${accountLabel(t.credit)}), journal ${t.journal}.`;
}

function answerQ(question: string, amount: number, currency: string): string {
  const q = question.trim().toLowerCase();
  if (q.length < 4) return "Decrivez une operation, ex. : comment comptabiliser un achat a credit de 500000 ?";
  const scored = ECRITURES_TYPES.map((t) => {
    const hay = `${t.label} ${t.libelle} ${expli(t)} ${t.debit} ${t.credit}`.toLowerCase();
    let score = 0;
    for (const w of q.split(/\s+/).filter((x) => x.length > 2)) if (hay.includes(w)) score += 2;
    return { t, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const m = amount > 0 ? Math.round(amount) : 100000;
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  if (!scored.length) {
    const dict = searchDictionary(question).slice(0, 3);
    let out = "Aucun modele exact. Conseils : identifier actif/charge/produit/dette, choisir le journal, equilibrer debit=credit, saisir dans le Brouillard.\n";
    for (const d of dict) out += `\n• ${d.term} : ${d.definition}`;
    return out;
  }
  const b = scored[0].t;
  return `Situation : ${b.label}\n${expli(b)}\n\nExemple avec ${fmt(m)} ${currency} :\n  Debit  ${b.debit} ${accountLabel(b.debit)}  ${fmt(m)}\n  Credit ${b.credit} ${accountLabel(b.credit)} ${fmt(m)}\n  Libelle : ${b.libelle}\n  Journal ${b.journal}\n\nEspace d'apprentissage uniquement — rien n'est ecrit dans le journal. Recopiez dans le Brouillard si besoin.`;
}

const AUDIENCES: { id: ReportAudience; label: string }[] = [
  { id: "dirigeants", label: "Dirigeants" },
  { id: "associes", label: "Associes" },
  { id: "banque", label: "Banque" },
  { id: "impots", label: "Impots" },
  { id: "cnss", label: "CNSS" },
  { id: "comptable", label: "Comptable" },
];

const CAT_LABEL: Record<DictEntry["category"], string> = {
  comptable: "Comptable", financier: "Financier", economique: "Economique",
  fiscal: "Fiscal", social: "Social", ohada: "OHADA",
};

export function AssistantPage() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const [tab, setTab] = useState<Tab>("modeles");
  const [amount, setAmount] = useState(100000);
  const [qModel, setQModel] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qDict, setQDict] = useState("");
  const [cat, setCat] = useState<DictEntry["category"] | "">("");
  const [audience, setAudience] = useState<ReportAudience>("dirigeants");
  const [report, setReport] = useState("");
  const [aiQ, setAiQ] = useState("");
  const [aiA, setAiA] = useState("");

  const filtered = useMemo(() => {
    const q = qModel.toLowerCase();
    if (!q) return ECRITURES_TYPES;
    return ECRITURES_TYPES.filter((e) => `${e.label} ${e.libelle} ${e.debit} ${e.credit}`.toLowerCase().includes(q));
  }, [qModel]);
  const selected = selectedId ? ECRITURES_TYPES.find((e) => e.id === selectedId) : null;
  const dictResults = useMemo(() => searchDictionary(qDict, cat || undefined), [qDict, cat]);
  const alerts = useMemo(() => diagnoseAccounting(data), [data.journal, data.employees, data.settings]);
  const actions = useMemo(() => suggestActions(data), [data.journal, data.employees, data.settings]);
  const crit = alerts.filter((a) => a.severity === "critique").length;

  return (
    <div>
      <PageHeader eyebrow="Intelligence assistee" title="Assistant · Dictionnaire · IA"
        description="Apprentissage des ecritures (sans impact journal), diagnostic, rapports, glossaire SYSCOHADA." />
      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ["modeles", "Apprendre les ecritures"],
          ["diagnostic", `Diagnostic IA${crit ? ` (${crit})` : ""}`],
          ["rapports", "Rapports IA"],
          ["dictionnaire", "Dictionnaire"],
        ] as const).map(([id, label]) => (
          <Button key={id} type="button" variant={tab === id ? "default" : "secondary"} onClick={() => setTab(id)}>{label}</Button>
        ))}
      </div>

      {tab === "modeles" ? (
        <div className="space-y-4">
          <Card className="border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium">Espace d&apos;apprentissage uniquement</p>
            <p className="mt-1 text-muted">Indiquez un montant pour un <strong>exemple concret</strong>. <strong>Aucune ecriture n&apos;est enregistree</strong> ici — utilisez le Brouillard pour saisir.</p>
          </Card>
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Montant d'exemple"><Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value) || 0)} /></Field>
              <Field label="Rechercher"><Input value={qModel} onChange={(e) => setQModel(e.target.value)} placeholder="achat, TVA, salaire…" /></Field>
            </div>
            <p className="mt-2 text-xs text-muted">{tax.currency} · {filtered.length} modele(s)</p>
          </Card>
          {selected ? (
            <Card className="space-y-3 border-primary/30 p-4">
              <p className="font-display text-lg">{selected.label}</p>
              <p className="text-sm text-muted">{expli(selected)}</p>
              <div className="rounded-[12px] border border-border bg-elevated/40 p-3 text-sm">
                <p>Debit <strong>{selected.debit} — {accountLabel(selected.debit)}</strong></p>
                <p>Credit <strong>{selected.credit} — {accountLabel(selected.credit)}</strong></p>
                <p className="text-xs text-muted">Journal {selected.journal} · {selected.libelle}</p>
              </div>
              {amount > 0 ? (
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-t border-border"><td className="py-2 font-mono text-xs">{selected.debit}</td><td>Debit</td><td className="text-right">{amount.toLocaleString("fr-FR")} {tax.currency}</td></tr>
                    <tr className="border-t border-border"><td className="py-2 font-mono text-xs">{selected.credit}</td><td>Credit</td><td className="text-right">{amount.toLocaleString("fr-FR")} {tax.currency}</td></tr>
                  </tbody>
                </table>
              ) : <p className="text-xs text-muted">Saisissez un montant pour l&apos;exemple chiffre.</p>}
            </Card>
          ) : null}
          <ul className="divide-y divide-border rounded-[12px] border border-border">
            {filtered.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div><p className="font-medium">{e.label}</p><p className="text-xs text-muted">{e.debit} → {e.credit} · {e.journal}</p></div>
                <Button type="button" variant={selectedId === e.id ? "default" : "secondary"} onClick={() => setSelectedId(e.id)}>Voir l&apos;exemple</Button>
              </li>
            ))}
          </ul>
          <Card className="space-y-3 p-4">
            <h2 className="font-display text-lg">Vous ne trouvez pas ? Posez une question a l&apos;IA</h2>
            <Field label="Votre question">
              <Input value={aiQ} onChange={(e) => setAiQ(e.target.value)} placeholder="Ex. Comment passer un reglement client par virement ?"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setAiA(answerQ(aiQ, amount, tax.currency)); toast.success("Reponse pedagogique (hors comptabilite)"); } }} />
            </Field>
            <Button type="button" onClick={() => { setAiA(answerQ(aiQ, amount, tax.currency)); toast.success("Reponse pedagogique (hors comptabilite)"); }}>Demander a l&apos;IA pedagogique</Button>
            {aiA ? <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-[12px] border border-border bg-elevated/30 p-4 text-xs">{aiA}</pre> : null}
          </Card>
        </div>
      ) : null}

      {tab === "diagnostic" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {alerts.length === 0 ? <Card className="p-6 text-sm text-muted sm:col-span-2">Aucune alerte majeure.</Card> : alerts.map((a) => (
              <Card key={a.id} className={cn("p-4", a.severity === "critique" && "border-danger/50")}><p className="text-xs text-muted">{a.severity}</p><p className="font-medium">{a.title}</p><p className="text-sm text-muted">{a.detail}</p></Card>
            ))}
          </div>
          {actions.length > 0 ? <Card className="p-4"><h2 className="font-display text-lg">Actions</h2><ul className="list-disc pl-5 text-sm">{actions.map((x, i) => <li key={i}>{typeof x === "string" ? x : String(x)}</li>)}</ul></Card> : null}
        </div>
      ) : null}

      {tab === "rapports" ? (
        <div className="space-y-4">
          <Card className="p-4 flex flex-wrap gap-3 items-end">
            <Field label="Destinataire">
              <select className="rounded border border-border bg-transparent px-2 py-1.5 text-sm" value={audience} onChange={(e) => setAudience(e.target.value as ReportAudience)}>
                {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </Field>
            <Button type="button" onClick={() => { setReport(generateReport(data, audience)); toast.success("Rapport redige"); }}>Rediger</Button>
            <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(report || generateReport(data, audience)).then(() => toast.success("Copie"))}>Copier</Button>
          </Card>
          {report ? <Card className="p-4"><pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap text-xs">{report}</pre></Card> : <Card className="p-6 text-sm text-muted">Choisissez un destinataire puis Rediger.</Card>}
        </div>
      ) : null}

      {tab === "dictionnaire" ? (
        <div className="space-y-4">
          <Card className="p-4 flex flex-wrap gap-3 items-end">
            <Field label="Rechercher"><Input value={qDict} onChange={(e) => setQDict(e.target.value)} placeholder="BFR, TVA, amortissement…" /></Field>
            <Field label="Categorie">
              <select className="rounded border border-border bg-transparent px-2 py-1.5 text-sm" value={cat} onChange={(e) => setCat(e.target.value as DictEntry["category"] | "")}>
                <option value="">Toutes</option>
                {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </Card>
          <ul className="space-y-2">{dictResults.map((e) => (
            <li key={e.term}><Card className="p-4"><p className="font-display">{e.term} <span className="text-xs text-muted">{CAT_LABEL[e.category]}</span></p><p className="text-sm">{e.definition}</p>{e.example ? <p className="text-xs italic text-muted">Ex. : {e.example}</p> : null}</Card></li>
          ))}</ul>
        </div>
      ) : null}
    </div>
  );
}
