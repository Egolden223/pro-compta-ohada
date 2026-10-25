import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { countryByName } from "@/lib/countries";
import {
  buildSchedule,
  instrumentOutstanding,
  instrumentOverdue,
  computeSeverance,
  KIND_LABELS,
} from "@/lib/finance-extra";
import type { FinancialInstrument, FinancialInstrumentKind } from "@/lib/types";
import { uid, todayISO, cn } from "@/lib/utils";

const KINDS: FinancialInstrumentKind[] = [
  "traite",
  "traite_avalisee",
  "dat",
  "credit_documentaire",
  "credit_bancaire",
  "credit_personnel",
  "echeancier_client",
  "echeancier_fournisseur",
];

export function FinancementsPage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const today = todayISO();
  const [tab, setTab] = useState<"instruments" | "indemnites">("instruments");

  const list = data.financialInstruments || [];

  const totals = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    for (const fi of list) {
      outstanding += instrumentOutstanding(fi);
      overdue += instrumentOverdue(fi, today);
    }
    return { outstanding, overdue, count: list.length };
  }, [list, today]);

  return (
    <div>
      <PageHeader
        eyebrow="Trésorerie & engagements"
        title="Financements & échéanciers"
        description="Traites avalisées, DAT, crédits documentaires, crédits bancaires et personnel, paiements à tempérament, indemnités de rupture."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button type="button" variant={tab === "instruments" ? "default" : "secondary"} onClick={() => setTab("instruments")}>
          Instruments & crédits
        </Button>
        <Button type="button" variant={tab === "indemnites" ? "default" : "secondary"} onClick={() => setTab("indemnites")}>
          Indemnités de départ
        </Button>
      </div>

      {tab === "instruments" ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card className="p-3">
              <p className="text-xs text-muted">Instruments</p>
              <p className="text-xl font-semibold">{totals.count}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Encours restant dû</p>
              <p className="text-xl font-semibold">
                <Money value={totals.outstanding} currency={currency} />
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Impayés / échus</p>
              <p className={cn("text-xl font-semibold", totals.overdue > 0 && "text-danger")}>
                <Money value={totals.overdue} currency={currency} />
              </p>
            </Card>
          </div>

          <NewInstrumentForm />

          <div className="mt-4 space-y-3">
            {list.length === 0 ? (
              <Card className="p-6 text-sm text-muted">Aucun instrument enregistré.</Card>
            ) : (
              list.map((fi) => (
                <InstrumentCard key={fi.id} fi={fi} currency={currency} today={today} />
              ))
            )}
          </div>
        </>
      ) : (
        <SeverancePanel />
      )}
    </div>
  );
}

function NewInstrumentForm() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const [kind, setKind] = useState<FinancialInstrumentKind>("credit_bancaire");
  const [reference, setReference] = useState("");
  const [label, setLabel] = useState("");
  const [principal, setPrincipal] = useState(0);
  const [rate, setRate] = useState(0);
  const [months, setMonths] = useState(12);
  const [startDate, setStartDate] = useState(todayISO());
  const [bankName, setBankName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [avaliste, setAvaliste] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  function submit() {
    if (!label || principal <= 0) {
      toast.error("Libellé et montant requis");
      return;
    }
    const end = new Date(startDate + "T12:00:00");
    end.setMonth(end.getMonth() + months);
    const installments = ["dat", "credit_documentaire"].includes(kind)
      ? [
          {
            id: "ins-1",
            dueDate: end.toISOString().slice(0, 10),
            amount: Math.round(principal * (1 + (rate / 100) * (months / 12))),
            paid: false,
          },
        ]
      : buildSchedule(principal, rate, startDate, months, kind === "traite" || kind === "traite_avalisee" ? "bullet" : "equal_principal");

    const item: FinancialInstrument = {
      id: uid("fi"),
      kind,
      reference: reference || `REF-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      label,
      principal,
      interestRate: rate,
      startDate,
      endDate: end.toISOString().slice(0, 10),
      bankName: bankName || undefined,
      partnerName: partnerName || undefined,
      avaliste: avaliste || undefined,
      employeeId: employeeId || undefined,
      currency,
      status: "ouvert",
      installments,
    };
    data.upsertFinancialInstrument(item);
    toast.success("Instrument enregistré avec échéancier");
    setLabel("");
    setPrincipal(0);
    setReference("");
  }

  return (
    <Card className="p-4">
      <h2 className="font-display mb-3">Nouvel instrument</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Type">
          <select
            className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as FinancialInstrumentKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Référence">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° traite / contrat" />
        </Field>
        <Field label="Libellé">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Principal">
          <Input type="number" value={principal || ""} onChange={(e) => setPrincipal(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Taux % annuel">
          <Input type="number" value={rate || ""} onChange={(e) => setRate(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Durée (mois)">
          <Input type="number" value={months || ""} onChange={(e) => setMonths(Number(e.target.value) || 1)} />
        </Field>
        <Field label="Date de début">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Banque / institution">
          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </Field>
        <Field label="Tiers / client / fournisseur">
          <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
        </Field>
        <Field label="Avaliste (traite)">
          <Input value={avaliste} onChange={(e) => setAvaliste(e.target.value)} />
        </Field>
        <Field label="Salarié (crédit personnel)">
          <select
            className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">—</option>
            {(data.employees || []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Button type="button" className="mt-3" onClick={submit}>
        Enregistrer + générer échéancier
      </Button>
    </Card>
  );
}

function InstrumentCard({
  fi,
  currency,
  today,
}: {
  fi: FinancialInstrument;
  currency: string;
  today: string;
}) {
  const data = useAppStore();
  const out = instrumentOutstanding(fi);
  const od = instrumentOverdue(fi, today);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {KIND_LABELS[fi.kind] || fi.kind} — {fi.label}
          </p>
          <p className="text-xs text-muted">
            {fi.reference} · {fi.startDate} → {fi.endDate}
            {fi.bankName ? ` · ${fi.bankName}` : ""}
            {fi.partnerName ? ` · ${fi.partnerName}` : ""}
            {fi.avaliste ? ` · Aval : ${fi.avaliste}` : ""}
            {" · "}
            <span className={cn(fi.status === "impaye" && "text-danger", fi.status === "solde" && "text-muted")}>
              {fi.status}
            </span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p>
            Principal <Money value={fi.principal} currency={currency} />
          </p>
          <p>
            Restant <Money value={out} currency={currency} />
          </p>
          {od > 0 ? (
            <p className="text-danger">
              Échu <Money value={od} currency={currency} />
            </p>
          ) : null}
        </div>
      </div>
      <ul className="mt-3 max-h-48 overflow-auto text-xs">
        {fi.installments.map((ins) => (
          <li
            key={ins.id}
            className={cn(
              "flex items-center justify-between border-t border-border py-1",
              !ins.paid && ins.dueDate < today && "text-danger",
            )}
          >
            <span>
              {ins.dueDate} — <Money value={ins.amount} currency={currency} />
              {ins.paid ? ` · payé ${ins.paidAt}` : ""}
            </span>
            {!ins.paid ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  data.payInstallment(fi.id, ins.id);
                  toast.success("Échéance marquée payée");
                }}
              >
                Payer
              </Button>
            ) : (
              <span className="text-muted">OK</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="ghost" onClick={() => data.removeFinancialInstrument(fi.id)}>
          Supprimer
        </Button>
      </div>
    </Card>
  );
}

function SeverancePanel() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState<import("@/lib/types").SeveranceCalc["reason"]>("licenciement");
  const [exitDate, setExitDate] = useState(todayISO());
  const [result, setResult] = useState<import("@/lib/types").SeveranceCalc | null>(null);

  function calc() {
    const emp = (data.employees || []).find((e) => e.id === employeeId);
    if (!emp) {
      toast.error("Sélectionnez un salarié");
      return;
    }
    const hireDate = (emp as { hireDate?: string }).hireDate || "2020-01-01";
    const monthly = emp.base || 0;
    const sev = computeSeverance({
      employeeId: emp.id,
      employeeName: emp.name,
      reason,
      hireDate,
      exitDate,
      monthlySalary: monthly,
    });
    setResult(sev);
  }

  function save() {
    if (!result) return;
    data.addSeveranceCalc(result);
    toast.success("Calcul enregistré");
  }

  function postJournal() {
    if (!result || result.total <= 0) return;
    data.addJournalLines([
      {
        id: uid("j"),
        date: result.exitDate,
        piece: "IND-DEP",
        libelle: `Indemnités départ — ${result.employeeName} (${result.reason})`,
        debit: "668",
        credit: "422",
        amount: result.total,
      },
    ]);
    toast.success("Écriture 668 / 422 générée");
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-display mb-2">Calcul automatique des indemnités</h2>
        <p className="mb-3 text-xs text-muted">
          Barème indicatif (préavis, indemnité de licenciement, congés, gratification retraite).
          À valider selon le code du travail du pays.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Salarié">
            <select
              className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">—</option>
              {(data.employees || []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motif">
            <select
              className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
            >
              <option value="licenciement">Licenciement</option>
              <option value="demission">Démission</option>
              <option value="retraite">Départ à la retraite</option>
              <option value="fin_contrat">Fin de contrat</option>
              <option value="deces">Décès</option>
            </select>
          </Field>
          <Field label="Date de sortie">
            <Input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
          </Field>
        </div>
        <Button type="button" className="mt-3" onClick={calc}>
          Calculer
        </Button>
      </Card>

      {result ? (
        <Card className="p-4">
          <h3 className="font-display mb-2">
            {result.employeeName} — {result.reason} ({result.yearsOfService} ans d&apos;ancienneté)
          </h3>
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between">
              <span>Préavis ({result.noticeDays} j)</span>
              <Money value={result.noticePay} currency={currency} />
            </li>
            <li className="flex justify-between">
              <span>Indemnité de licenciement</span>
              <Money value={result.severancePay} currency={currency} />
            </li>
            <li className="flex justify-between">
              <span>Congés payés (solde estimé)</span>
              <Money value={result.leavePay} currency={currency} />
            </li>
            <li className="flex justify-between">
              <span>Gratification retraite</span>
              <Money value={result.retirementBonus} currency={currency} />
            </li>
            <li className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <Money value={result.total} currency={currency} />
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted">{result.notes}</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={save}>
              Enregistrer le calcul
            </Button>
            <Button type="button" variant="secondary" onClick={postJournal}>
              Comptabiliser 668/422
            </Button>
          </div>
        </Card>
      ) : null}

      {(data.severanceCalcs || []).length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3 font-display">Historique</div>
          <ul className="divide-y divide-border text-sm">
            {(data.severanceCalcs || []).map((s) => (
              <li key={s.id} className="flex justify-between px-4 py-2">
                <span>
                  {s.employeeName} · {s.reason} · {s.exitDate}
                </span>
                <Money value={s.total} currency={currency} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
