import { useMemo, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { countryByName } from "@/lib/countries";
import {
  buildDeclarationCalendar,
  defaultDeclarationObligations,
  estimateDeclarationAmounts,
  computeAcomptesIs,
  buildPrintableDeclarations,
  declarationToHtml,
} from "@/lib/engine";
import { todayISO, cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  en_retard: "En retard",
  urgent: "Urgent (≤ 10 j)",
  a_venir: "À venir",
  fait: "Fait",
};

export function EcheancesPage() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const currency = tax.currency;
  const [period, setPeriod] = useState(todayISO().slice(0, 7));

  useEffect(() => {
    if (!(data.declarationObligations || []).length) {
      data.resetDeclarationObligations();
    }
  }, []);

  const estimates = useMemo(
    () => estimateDeclarationAmounts(data.journal, data.employees, tax),
    [data.journal, data.employees, tax],
  );

  const calendar = useMemo(
    () =>
      buildDeclarationCalendar(
        data.declarationObligations?.length
          ? data.declarationObligations
          : defaultDeclarationObligations(tax),
        data.declarationsDone || [],
        todayISO(),
        estimates,
      ),
    [data.declarationObligations, data.declarationsDone, data.journal, data.employees, tax],
  );

  const printable = useMemo(
    () =>
      buildPrintableDeclarations(
        {
          journal: data.journal,
          employees: data.employees,
          settings: data.settings,
          isBaseN1: data.isBaseN1,
          acomptesIsPaid: data.acomptesIsPaid,
          fiscalReintegrations: data.fiscalReintegrations,
          fiscalDeductions: data.fiscalDeductions,
        },
        period,
        tax,
      ),
    [data.journal, data.employees, data.settings, data.isBaseN1, data.acomptesIsPaid, data.fiscalReintegrations, data.fiscalDeductions, period, tax],
  );

  const urgent = calendar.filter((r) => r.status === "en_retard" || r.status === "urgent");
  const upcoming = calendar.filter((r) => r.status === "a_venir");
  const done = calendar.filter((r) => r.status === "fait");

  function mark(obligationId: string, periodKey: string, doneFlag: boolean) {
    if (doneFlag) {
      data.markDeclarationDone(obligationId, periodKey);
      toast.success("Marqué comme fait");
    } else {
      data.unmarkDeclarationDone(obligationId, periodKey);
      toast("Marqué non fait");
    }
  }

  function printOne(kind: string) {
    const decl = printable.find((p) => p.kind === kind);
    if (!decl) {
      toast.error("État introuvable");
      return;
    }
    const html = declarationToHtml(decl, data.settings, currency);
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }

  function printAll() {
    const blocks = printable
      .map((d) => declarationToHtml(d, data.settings, currency))
      .map((html) => {
        const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;
        return `<section style="page-break-after:always">${body}</section>`;
      })
      .join("\n");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>États déclaratifs ${period}</title>
<style>
body{font-family:system-ui,sans-serif;font-size:12px}
h1{font-size:16px}h2{font-size:14px;border-bottom:1px solid #ccc}
table{width:100%;border-collapse:collapse}th,td{padding:4px 6px;border-bottom:1px solid #eee}
.r{text-align:right}.tot{font-weight:700;background:#f0f0f0}
.box{border:1px solid #ddd;padding:8px;border-radius:6px}
.meta{color:#444;font-size:11px}
@media print{section{page-break-after:always}}
</style></head><body>${blocks}</body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Fiscal & social"
        title="Échéances & états déclaratifs"
        description={`Calcul automatique ${data.settings.country} · impression de chaque état ou de tous.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => data.resetDeclarationObligations()}>
              Réinit. calendrier
            </Button>
            <Button type="button" onClick={printAll}>
              Tout imprimer
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Période de calcul (AAAA-MM)">
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
      </div>

      {/* États calculés auto + imprimables */}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3 font-display">
          États calculés automatiquement — {period}
        </div>
        <ul className="divide-y divide-border">
          {printable.map((d) => (
            <li key={d.kind} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-xs text-muted">
                  {d.organism} · {d.periodLabel} · {d.lines.length} ligne(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">
                  <Money value={d.total} currency={currency} />
                </span>
                <Button type="button" variant="secondary" onClick={() => printOne(d.kind)}>
                  Imprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-4 p-4">
        <h2 className="mb-2 font-display text-lg">Acomptes provisionnels IS · IMF / IRM</h2>
        <p className="mb-3 text-xs text-muted">
          Calcul auto à partir du journal et de la base IS N-1. L&apos;IMF/IRM est le plancher
          minimum (CA × taux min.). Imprimable ci-dessus (IS_ACOMPTE, IMF).
        </p>
        <AcomptesPanel />
      </Card>

      {urgent.length > 0 ? (
        <Card className="mb-4 border-danger/40 bg-danger/5 p-4">
          <h2 className="mb-2 font-display text-lg text-danger">
            À traiter en priorité ({urgent.length})
          </h2>
          <ul className="space-y-2">
            {urgent.map((r) => (
              <ReminderRow key={r.id} r={r} currency={currency} onToggle={mark} />
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="mb-4 p-4 text-sm text-muted">
          Aucune échéance urgente ou en retard pour le moment.
        </Card>
      )}

      <Card className="mb-4 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3 font-display">Prochaines échéances</div>
        <ul className="divide-y divide-border">
          {upcoming.slice(0, 20).map((r) => (
            <ReminderRow key={r.id} r={r} currency={currency} onToggle={mark} />
          ))}
          {upcoming.length === 0 ? (
            <li className="p-6 text-sm text-muted">Aucune échéance à venir dans la fenêtre.</li>
          ) : null}
        </ul>
      </Card>

      {done.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3 font-display text-muted">
            Déjà marquées faites
          </div>
          <ul className="divide-y divide-border opacity-70">
            {done.slice(0, 15).map((r) => (
              <ReminderRow key={r.id} r={r} currency={currency} onToggle={mark} />
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="mt-4 text-xs text-muted">
        Tous les montants sont recalculés depuis le journal et la paie. Les documents imprimés sont
        préparatoires : déposez-les ensuite sur les portails officiels DGI / caisse sociale.
      </p>
    </div>
  );
}

function ReminderRow({
  r,
  currency,
  onToggle,
}: {
  r: {
    id: string;
    obligationId: string;
    periodLabel: string;
    dueDate: string;
    status: string;
    amountEstimate: number;
  };
  currency: string;
  onToggle: (obligationId: string, periodKey: string, done: boolean) => void;
}) {
  const periodKey = r.id.startsWith(r.obligationId + "_")
    ? r.id.slice(r.obligationId.length + 1)
    : r.id;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
      <div>
        <p className="font-medium">{r.periodLabel}</p>
        <p className="text-xs text-muted">
          Échéance {r.dueDate} ·{" "}
          <span
            className={cn(
              r.status === "en_retard" && "text-danger font-semibold",
              r.status === "urgent" && "text-amber-600 font-semibold",
            )}
          >
            {STATUS_LABEL[r.status] || r.status}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        {r.amountEstimate > 0 ? (
          <Money value={r.amountEstimate} currency={currency} />
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
        {r.status === "fait" ? (
          <Button type="button" variant="ghost" onClick={() => onToggle(r.obligationId, periodKey, false)}>
            Annuler
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={() => onToggle(r.obligationId, periodKey, true)}>
            Marquer fait
          </Button>
        )}
      </div>
    </li>
  );
}

function AcomptesPanel() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const currency = tax.currency;
  let ca = 0;
  let charges = 0;
  for (const l of data.journal) {
    if (l.credit.startsWith("7")) ca += l.amount;
    if (l.debit.startsWith("6")) charges += l.amount;
  }
  const resultatFiscal =
    ca - charges + (data.fiscalReintegrations || 0) - (data.fiscalDeductions || 0);
  const ac = computeAcomptesIs({
    caYear: ca,
    resultatFiscal,
    tax,
    isBaseN1: data.isBaseN1 || 0,
    acomptesPaid: data.acomptesIsPaid || [],
    nbAcomptes: data.settings.country === "Bénin" ? 4 : 3,
  });

  return (
    <div>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[10px] border border-border p-3">
          <p className="text-xs text-muted">IS théorique</p>
          <p className="font-semibold">
            <Money value={ac.isTheorique} currency={currency} />
          </p>
        </div>
        <div className="rounded-[10px] border border-border p-3">
          <p className="text-xs text-muted">IMF / IRM (min.)</p>
          <p className="font-semibold">
            <Money value={ac.imf} currency={currency} />
          </p>
        </div>
        <div className="rounded-[10px] border border-border p-3">
          <p className="text-xs text-muted">Montant d&apos;un acompte</p>
          <p className="font-semibold">
            <Money value={ac.montantAcompte} currency={currency} />
          </p>
        </div>
        <div className="rounded-[10px] border border-border p-3">
          <p className="text-xs text-muted">Solde estimé</p>
          <p className="font-semibold">
            <Money value={ac.soldeEstime} currency={currency} />
          </p>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          Base IS N-1 (pour acomptes)
          <input
            type="number"
            className="ml-2 rounded border border-border bg-transparent px-2 py-1 text-sm"
            defaultValue={data.isBaseN1 || ""}
            onBlur={(e) => data.setIsBaseN1(Number(e.target.value) || 0)}
          />
        </label>
      </div>
      <ul className="space-y-2 text-sm">
        {ac.detail.map((d) => (
          <li
            key={d.num}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2"
          >
            <span>
              {d.label} — dû <Money value={d.amount} currency={currency} />
              {d.paid > 0 ? (
                <span className="ml-2 text-xs text-muted">
                  (payé <Money value={d.paid} currency={currency} />)
                </span>
              ) : null}
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                data.recordAcompteIs(`T${d.num}`, d.amount);
                toast.success(`Acompte n°${d.num} enregistré`);
              }}
            >
              Enregistrer paiement
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
