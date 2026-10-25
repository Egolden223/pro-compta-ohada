import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { suggestBankMatches, buildBalance, fiscalDeadlines, kpis, computeIs } from "@/lib/engine";
import { COUNTRIES, countryByName } from "@/lib/countries";
import { formatDate, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BanquePage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const rows = buildBalance(data.journal);
  const bank = rows.find((r) => r.code === "521");
  const soldeCompta = (bank?.soldeD ?? 0) - (bank?.soldeC ?? 0);
  const theorique =
    soldeCompta + data.bankOutstandingChecks - data.bankOutstandingDeposits + data.bankAdjustments;
  const ecart = theorique - data.bankStatementBalance;
  const matches = suggestBankMatches(data.journal, data.bankImport || []);

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length) return;
      const sep = lines[0]!.includes(";") && !lines[0]!.includes(",") ? ";" : ",";
      const parsed = [];
      for (const line of lines) {
        const parts = line.split(sep).map((p) => p.trim());
        const d0 = parts[0] ?? "";
        if (!d0 || /date/i.test(d0)) continue;
        const debit = Number((parts[2] ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
        const credit = Number((parts[3] ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
        parsed.push({
          date: d0,
          libelle: parts[1] ?? "",
          debit,
          credit,
          matched: false,
        });
      }
      data.importBankCsv(parsed);
      toast.success(`${parsed.length} lignes importées.`);
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Trésorerie"
        title="Rapprochement bancaire"
        description="Comparez le solde du compte 521 avec votre relevé. Importez un CSV (Date;Libellé;Débit;Crédit)."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg">Compte 521 — Banques locales</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="(A) Solde comptable" v={<Money value={soldeCompta} currency={currency} />} />
            <Row
              k="(B) Chèques émis non débités"
              v={
                <Input
                  inputMode="decimal"
                  value={data.bankOutstandingChecks || ""}
                  onChange={(e) => data.setBank({ bankOutstandingChecks: Number(e.target.value) || 0 })}
                />
              }
            />
            <Row
              k="(C) Remises non créditées"
              v={
                <Input
                  inputMode="decimal"
                  value={data.bankOutstandingDeposits || ""}
                  onChange={(e) => data.setBank({ bankOutstandingDeposits: Number(e.target.value) || 0 })}
                />
              }
            />
            <Row
              k="(D) Régularisations"
              v={
                <Input
                  inputMode="decimal"
                  value={data.bankAdjustments || ""}
                  onChange={(e) => data.setBank({ bankAdjustments: Number(e.target.value) || 0 })}
                />
              }
            />
            <Row k="Solde banque théorique A+B−C+D" v={<Money value={theorique} currency={currency} />} />
            <Row
              k="Solde relevé bancaire"
              v={
                <Input
                  inputMode="decimal"
                  value={data.bankStatementBalance || ""}
                  onChange={(e) => data.setBank({ bankStatementBalance: Number(e.target.value) || 0 })}
                />
              }
            />
            <Row
              k="Écart (doit être 0)"
              v={<Money value={ecart} currency={currency} />}
            />
          </dl>
          {ecart === 0 ? (
            <p className="mt-3 text-sm text-accent">Rapprochement équilibré.</p>
          ) : (
            <p className="mt-3 text-sm text-warn">Écart à justifier (frais, dates de valeur, erreurs).</p>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-lg">Import CSV</h2>
          <p className="mt-1 text-sm text-muted">Colonnes : Date, Libellé, Débit, Crédit. Séparateur ; ou ,</p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-4 block text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </Card>
      </div>
      {data.bankImport.length ? (
        <div className="mt-6 overflow-x-auto rounded-[16px] border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Libellé</th>
                <th className="px-3 py-2 text-right font-medium">Débit</th>
                <th className="px-3 py-2 text-right font-medium">Crédit</th>
                <th className="px-3 py-2 text-left font-medium">Pointé</th>
              </tr>
            </thead>
            <tbody>
              {data.bankImport.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2">{l.date}</td>
                  <td className="px-3 py-2">{l.libelle}</td>
                  <td className="px-3 py-2 text-right">
                    {l.debit ? <Money value={l.debit} currency={currency} /> : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {l.credit ? <Money value={l.credit} currency={currency} /> : ""}
                  </td>
                  <td className="px-3 py-2">
                    <button className="text-sm text-accent" onClick={() => data.toggleBankMatch(l.id)}>
                      {l.matched ? "Oui" : "Non"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-32 text-right">{v}</dd>
    </div>
  );
}

export function FiscalitePage() {
  const settings = useAppStore((s) => s.settings);
  const update = useAppStore((s) => s.updateSettings);
  const current = countryByName(settings.country);
  return (
    <div>
      <PageHeader
        eyebrow="OHADA"
        title="Fiscalité des 17 États"
        description="Les taux de TVA, d’IS et les délais de déclaration suivent le pays choisi dans Paramètres. Données de référence 2026 — à confirmer auprès de l’administration locale."
      />
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Pays</th>
              <th className="px-3 py-2 text-left font-medium">Zone</th>
              <th className="px-3 py-2 text-left font-medium">Devise</th>
              <th className="px-3 py-2 text-right font-medium">TVA</th>
              <th className="px-3 py-2 text-right font-medium">IS</th>
              <th className="px-3 py-2 text-right font-medium">IS min.</th>
              <th className="px-3 py-2 text-right font-medium">TVA j.</th>
              <th className="px-3 py-2 text-right font-medium">CNSS j.</th>
            </tr>
          </thead>
          <tbody>
            {COUNTRIES.map((c) => (
              <tr
                key={c.country}
                className={cn(
                  "border-t border-border cursor-pointer hover:bg-elevated/40",
                  c.country === settings.country && "bg-accent/10",
                )}
                onClick={() => {
                  update({ country: c.country });
                  toast.success(`Pays : ${c.country}`);
                }}
              >
                <td className="px-3 py-2 font-medium">{c.country}</td>
                <td className="px-3 py-2">{c.zone}</td>
                <td className="px-3 py-2">{c.currency}</td>
                <td className="px-3 py-2 text-right">{formatPct(c.vat)}</td>
                <td className="px-3 py-2 text-right">{formatPct(c.isRate)}</td>
                <td className="px-3 py-2 text-right">{formatPct(c.isMin)}</td>
                <td className="px-3 py-2 text-right">{c.vatDay}</td>
                <td className="px-3 py-2 text-right">{c.cnssDay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-3xl text-sm text-muted">{current.notes} · {current.reliability}</p>
    </div>
  );
}

export function TvaPage() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const collected = data.journal.filter((l) => l.credit === "4431").reduce((s, l) => s + l.amount, 0);
  const deduct = data.journal.filter((l) => l.debit.startsWith("445")).reduce((s, l) => s + l.amount, 0);
  const credit = data.vatCreditBroughtForward || 0;
  const due = collected - deduct - credit;
  const deadlines = fiscalDeadlines(data);
  const setVatCredit = useAppStore((s) => s.setVatCredit);
  return (
    <div>
      <PageHeader
        eyebrow="Déclarations"
        title="TVA"
        description={`Taux ${formatPct(tax.vat)} · déclaration le ${tax.vatDay} de chaque mois (${data.settings.country}).`}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">TVA collectée (4431)</p>
          <p className="mt-2 font-display text-2xl">
            <Money value={collected} currency={tax.currency} />
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">TVA déductible (445x)</p>
          <p className="mt-2 font-display text-2xl">
            <Money value={deduct} currency={tax.currency} />
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">{due >= 0 ? "TVA à décaisser" : "Crédit de TVA"}</p>
          <p className="mt-2 font-display text-2xl">
            <Money value={due} currency={tax.currency} />
          </p>
        </Card>
      </div>
            <Card className="mt-4 p-4">
        <Field label="Crédit de TVA reporté (période précédente)">
          <Input
            type="number"
            value={credit}
            onChange={(e) => setVatCredit(Number(e.target.value) || 0)}
          />
        </Field>
      </Card>
<p className="mt-4 text-sm text-muted">
        Prochaine échéance : {formatDate(deadlines[0]!.date)} ({deadlines[0]!.days} jours).
      </p>
    </div>
  );
}

export function ImpotPage() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const k = kpis(data);
  const isCalc = computeIs(data);
  const theorique = isCalc.isTheorique;
  const minimum = isCalc.isMinimum;
  const due = isCalc.isDue;
  const postIs = useAppStore((s) => s.postIs);
  return (
    <div>
      <PageHeader
        eyebrow="Déclarations"
        title="Impôt sur les sociétés"
        description={`Taux ${formatPct(tax.isRate)} · minimum ${formatPct(tax.isMin)} du CA. DSF : ${tax.isDay}/${String(tax.isMonth).padStart(2, "0")} suivant la clôture.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Résultat net comptable</p>
          <p className="mt-2 font-display text-2xl">
            <Money value={k.rn} currency={tax.currency} />
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">IS théorique</p>
          <p className="mt-2 font-display text-2xl">
            <Money value={theorique} currency={tax.currency} />
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Minimum forfaitaire</p>
          <p className="mt-2 font-display text-2xl">
            <Money value={minimum} currency={tax.currency} />
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">IS dû (max des deux)</p>
          <p className="mt-2 font-display text-2xl">
            <Money value={due} currency={tax.currency} />
          </p>
        </Card>
      </div>
      <Card className="mt-4 space-y-3 p-4">
        <p className="text-sm text-muted">
          Résultat avant IS : {isCalc.resultatComptable.toLocaleString("fr-FR")} · Fiscal :{" "}
          {isCalc.resultatFiscal.toLocaleString("fr-FR")} (après réintégrations / déductions / déficits)
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Réintégrations">
            <Input
              type="number"
              value={data.fiscalReintegrations || 0}
              onChange={(e) => data.setFiscal({ fiscalReintegrations: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Déductions">
            <Input
              type="number"
              value={data.fiscalDeductions || 0}
              onChange={(e) => data.setFiscal({ fiscalDeductions: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Déficit imputé">
            <Input
              type="number"
              value={data.deficitImputed || 0}
              onChange={(e) => data.setFiscal({ deficitImputed: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <Button
          type="button"
          onClick={() => {
            const err = postIs();
            if (err) toast.error(err);
            else toast.success("IS comptabilisé (891 / 441).");
          }}
        >
          Comptabiliser l&apos;IS dans le brouillard
        </Button>
      </Card>
    
      {matches.length > 0 ? (
        <Card className="mt-4 p-4">
          <h2 className="mb-2 font-display text-lg">Rapprochements suggérés</h2>
          <ul className="space-y-2 text-sm">
            {matches.slice(0, 15).map((m) => (
              <li key={m.bankId + m.journalId} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Score {m.score} — banque {m.bankId.slice(0, 6)} ↔ écriture {m.journalId.slice(0, 6)}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    data.applyBankMatch(m.bankId, m.journalId);
                    toast.success("Rapprochement appliqué");
                  }}
                >
                  Rapprocher
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
</div>
  );
}
