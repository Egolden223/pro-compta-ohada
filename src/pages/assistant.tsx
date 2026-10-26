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
  achat_march: "Facture fournisseur non payée : débit 601 (achats), crédit 401 (fournisseur). Enregistrer à la date de facture, pas du règlement (Guide SYSCOHADA).",
  tva_ach: "TVA déductible sur achat de biens/services : débit 4452, crédit 401. Taux selon le pays (souvent 18 %).",
  achat_march_bq: "Achat payé immédiatement par virement : débit 601, crédit 521. Pas de dette fournisseur.",
  achat_march_caisse: "Achat payé en espèces : débit 601, crédit 571.",
  frais_achats: "Frais accessoires (transport, transit) rattachés aux achats : 6015 (ou subdivision) selon le Guide d'application.",
  rrr_obtenus: "Remises, rabais, ristournes obtenus : crédit 6019 (réductions sur achats), débit 401 si sur facture d'avoir.",
  escompte_obtenu: "Escompte de règlement obtenu du fournisseur : crédit 773, débit 401 au moment du paiement.",
  achat_fourn_ns: "Fournitures non stockées (classe 60) : 604 / 605 selon nature.",
  avoir_fourn: "Retour de marchandises ou avoir fournisseur : sens inverse de l'achat (débit 401, crédit 601).",
  vente_credit: "Vente à crédit HT : débit 411 clients, crédit 701. La créance naît à la facturation.",
  tva_vte: "TVA collectée sur ventes : débit 411 (TTC), crédit 4431. Régime des débits usuel OHADA.",
  vente_caisse: "Vente comptant espèces : débit 571, crédit 701 (+ 4431 pour la TVA si applicable).",
  vente_bq: "Vente encaissée par virement : débit 521, crédit 701.",
  presta_services: "Prestations de services : crédit 706 (et non 701). TVA souvent au même schéma 4431.",
  ports_factures: "Ports et frais refacturés au client : crédit 707, débit 411.",
  escompte_accorde: "Escompte accordé au client lors du règlement : débit 673, crédit 411.",
  avoir_client: "Avoir client (retour ou remise) : débit 701 (ou 709), crédit 411.",
  avance_client: "Acompte reçu d'un client avant livraison : crédit 419 (clients créditeurs), débit banque.",
  avance_fourn: "Acompte versé au fournisseur : débit 409 (fournisseurs débiteurs), crédit banque.",
  regl_client_bq: "Encaissement client par banque : débit 521, crédit 411. Ne crée pas une deuxième vente.",
  regl_client_caisse: "Encaissement client en espèces : débit 571, crédit 411.",
  regl_client_mm: "Encaissement mobile money : débit compte trésorerie mobile (ex. 538), crédit 411.",
  regl_fourn: "Paiement fournisseur par banque : débit 401, crédit 521.",
  regl_fourn_caisse: "Paiement fournisseur en espèces : débit 401, crédit 571.",
  frais_bancaires: "Commissions et frais de tenue de compte : débit 631, crédit 521.",
  loyer: "Loyers et charges locatives : débit 622, crédit 401 (ou 521 si payé).",
  eau_elec: "Eau et électricité : débit 605, crédit 401.",
  telecom: "Télécommunications : débit 628, crédit 401.",
  honoraires: "Honoraires, experts, intermédiaires : débit 632, crédit 401.",
  assurance: "Primes d'assurance : débit 625, crédit 401.",
  entretien: "Entretien et réparations : débit 624, crédit 401.",
  publicite: "Publicité et relations publiques : débit 627, crédit 401.",
  achat_immo: "Acquisition d'immobilisation à crédit : débit classe 2 (ex. 245 transport), crédit 481 fournisseurs d'investissements.",
  tva_immo: "TVA récupérable sur immobilisations : débit 4451 (pas 4452), crédit 481.",
  achat_immo_bq: "Immobilisation payée comptant : débit classe 2, crédit 521.",
  regl_fourn_immo: "Règlement du fournisseur d'immobilisations : débit 481, crédit 521.",
  dot_amort: "Dotation aux amortissements d'exploitation : débit 681, crédit 28x (subdivision selon le bien).",
  dot_amort_transp: "Amortissement du matériel de transport : 681 / 2845 (exemple de subdivision).",
  var_stock: "Inventaire intermittent — sortie de stock : débit 6031 variation, crédit 311 stocks marchandises.",
  var_stock_entree: "Constatation d'un stock final supérieur : débit 311, crédit 6031.",
  var_stock_mp: "Variation des stocks de matières premières : 6032 / 321.",
  salaire_brut: "Constatation du salaire brut : débit 661, crédit 422 (rémunérations dues). Puis ventilations des retenues.",
  charges_pat: "Charges patronales (CNSS, etc.) : débit 664, crédit 431.",
  retenue_cnss_sal: "Part salariale CNSS prélevée : débit 422, crédit 431.",
  retenue_iuts: "IUTS / IRPP retenu sur salaire : débit 422, crédit 447 (État).",
  paiement_salaires: "Virement du net à payer : débit 422, crédit 521.",
  paiement_cnss: "Paiement des cotisations aux organismes sociaux : débit 431, crédit 521.",
  liq_tva_due: "Centralisation fin de période si TVA collectée > déductible : débit 4431, crédit 4441 (TVA due).",
  liq_tva_credit: "Si TVA déductible > collectée : crédit de TVA à reporter (schéma 444 / 445).",
  paiement_tva: "Paiement de la TVA due à l'administration : débit 4441, crédit 521.",
  ras_presta: "Retenue à la source sur prestations : diminution de la dette fournisseur, crédit 447.",
  paiement_is: "Acompte ou solde d'impôt sur les sociétés : débit compte IS, crédit banque.",
  emprunt_bq: "Mise à disposition d'un emprunt : débit 521, crédit 162 (emprunts établissements de crédit).",
  remb_emprunt: "Remboursement du capital d'emprunt : débit 162, crédit 521.",
  interets_emprunt: "Intérêts d'emprunt : débit 671, crédit 521 (ou 166 intérêts courus).",
  capital_bq: "Libération du capital social versé en banque : débit 521, crédit 101.",
  subvention_inv: "Subvention d'équipement reçue : débit 521, crédit 14 (subventions d'investissement).",
  prov_clients: "Dépréciation des créances douteuses : débit 691, crédit 491.",
  prov_risques: "Provision pour risques et charges : débit 691, crédit 191.",
  reprise_prov: "Reprise devenue sans objet : débit 491, crédit 791 (reprises).",
  affect_reserve: "Affectation du bénéfice : dotation à la réserve légale (souvent 5 %) — schéma 12 / 111.",
  facture_achat_ttc: "Facture d'achat complète (SYSCOHADA) : HT en 601, TVA récupérable 4452, TTC en 401. Taux courant OHADA 18 %. Enregistrer à la date de facture.",
  facture_vente_ttc: "Facture de vente complète : client 411 pour le TTC, produit 701 pour le HT, TVA collectée 4431. Ne jamais créditer 701 du TTC.",
  facture_presta_ttc: "Prestation de services vendue : même schéma que la vente, mais produit 706 (pas 701). TVA 4431 ou 4432 selon subdivision.",
  presta_ras: "Prestation reçue d'un tiers avec retenue à la source (ex. 5 % HT au Sénégal sur PP). Charge HT, dette fournisseur = HT − RAS, État 447 = RAS. Taux et seuils varient selon le pays.",
  presta_tva_ras: "Prestation reçue avec TVA + RAS : charge HT, TVA 4452, RAS 447, fournisseur = HT + TVA − RAS. Vérifier le taux RAS du pays (SN ~5 %, BF 1–5–20 %, CI non-résidents ~20 %).",
  facture_immo_ttc: "Immobilisation : débit classe 2 (HT), TVA 4451 (pas 4452), crédit 481 fournisseurs d'investissements (TTC).",

};



/** Montant saisi = HT. Construit l'exemple multi-lignes TVA / RAS. */
function formatExample(t: EcritureType, amount: number, currency: string): string {
  const m = Math.max(0, Math.round(amount || 0)) || 100000;
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  const rate = t.tvaRate ?? 0.18;
  const rasR = t.rasRate ?? 0.05;
  const tva = Math.round(m * rate);
  const ras = Math.round(m * rasR);
  const ttc = m + tva;
  const lines: string[] = [];
  const push = (d: string, c: string, amt: number, lib: string) => {
    lines.push(`  Débit  ${d.padEnd(6)} ${accountLabel(d).slice(0, 28).padEnd(28)} ${fmt(amt)}`);
    lines.push(`  Crédit ${c.padEnd(6)} ${accountLabel(c).slice(0, 28).padEnd(28)} ${fmt(amt)}`);
    lines.push(`  (${lib})`);
  };
  switch (t.schema) {
    case "tva_achat":
      lines.push(`Montant HT ${fmt(m)} · TVA ${(rate * 100).toFixed(0)} % = ${fmt(tva)} · TTC ${fmt(ttc)} ${currency}`);
      lines.push(`  Débit  601    Achats de marchandises           ${fmt(m)}`);
      lines.push(`  Débit  4452   TVA récupérable sur achats        ${fmt(tva)}`);
      lines.push(`  Crédit 401    Fournisseurs                     ${fmt(ttc)}`);
      lines.push(`  Journal ACH — date de facture (pas de règlement)`);
      break;
    case "tva_vente":
      lines.push(`Montant HT ${fmt(m)} · TVA ${(rate * 100).toFixed(0)} % = ${fmt(tva)} · TTC ${fmt(ttc)} ${currency}`);
      lines.push(`  Débit  411    Clients                          ${fmt(ttc)}`);
      lines.push(`  Crédit 701    Ventes de marchandises           ${fmt(m)}`);
      lines.push(`  Crédit 4431   TVA facturée / collectée          ${fmt(tva)}`);
      lines.push(`  Journal VTE`);
      break;
    case "tva_presta":
      lines.push(`Montant HT ${fmt(m)} · TVA ${(rate * 100).toFixed(0)} % = ${fmt(tva)} · TTC ${fmt(ttc)} ${currency}`);
      lines.push(`  Débit  411    Clients                          ${fmt(ttc)}`);
      lines.push(`  Crédit 706    Prestations de services           ${fmt(m)}`);
      lines.push(`  Crédit 4431   TVA facturée                      ${fmt(tva)}`);
      lines.push(`  Journal VTE — produit 706 (services), pas 701`);
      break;
    case "ras_presta":
      lines.push(`Prestation HT ${fmt(m)} · RAS ${(rasR * 100).toFixed(0)} % = ${fmt(ras)} · Net fournisseur ${fmt(m - ras)} ${currency}`);
      lines.push(`  Débit  632    Honoraires / prestations           ${fmt(m)}`);
      lines.push(`  Crédit 401    Fournisseurs (net)                ${fmt(m - ras)}`);
      lines.push(`  Crédit 447    État, impôts retenus à la source  ${fmt(ras)}`);
      lines.push(`  Puis paiement : Débit 401 / Crédit 521 (net)`);
      lines.push(`  Reversement RAS : Débit 447 / Crédit 521`);
      lines.push(`  Taux indicatif (ex. SN 5 % HT si facture ≥ seuil). Vérifier le pays.`);
      break;
    case "tva_ras_presta": {
      const netF = m + tva - ras;
      lines.push(`HT ${fmt(m)} · TVA ${fmt(tva)} · RAS ${fmt(ras)} · Net à payer fournisseur ${fmt(netF)} ${currency}`);
      lines.push(`  Débit  632    Prestations / honoraires            ${fmt(m)}`);
      lines.push(`  Débit  4452   TVA récupérable                     ${fmt(tva)}`);
      lines.push(`  Crédit 401    Fournisseurs                        ${fmt(netF)}`);
      lines.push(`  Crédit 447    État, RAS                           ${fmt(ras)}`);
      lines.push(`  Journal ACH — RAS calculée sur HT (règles nationales)`);
      break;
    }
    case "tva_immo":
      lines.push(`HT ${fmt(m)} · TVA ${(rate * 100).toFixed(0)} % = ${fmt(tva)} · TTC ${fmt(ttc)} ${currency}`);
      lines.push(`  Débit  245    Matériel de transport (ex.)         ${fmt(m)}`);
      lines.push(`  Débit  4451   TVA récupérable immobilisations     ${fmt(tva)}`);
      lines.push(`  Crédit 481    Fournisseurs d'investissements      ${fmt(ttc)}`);
      lines.push(`  Attention : TVA immo = 4451 (pas 4452)`);
      break;
    default:
      lines.push(`Exemple avec ${fmt(m)} ${currency} :`);
      lines.push(`  Débit  ${t.debit.padEnd(6)} ${accountLabel(t.debit).slice(0, 28).padEnd(28)} ${fmt(m)}`);
      lines.push(`  Crédit ${t.credit.padEnd(6)} ${accountLabel(t.credit).slice(0, 28).padEnd(28)} ${fmt(m)}`);
      lines.push(`  Libellé : ${t.libelle} · Journal ${t.journal}`);
  }
  lines.push("");
  lines.push("Espace d'apprentissage uniquement — rien n'est écrit dans le journal. Recopiez ligne par ligne dans le Brouillard si besoin.");
  return lines.join("\n");
}


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
  return `Situation : ${b.label}\n${expli(b)}\n\n${formatExample(b, m, currency)}`;
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
              {selected.schema && selected.schema !== "simple" ? (
                <p className="text-xs text-amber-600/90">Schéma multi-lignes (HT + TVA / RAS) — le montant saisi est traité comme hors taxes.</p>
              ) : null}
              <pre className="whitespace-pre-wrap rounded-[12px] border border-border bg-elevated/40 p-3 font-mono text-xs leading-relaxed">
{formatExample(selected, amount, tax.currency)}
              </pre>
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
