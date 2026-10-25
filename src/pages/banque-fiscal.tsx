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
      if (parsed.length) {
        data.importBankCsv(parsed as any);
        toast.success(`${parsed.length} lignes importées`);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Trésorerie"
        title="Banque"
        description="Rapprochement bancaire, import CSV et solde théorique."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Solde comptable (521)</p>
          <p className="mt-1 font-display text-xl">
            <Money value={soldeCompta} currency={currency} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Solde relevé</p>
          <p className="mt-1 font-display text-xl">
            <Money value={data.bankStatementBalance} currency={currency} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Théorique</p>
          <p className="mt-1 font-display text-xl">
            <Money value={theorique} currency={currency} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Écart</p>
          <p className={cn("mt-1 font-display text-xl", Math.abs(ecart) > 1 ? "text-danger" : "")}>
            <Money value={ecart} currency={currency} />
          </p>
        </Card>
      </div>

      <Card className="mb-4 space-y-3 p-4">
        <h2 className="font-display text-lg">Paramètres de rapprochement</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Solde relevé bancaire">
            <Input
              inputMode="decimal"
              value={data.bankStatementBalance || ""}
              onChange={(e) => data.setBank({ bankStatementBalance: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Chèques non débités">
            <Input
              inputMode="decimal"
              value={data.bankOutstandingChecks || ""}
              onChange={(e) => data.setBank({ bankOutstandingChecks: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Remises non créditées">
            <Input
              inputMode="decimal"
              value={data.bankOutstandingDeposits || ""}
              onChange={(e) => data.setBank({ bankOutstandingDeposits: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Ajustements">
            <Input
              inputMode="decimal"
              value={data.bankAdjustments || ""}
              onChange={(e) => data.setBank({ bankAdjustments: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <div>
          <label className="text-sm text-muted">Import CSV (date;libellé;débit;crédit)</label>
          <Input
            type="file"
            accept=".csv,text/csv"
            className="mt-1"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </div>
      </Card>

      {(data.bankImport || []).length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Libellé</th>
                <th className="px-3 py-2 text-right">Débit</th>
                <th className="px-3 py-2 text-right">Crédit</th>
                <th className="px-3 py-2">Rapproché</th>
              </tr>
            </thead>
            <tbody>
              {(data.bankImport || []).map((l) => (
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
        description="Taux TVA, IS, cotisations sociales et échéances par pays."
      />
      <Card className="mb-4 p-4">
        <Field label="Pays de l'entreprise">
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={settings.country}
            onChange={(e) => update({ country: e.target.value })}
          >
            {COUNTRIES.map((c) => (
              <option key={c.country} value={c.country}>
                {c.country}
              </option>
            ))}
          </select>
        </Field>
        <p className="mt-3 text-sm text-muted">{current.notes}</p>
        <p className="mt-1 text-xs text-muted">Fiabilité : {current.reliability}</p>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Pays</th>
              <th className="px-3 py-2">TVA</th>
              <th className="px-3 py-2">IS</th>
              <th className="px-3 py-2">Min.</th>
              <th className="px-3 py-2">CNSS j+</th>
            </tr>
          </thead>
          <tbody>
            {COUNTRIES.map((c) => (
              <tr key={c.country} className="border-t border-border">
                <td className="px-3 py-2">{c.country}</td>
                <td className="px-3 py-2">{formatPct(c.vat)}</td>
                <td className="px-3 py-2">{formatPct(c.isRate)}</td>
                <td className="px-3 py-2">{formatPct(c.isMin)}</td>
                <td className="px-3 py-2">{c.cnssDay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TvaPage() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const k = kpis(data);
  return (
    <div>
      <PageHeader
        eyebrow="Déclarations"
        title="TVA"
        description={`Taux ${formatPct(tax.vat)} · déclaration typique le ${tax.vatDay} du mois suivant.`}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">TVA collectée</p>
          <p className="mt-1 font-display text-xl">
            <Money value={k.tvaCollected || 0} currency={tax.currency} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">TVA déductible</p>
          <p className="mt-1 font-display text-xl">
            <Money value={k.tvaDeductible || 0} currency={tax.currency} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Net à payer / crédit</p>
          <p className="mt-1 font-display text-xl">
            <Money value={(k.tvaCollected || 0) - (k.tvaDeductible || 0)} currency={tax.currency} />
          </p>
        </Card>
      </div>
      <Card className="mt-4 p-4 text-sm text-muted">
        Crédit de TVA reporté : {(data.vatCreditBroughtForward || 0).toLocaleString("fr-FR")} {tax.currency}.
        Ajustez dans Paramètres / import si besoin.
      </Card>
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
    </div>
  );
}
