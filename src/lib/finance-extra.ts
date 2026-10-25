/** Traites, DAT, CREDOC, crédits, échéanciers, indemnités de rupture. */
import type { FinancialInstrument, FinancialInstallment, SeveranceCalc } from "./types";

export function buildSchedule(
  principal: number,
  annualRatePct: number,
  startDate: string,
  months: number,
  mode: "constant_annuity" | "equal_principal" | "interest_only" | "bullet" = "equal_principal",
): FinancialInstallment[] {
  const n = Math.max(1, months);
  const r = annualRatePct / 100 / 12;
  const installments: FinancialInstallment[] = [];
  let remaining = principal;
  const start = new Date(startDate + "T12:00:00");

  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i + 1);
    const dueDate = d.toISOString().slice(0, 10);
    let amount = 0;
    if (mode === "bullet") {
      amount = i === n - 1 ? principal + principal * (annualRatePct / 100) * (n / 12) : 0;
      if (i < n - 1) amount = principal * r; // intérêts mensuels
    } else if (mode === "interest_only") {
      amount = i === n - 1 ? remaining + remaining * r : remaining * r;
    } else if (mode === "constant_annuity" && r > 0) {
      const ann = (principal * r) / (1 - Math.pow(1 + r, -n));
      amount = ann;
      const interest = remaining * r;
      remaining = Math.max(0, remaining - (ann - interest));
    } else {
      // equal principal
      const principalPart = principal / n;
      const interest = remaining * r;
      amount = principalPart + interest;
      remaining = Math.max(0, remaining - principalPart);
    }
    installments.push({
      id: `ins-${i + 1}`,
      dueDate,
      amount: Math.round(amount),
      paid: false,
    });
  }
  return installments;
}

export function instrumentOutstanding(fi: FinancialInstrument): number {
  return fi.installments.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0);
}

export function instrumentOverdue(fi: FinancialInstrument, today: string): number {
  return fi.installments
    .filter((i) => !i.paid && i.dueDate < today)
    .reduce((s, i) => s + i.amount, 0);
}

/** Calcul indicatif des indemnités de rupture (barème type OHADA / pratique UEMOA — à adapter au code du travail local). */
export function computeSeverance(params: {
  employeeId: string;
  employeeName: string;
  reason: SeveranceCalc["reason"];
  hireDate: string;
  exitDate: string;
  monthlySalary: number;
}): SeveranceCalc {
  const hire = new Date(params.hireDate + "T12:00:00");
  const exit = new Date(params.exitDate + "T12:00:00");
  const ms = Math.max(0, exit.getTime() - hire.getTime());
  const years = ms / (365.25 * 24 * 3600 * 1000);
  const yearsOfService = Math.round(years * 100) / 100;
  const salary = Math.max(0, params.monthlySalary);

  // Préavis indicatif
  let noticeDays = 0;
  if (params.reason === "licenciement" || params.reason === "retraite") {
    if (yearsOfService < 1) noticeDays = 8;
    else if (yearsOfService < 5) noticeDays = 15;
    else if (yearsOfService < 10) noticeDays = 30;
    else noticeDays = 60;
  } else if (params.reason === "demission") {
    noticeDays = yearsOfService < 1 ? 8 : 15;
  }
  const noticePay = Math.round((salary / 30) * noticeDays);

  // Indemnité de licenciement : 20–40 % mois par année (indicatif)
  let severancePay = 0;
  if (params.reason === "licenciement" && yearsOfService >= 1) {
    const rate = yearsOfService >= 10 ? 0.4 : yearsOfService >= 5 ? 0.3 : 0.2;
    severancePay = Math.round(salary * rate * yearsOfService);
  }

  // Congés payés : 2,5 j / mois travaillé sur 12 mois max simplifié → 2,5 * 12 / 30 * salaire si non pris
  // Approximation : 1 mois de salaire max pour solde de congés
  const leavePay = Math.round(salary * Math.min(1, yearsOfService > 0 ? 0.5 : 0));

  // Gratification / indemnité de départ à la retraite (indicatif 1 mois / 5 ans)
  let retirementBonus = 0;
  if (params.reason === "retraite" && yearsOfService >= 5) {
    retirementBonus = Math.round(salary * Math.floor(yearsOfService / 5));
  }

  const other = 0;
  const total = noticePay + severancePay + leavePay + retirementBonus + other;

  return {
    id: `sev-${Date.now().toString(36)}`,
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    reason: params.reason,
    hireDate: params.hireDate,
    exitDate: params.exitDate,
    monthlySalary: salary,
    yearsOfService,
    noticeDays,
    noticePay,
    severancePay,
    leavePay,
    retirementBonus,
    other,
    total,
    notes:
      "Barème indicatif — vérifier le code du travail et la convention collective du pays OHADA concerné.",
  };
}

/** Ratios financiers clés. */
export function computeRatios(input: {
  totalActif: number;
  totalPassif: number;
  cp: number;
  treso: number;
  actifCirculant: number;
  passifCirculant: number;
  stocks: number;
  ca: number;
  ebe: number;
  rn: number;
  dettesFin: number;
  cafg: number;
}): { code: string; label: string; value: number; unit: "%" | "x" | "j"; interpretation: string }[] {
  const safe = (a: number, b: number) => (b === 0 ? 0 : a / b);
  const liquiditeG = safe(input.actifCirculant, input.passifCirculant);
  const liquiditeR = safe(input.actifCirculant - input.stocks, input.passifCirculant);
  const liquiditeI = safe(input.treso, input.passifCirculant);
  const autonomie = safe(input.cp, input.totalPassif) * 100;
  const endettement = safe(input.dettesFin, input.cp) * 100;
  const roe = safe(input.rn, input.cp) * 100;
  const roa = safe(input.rn, input.totalActif) * 100;
  const margeNette = safe(input.rn, input.ca) * 100;
  const margeEbe = safe(input.ebe, input.ca) * 100;
  const couverture = safe(input.cafg, Math.max(1, input.dettesFin / 5)); // CAF / annuité approx

  return [
    {
      code: "LIQ_G",
      label: "Liquidité générale",
      value: Math.round(liquiditeG * 100) / 100,
      unit: "x",
      interpretation: liquiditeG >= 1.5 ? "Correcte" : liquiditeG >= 1 ? "Limite" : "Insuffisante",
    },
    {
      code: "LIQ_R",
      label: "Liquidité réduite",
      value: Math.round(liquiditeR * 100) / 100,
      unit: "x",
      interpretation: liquiditeR >= 1 ? "Correcte" : "Tendue",
    },
    {
      code: "LIQ_I",
      label: "Liquidité immédiate",
      value: Math.round(liquiditeI * 100) / 100,
      unit: "x",
      interpretation: liquiditeI >= 0.3 ? "Acceptable" : "Faible",
    },
    {
      code: "AUT",
      label: "Autonomie financière",
      value: Math.round(autonomie * 10) / 10,
      unit: "%",
      interpretation: autonomie >= 30 ? "Saine" : "Dépendante de la dette",
    },
    {
      code: "END",
      label: "Endettement (dettes fin. / CP)",
      value: Math.round(endettement * 10) / 10,
      unit: "%",
      interpretation: endettement <= 100 ? "Maîtrisé" : "Élevé",
    },
    {
      code: "ROE",
      label: "Rentabilité des CP (ROE)",
      value: Math.round(roe * 10) / 10,
      unit: "%",
      interpretation: roe >= 10 ? "Bonne" : roe >= 0 ? "Modérée" : "Négative",
    },
    {
      code: "ROA",
      label: "Rentabilité de l'actif (ROA)",
      value: Math.round(roa * 10) / 10,
      unit: "%",
      interpretation: roa >= 5 ? "Bonne" : roa >= 0 ? "Faible" : "Négative",
    },
    {
      code: "MNET",
      label: "Marge nette",
      value: Math.round(margeNette * 10) / 10,
      unit: "%",
      interpretation: margeNette >= 5 ? "Correcte" : "À améliorer",
    },
    {
      code: "MEBE",
      label: "Marge d'EBE",
      value: Math.round(margeEbe * 10) / 10,
      unit: "%",
      interpretation: margeEbe >= 15 ? "Solide" : "Serrée",
    },
    {
      code: "COV",
      label: "Couverture dette par CAF (approx.)",
      value: Math.round(couverture * 100) / 100,
      unit: "x",
      interpretation: couverture >= 1.5 ? "Confortable" : "Surveiller",
    },
  ];
}

export const KIND_LABELS: Record<string, string> = {
  traite: "Traite",
  traite_avalisee: "Traite avalisée",
  dat: "DAT (dépôt à terme)",
  credit_documentaire: "Crédit documentaire",
  credit_bancaire: "Crédit bancaire / institution",
  credit_personnel: "Crédit au personnel",
  echeancier_client: "Échéancier client (tempérament)",
  echeancier_fournisseur: "Échéancier fournisseur (tempérament)",
};
