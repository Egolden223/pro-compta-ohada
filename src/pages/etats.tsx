import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import {
  accountMovements,
  buildBalance,
  buildBilan,
  buildPnl,
  resultatNet,
} from "@/lib/engine";
import { PLAN_COMPTABLE, accountLabel } from "@/lib/accounts";
import { formatDate } from "@/lib/format";
import { countryByName } from "@/lib/countries";
import { cn } from "@/lib/utils";

export function JournalGeneralPage() {
  const journal = useAppStore((s) => s.journal);
  const currency = countryByName(useAppStore((s) => s.settings.country)).currency;
  const rows = [...journal].sort((a, b) => a.date.localeCompare(b.date) || a.piece.localeCompare(b.piece));
  return (
    <div>
      <PageHeader
        eyebrow="États"
        title="Journal général"
        description="Présentation débit / crédit de toutes les écritures du brouillard."
      />
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Pièce</th>
              <th className="px-3 py-2 text-left font-medium">Compte</th>
              <th className="px-3 py-2 text-left font-medium">Libellé</th>
              <th className="px-3 py-2 text-right font-medium">Débit</th>
              <th className="px-3 py-2 text-right font-medium">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((l) => [
              <tr key={`${l.id}-d`} className="border-t border-border">
                <td className="px-3 py-2">{formatDate(l.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.piece}</td>
                <td className="px-3 py-2">
                  {l.debit} · {accountLabel(l.debit)}
                </td>
                <td className="px-3 py-2">{l.libelle}</td>
                <td className="px-3 py-2 text-right">
                  <Money value={l.amount} currency={currency} />
                </td>
                <td className="px-3 py-2 text-right text-subtle">—</td>
              </tr>,
              <tr key={`${l.id}-c`} className="border-t border-border/60 bg-elevated/30">
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 pl-8">
                  {l.credit} · {accountLabel(l.credit)}
                </td>
                <td className="px-3 py-2">{l.libelle}</td>
                <td className="px-3 py-2 text-right text-subtle">—</td>
                <td className="px-3 py-2 text-right">
                  <Money value={l.amount} currency={currency} />
                </td>
              </tr>,
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GrandLivrePage() {
  const journal = useAppStore((s) => s.journal);
  const currency = countryByName(useAppStore((s) => s.settings.country)).currency;
  const used = useMemo(() => {
    const set = new Set<string>();
    journal.forEach((l) => {
      set.add(l.debit);
      set.add(l.credit);
    });
    return PLAN_COMPTABLE.filter((a) => set.has(a.code));
  }, [journal]);
  const [code, setCode] = useState(used[0]?.code ?? "701");
  const mvts = accountMovements(journal, code);
  let run = 0;
  return (
    <div>
      <PageHeader
        eyebrow="États"
        title="Grand livre"
        description="Fiche de compte : tous les mouvements et le solde progressif."
      />
      <div className="mb-4 max-w-md">
        <NativeSelect value={code} onChange={(e) => setCode(e.target.value)}>
          {used.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} — {a.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Pièce</th>
              <th className="px-3 py-2 text-left font-medium">Libellé</th>
              <th className="px-3 py-2 text-right font-medium">Débit</th>
              <th className="px-3 py-2 text-right font-medium">Crédit</th>
              <th className="px-3 py-2 text-right font-medium">Solde</th>
            </tr>
          </thead>
          <tbody>
            {mvts.map((l) => {
              const d = l.debit === code ? l.amount : 0;
              const c = l.credit === code ? l.amount : 0;
              run += d - c;
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDate(l.date)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.piece}</td>
                  <td className="px-3 py-2">{l.libelle}</td>
                  <td className="px-3 py-2 text-right">{d ? <Money value={d} currency={currency} /> : "—"}</td>
                  <td className="px-3 py-2 text-right">{c ? <Money value={c} currency={currency} /> : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={run} currency={currency} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {mvts.length === 0 ? <p className="p-6 text-sm text-muted">Aucun mouvement sur ce compte.</p> : null}
      </div>
    </div>
  );
}

export function BalancePage() {
  const journal = useAppStore((s) => s.journal);
  const currency = countryByName(useAppStore((s) => s.settings.country)).currency;
  const rows = buildBalance(journal);
  const totD = rows.reduce((s, r) => s + r.soldeD, 0);
  const totC = rows.reduce((s, r) => s + r.soldeC, 0);
  return (
    <div>
      <PageHeader
        eyebrow="États"
        title="Balance générale"
        description="Soldes débiteurs et créditeurs de tous les comptes mouvementés."
      />
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Compte</th>
              <th className="px-3 py-2 text-left font-medium">Intitulé</th>
              <th className="px-3 py-2 text-right font-medium">Mvt débit</th>
              <th className="px-3 py-2 text-right font-medium">Mvt crédit</th>
              <th className="px-3 py-2 text-right font-medium">Solde D</th>
              <th className="px-3 py-2 text-right font-medium">Solde C</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.debitMvt} currency={currency} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.creditMvt} currency={currency} />
                </td>
                <td className="px-3 py-2 text-right">
                  {r.soldeD ? <Money value={r.soldeD} currency={currency} /> : ""}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.soldeC ? <Money value={r.soldeC} currency={currency} /> : ""}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-strong bg-elevated font-medium">
              <td className="px-3 py-3" colSpan={4}>
                Totaux
              </td>
              <td className="px-3 py-3 text-right">
                <Money value={totD} currency={currency} />
              </td>
              <td className="px-3 py-3 text-right">
                <Money value={totC} currency={currency} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {totD !== totC ? (
        <p className="mt-3 text-sm text-warn">
          Écart de balance : <Money value={totD - totC} currency={currency} />. Ajoutez une écriture d’à-nouveaux
          (capital, stocks) pour équilibrer.
        </p>
      ) : (
        <p className="mt-3 text-sm text-accent">Balance équilibrée.</p>
      )}
    </div>
  );
}

export function ResultatPage() {
  const journal = useAppStore((s) => s.journal);
  const currency = countryByName(useAppStore((s) => s.settings.country)).currency;
  const blocks = buildPnl(journal);
  const net = resultatNet(journal);
  return (
    <div>
      <PageHeader
        eyebrow="SYSCOHADA"
        title="Compte de résultat"
        description="Forme simplifiée du système normal : marge, valeur ajoutée, EBE, résultats d’exploitation, financier et HAO."
      />
      <Card className="max-w-3xl p-0 overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {blocks.map((b) => (
              <tr
                key={b.label}
                className={cn("border-t border-border", b.total && "bg-elevated/50")}
              >
                <td className={cn("px-5 py-2.5", b.indent && "pl-10 text-muted", b.bold && "font-medium")}>
                  {b.label}
                </td>
                <td className={cn("px-5 py-2.5 text-right", b.bold && "font-medium")}>
                  <Money value={b.amount} currency={currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-4 font-display text-2xl">
        {net >= 0 ? "Bénéfice" : "Perte"} : <Money value={net} currency={currency} />
      </p>
    </div>
  );
}

export function BilanPage() {
  const journal = useAppStore((s) => s.journal);
  const currency = countryByName(useAppStore((s) => s.settings.country)).currency;
  const { actif, passif } = buildBilan(journal);
  const totA = actif[actif.length - 1]?.amount ?? 0;
  const totP = passif[passif.length - 1]?.amount ?? 0;
  return (
    <div>
      <PageHeader
        eyebrow="SYSCOHADA"
        title="Bilan"
        description="Actif et passif construits à partir des soldes de la balance, plus le résultat de l’exercice."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Side title="Actif" rows={actif} currency={currency} />
        <Side title="Passif" rows={passif} currency={currency} />
      </div>
      {Math.round(totA) !== Math.round(totP) ? (
        <p className="mt-4 text-sm text-warn">
          Écart actif / passif : <Money value={totA - totP} currency={currency} />. Normal tant que les à-nouveaux
          (capital, stocks d’ouverture) ne sont pas saisis.
        </p>
      ) : (
        <p className="mt-4 text-sm text-accent">Bilan équilibré.</p>
      )}
    </div>
  );
}

function Side({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: { label: string; amount: number; total?: boolean; indent?: number }[];
  currency: string;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-display text-lg">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={cn("border-t border-border", r.total && "bg-elevated/50 font-medium")}>
              <td className={cn("px-5 py-2.5", r.indent && "pl-10 text-muted")}>{r.label}</td>
              <td className="px-5 py-2.5 text-right">
                <Money value={r.amount} currency={currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
