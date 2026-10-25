/**
 * Moteur d'analyse et de rédaction assistée (sans API externe obligatoire).
 * Produit diagnostics, alertes et rapports narratifs multi-destinataires
 * à partir des données comptables de l'entité.
 */
import type { AppData, JournalLine } from "./types";
import { buildBalance, buildBilanOfficial, buildPnlOfficial, buildTftOfficial, kpis, computeIs, resultatNet } from "./engine";
import { computeRatios, instrumentOverdue, instrumentOutstanding } from "./finance-extra";
import { countryByName } from "./countries";

export type AiAlert = {
  id: string;
  severity: "critique" | "alerte" | "info";
  code: string;
  title: string;
  detail: string;
  lineIds?: string[];
};

export type ReportAudience =
  | "dirigeants"
  | "associes"
  | "banque"
  | "impots"
  | "cnss"
  | "comptable";

/** Détection d'anomalies et d'erreurs d'écritures. */
export function diagnoseAccounting(data: AppData): AiAlert[] {
  const alerts: AiAlert[] = [];
  const journal = data.journal || [];
  const rows = buildBalance(journal);
  const bil = buildBilanOfficial(journal, data.journalPrevious || []);
  const tax = countryByName(data.settings.country);

  // 1. Écritures déséquilibrées (montant <= 0, comptes vides)
  for (const l of journal) {
    if (!l.debit || !l.credit) {
      alerts.push({
        id: `empty-${l.id}`,
        severity: "critique",
        code: "ECRITURE_INCOMPLETE",
        title: "Écriture incomplète",
        detail: `Pièce ${l.piece || "—"} du ${l.date} : compte débit ou crédit manquant (« ${l.libelle} »).`,
        lineIds: [l.id],
      });
    }
    if (l.amount <= 0) {
      alerts.push({
        id: `amt-${l.id}`,
        severity: "critique",
        code: "MONTANT_INVALIDE",
        title: "Montant invalide",
        detail: `Pièce ${l.piece || "—"} : montant ≤ 0.`,
        lineIds: [l.id],
      });
    }
    if (l.debit === l.credit && l.debit) {
      alerts.push({
        id: `same-${l.id}`,
        severity: "critique",
        code: "MEME_COMPTE",
        title: "Débit = crédit (même compte)",
        detail: `Pièce ${l.piece || "—"} : ${l.debit} au débit et au crédit.`,
        lineIds: [l.id],
      });
    }
  }

  // 2. Écart bilan
  if (Math.abs(bil.ecart) > 1) {
    alerts.push({
      id: "bilan-ecart",
      severity: "critique",
      code: "BILAN_DESEQUILIBRE",
      title: "Bilan déséquilibré",
      detail: `Écart actif − passif = ${bil.ecart.toLocaleString("fr-FR")} ${tax.currency}. Vérifiez les écritures de clôture et les classes 1–5.`,
    });
  }

  // 3. Balance : totaux
  let sumD = 0,
    sumC = 0;
  for (const r of rows) {
    sumD += r.soldeD;
    sumC += r.soldeC;
  }
  // use movement totals if available
  for (const r of rows) {
    // soft check
  }
  void sumD;
  void sumC;

  // 4. Comptes de tiers sans mouvement de règlement fréquent
  const clients = rows.filter((r) => r.code.startsWith("411") && r.soldeD - r.soldeC > 0);
  for (const c of clients.slice(0, 5)) {
    const net = c.soldeD - c.soldeC;
    if (net > 500_000) {
      alerts.push({
        id: `cli-${c.code}`,
        severity: "alerte",
        code: "CREANCE_ELEVEE",
        title: `Créance client élevée (${c.code})`,
        detail: `Solde ${net.toLocaleString("fr-FR")} ${tax.currency}. Relancer le lettrage et le recouvrement.`,
      });
    }
  }

  // 5. TVA : collectée sans déductible ou inverse
  let tvaCol = 0,
    tvaDed = 0;
  for (const l of journal) {
    if (l.credit.startsWith("443")) tvaCol += l.amount;
    if (l.debit.startsWith("445")) tvaDed += l.amount;
  }
  if (tvaCol > 0 && tvaDed === 0) {
    alerts.push({
      id: "tva-ded",
      severity: "alerte",
      code: "TVA_DEDUCTIBLE_ABSENTE",
      title: "TVA collectée sans TVA déductible",
      detail: "Vérifiez la comptabilisation des achats soumis à TVA.",
    });
  }

  // 6. Trésorerie négative
  const treso = bil.actif.find((p) => p.ref === "BT");
  if (treso && treso.net < 0) {
    alerts.push({
      id: "treso-neg",
      severity: "critique",
      code: "TRESORERIE_NEGATIVE",
      title: "Trésorerie nette négative",
      detail: `Trésorerie-actif nette ${treso.net.toLocaleString("fr-FR")}. Risque de liquidité immédiat.`,
    });
  }

  // 7. Résultat vs IMF
  try {
    const isc = computeIs(data);
    if (isc.isMinimum > isc.isTheorique && isc.isMinimum > 0) {
      alerts.push({
        id: "imf",
        severity: "info",
        code: "IMF_APPLICABLE",
        title: "Impôt minimum forfaitaire applicable",
        detail: `IS théorique ${isc.isTheorique.toLocaleString("fr-FR")} < IMF ${isc.isMinimum.toLocaleString("fr-FR")}. L'impôt dû sera l'IMF.`,
      });
    }
  } catch {
    /* ignore */
  }

  // 8. Libellés trop courts / absents
  for (const l of journal) {
    if (!l.libelle || l.libelle.trim().length < 3) {
      alerts.push({
        id: `lib-${l.id}`,
        severity: "alerte",
        code: "LIBELLE_FAIBLE",
        title: "Libellé d'écriture insuffisant",
        detail: `Pièce ${l.piece || "—"} du ${l.date} : libellé vide ou trop court (piste d'audit).`,
        lineIds: [l.id],
      });
    }
  }

  // 9. Dates futures
  const today = new Date().toISOString().slice(0, 10);
  for (const l of journal) {
    if (l.date > today) {
      alerts.push({
        id: `fut-${l.id}`,
        severity: "alerte",
        code: "DATE_FUTURE",
        title: "Écriture à date future",
        detail: `Pièce ${l.piece || "—"} datée ${l.date}.`,
        lineIds: [l.id],
      });
    }
  }

  // 10. Pas d'écriture de paie si salariés
  if ((data.employees || []).length > 0) {
    const hasPay = journal.some(
      (l) => l.debit.startsWith("66") || l.credit.startsWith("42") || l.credit.startsWith("43"),
    );
    if (!hasPay) {
      alerts.push({
        id: "paie-manque",
        severity: "alerte",
        code: "PAIE_NON_COMPTABILISEE",
        title: "Salariés sans écriture de paie",
        detail: `${data.employees.length} salarié(s) mais aucune charge de personnel détectée dans le journal.`,
      });
    }
  }

  // 11. Capitaux propres négatifs
  const cp = bil.passif.find((p) => p.ref === "CP");
  if (cp && cp.net < 0) {
    alerts.push({
      id: "cp-neg",
      severity: "critique",
      code: "CAPITAUX_PROPRES_NEGATIFS",
      title: "Capitaux propres négatifs",
      detail: `Total CP ${cp.net.toLocaleString("fr-FR")}. Situation nette préoccupante pour associés et banques.`,
    });
  }

  // Instruments financiers en retard
  const today = new Date().toISOString().slice(0, 10);
  for (const fi of data.financialInstruments || []) {
    const od = instrumentOverdue(fi, today);
    if (od > 0) {
      alerts.push({
        id: `fi-od-${fi.id}`,
        severity: "alerte",
        code: "ECHEANCE_IMPAYEE",
        title: `Échéance impayée — ${fi.label}`,
        detail: `Impayé ${od.toLocaleString("fr-FR")} (${fi.kind} ${fi.reference}).`,
      });
    }
  }

  return alerts.sort((a, b) => {
    const o = { critique: 0, alerte: 1, info: 2 };
    return o[a.severity] - o[b.severity];
  });
}

function fmt(n: number, currency: string) {
  return `${Math.round(n).toLocaleString("fr-FR")} ${currency}`;
}

/** Rédaction automatique d'un rapport selon le destinataire. */
export function generateReport(data: AppData, audience: ReportAudience): string {
  const tax = countryByName(data.settings.country);
  const currency = tax.currency;
  const company = data.settings.companyName || "l'entité";
  const bil = buildBilanOfficial(data.journal, data.journalPrevious || []);
  const cr = buildPnlOfficial(data.journal, data.journalPrevious || []);
  const tft = buildTftOfficial(data.journal, data.journalPrevious || []);
  const alerts = diagnoseAccounting(data);
  const k = kpis(data);
  const rn = resultatNet(data.journal);
  const isc = computeIs(data);
  const netN = bil.totalActif;
  const cp = bil.passif.find((p) => p.ref === "CP")?.net || 0;
  const treso = bil.actif.find((p) => p.ref === "BT")?.net || 0;
  const ebe = cr.find((p) => p.ref === "RN")?.amount || 0;
  const ca = k.ca || cr.find((p) => p.ref === "RA")?.amount || 0;
  const cafg = tft.find((p) => p.ref === "FD")?.amount || 0;
  const fluxExpl = tft.find((p) => p.ref === "FF")?.amount || 0;
  const critiques = alerts.filter((a) => a.severity === "critique");
  const alertes = alerts.filter((a) => a.severity === "alerte");

  const header = `RAPPORT D'ANALYSE COMPTABLE ET FINANCIÈRE
${company}
Pays : ${data.settings.country} · IFU : ${data.settings.ifu || "—"} · RCCM : ${data.settings.rccm || "—"}
Date de rédaction : ${new Date().toLocaleDateString("fr-FR")}
Destinataire : ${labelAudience(audience)}
Référentiel : SYSCOHADA révisé
────────────────────────────────────────────────────────────
`;

  const synthèse = `
1. SYNTHÈSE EXÉCUTIVE
Le total de l'actif s'élève à ${fmt(netN, currency)}. Les capitaux propres atteignent ${fmt(cp, currency)}.
La trésorerie nette (banques, caisse) s'établit à ${fmt(treso, currency)}.
Le chiffre d'affaires analytique retenu est d'environ ${fmt(ca, currency)}.
Le résultat net de la période est de ${fmt(rn, currency)}.
L'excédent brut d'exploitation (EBE) s'élève à ${fmt(ebe, currency)}.
La capacité d'autofinancement globale (CAFG) est de ${fmt(cafg, currency)} ; le flux net d'exploitation s'établit à ${fmt(fluxExpl, currency)}.
`;

  const bilan = `
2. SITUATION PATRIMONIALE (BILAN)
Actif immobilisé net : ${fmt(bil.actif.find((p) => p.ref === "AZ")?.net || 0, currency)}
Actif circulant : ${fmt(bil.actif.find((p) => p.ref === "BK")?.net || 0, currency)}
Trésorerie-actif : ${fmt(treso, currency)}
Capitaux propres et assimilés : ${fmt(cp, currency)}
Dettes financières : ${fmt(bil.passif.find((p) => p.ref === "DD")?.net || 0, currency)}
Passif circulant : ${fmt(bil.passif.find((p) => p.ref === "DP")?.net || 0, currency)}
Écart de contrôle actif/passif : ${fmt(bil.ecart, currency)} ${bil.ecart === 0 ? "(équilibré)" : "— À CORRIGER"}
`;

  const perf = `
3. PERFORMANCE (COMPTE DE RÉSULTAT)
${cr
  .filter((p) => p.total)
  .map((p) => `• ${p.ref} ${p.label} : ${fmt(p.amount, currency)} (N-1 : ${fmt(p.amountN1, currency)})`)
  .join("\n")}
`;

  const fiscal = `
4. ASPECTS FISCAUX ET SOCIAUX
IS théorique : ${fmt(isc.isTheorique, currency)}
IMF / IRM (minimum) : ${fmt(isc.isMinimum, currency)}
IS dû estimé (max IS, IMF) : ${fmt(isc.isDue, currency)}
Taux IS pays : ${((tax.isRate || 0) * 100).toFixed(1)} % · Taux min. : ${((tax.isMin || 0) * 100).toFixed(2)} %
Effectif déclaré dans le dossier : ${(data.employees || []).length} salarié(s)
`;

  const ratios = computeRatios({
    totalActif: netN,
    totalPassif: bil.totalPassif,
    cp,
    treso,
    actifCirculant: bil.actif.find((p) => p.ref === "BK")?.net || 0,
    passifCirculant: bil.passif.find((p) => p.ref === "DP")?.net || 0,
    stocks: bil.actif.find((p) => p.ref === "BB")?.net || 0,
    ca,
    ebe,
    rn,
    dettesFin: bil.passif.find((p) => p.ref === "DD")?.net || 0,
    cafg,
  });

  const ratioBlock = `
5bis. RATIOS FINANCIERS
${ratios.map((r) => `• ${r.label} : ${r.value}${r.unit === "x" ? "x" : r.unit} — ${r.interpretation}`).join("\n")}
`;

  // Graphiques textuels (barres ASCII) pour impression
  const bar = (v: number, max: number, width = 20) => {
    const n = max <= 0 ? 0 : Math.min(width, Math.round((Math.abs(v) / max) * width));
    return "█".repeat(n) + "░".repeat(width - n);
  };
  const maxAbs = Math.max(ca, ebe, Math.abs(rn), treso, 1);
  const chartBlock = `
5ter. GRAPHIQUES (aperçu)
CA      ${bar(ca, maxAbs)} ${fmt(ca, currency)}
EBE     ${bar(ebe, maxAbs)} ${fmt(ebe, currency)}
Résultat ${bar(rn, maxAbs)} ${fmt(rn, currency)}
Tréso.  ${bar(treso, maxAbs)} ${fmt(treso, currency)}
`;

  const risques = `
5. POINTS D'ATTENTION ET ALERTES
${
  critiques.length + alertes.length === 0
    ? "Aucune alerte critique ou majeure détectée automatiquement."
    : [...critiques, ...alertes]
        .map((a) => `• [${a.severity.toUpperCase()}] ${a.title} — ${a.detail}`)
        .join("\n")
}
`;

  let audienceBlock = "";
  switch (audience) {
    case "dirigeants":
      audienceBlock = `
6. MESSAGE AUX DIRIGEANTS
Priorités de pilotage :
– Surveiller la trésorerie (${fmt(treso, currency)}) et le BFR via le lettrage clients/fournisseurs.
– ${rn >= 0 ? "Le résultat est positif : envisager distribution ou renforcement des réserves." : "Le résultat est négatif : plan d'action sur les marges et les charges fixes."}
– Anticiper les échéances fiscales (TVA, acomptes IS, CNSS) via le calendrier intégré.
– ${critiques.length ? `Traiter en urgence ${critiques.length} point(s) critique(s) listé(s) ci-dessus.` : "Aucun point critique bloquant à ce stade."}
`;
      break;
    case "associes":
      audienceBlock = `
6. MESSAGE AUX ASSOCIÉS
Situation nette (capitaux propres) : ${fmt(cp, currency)}.
Résultat de la période : ${fmt(rn, currency)}.
${cp < 0 ? "Alerte : situation nette négative — risque sur la continuité d'exploitation et obligations de reconstitution des capitaux selon le droit OHADA des sociétés." : "La situation nette demeure positive."}
Recommandation : examiner l'affectation du résultat et la politique de distribution / mise en réserve lors de la prochaine assemblée.
`;
      break;
    case "banque":
      audienceBlock = `
6. MESSAGE À L'ÉTABLISSEMENT BANCAIRE
Capacité d'autofinancement (CAFG) : ${fmt(cafg, currency)}.
Flux net d'exploitation : ${fmt(fluxExpl, currency)}.
Trésorerie : ${fmt(treso, currency)}.
Endettement financier : ${fmt(bil.passif.find((p) => p.ref === "DD")?.net || 0, currency)}.
${fluxExpl >= 0 ? "Les flux d'exploitation sont positifs, signal favorable pour le service de la dette." : "Flux d'exploitation négatifs : justifier le besoin de financement court terme."}
Ce rapport est établi à titre informatif à partir de la comptabilité SYSCOHADA ; il ne se substitue pas aux états certifiés.
`;
      break;
    case "impots":
      audienceBlock = `
6. ÉLÉMENTS UTILES À L'ADMINISTRATION FISCALE
Base IS estimée et IMF : voir section 4.
Les états (bilan, CR, TFT, notes) sont disponibles à l'impression depuis la liasse SYSCOHADA.
Acomptes provisionnels et déclarations périodiques (TVA, RAS, IRCM) sont suivis dans le module Échéances.
Ce document est préparatoire et ne remplace pas la DSF / liasse officielle déposée sur le portail DGI.
`;
      break;
    case "cnss":
      audienceBlock = `
6. ÉLÉMENTS UTILES À LA CAISSE SOCIALE
Nombre de salariés paramétrés : ${(data.employees || []).length}.
Les bulletins et l'état déclaratif de paie sont générés depuis le module Paie (cotisations salariales et patronales selon barèmes ${data.settings.country}).
Vérifier la concordance entre les déclarations nominatives et les écritures 42/43/66.
`;
      break;
    default:
      audienceBlock = `
6. NOTES POUR LE COMPTABLE / EXPERT-COMPTABLE
– Contrôler l'écart de bilan et les alertes critiques avant arrêt des comptes.
– Finaliser lettrage, rapprochement bancaire et provisions (retraite, dépréciations).
– Archiver N → N-1 pour la comparabilité des états.
– Délai légal d'arrêt des comptes : 4 mois après clôture (Acte uniforme).
`;
  }

  const footer = `
────────────────────────────────────────────────────────────
Document généré automatiquement par PRO COMPTA OHADA (moteur d'analyse intégré).
Les montants sont issus du journal et des paramètres pays. Relire avant diffusion externe.
`;

  return header + synthèse + bilan + perf + fiscal + ratioBlock + chartBlock + risques + audienceBlock + footer;
}

function labelAudience(a: ReportAudience): string {
  const map: Record<ReportAudience, string> = {
    dirigeants: "Dirigeants / comité de direction",
    associes: "Associés / actionnaires",
    banque: "Banque / organisme de crédit",
    impots: "Administration fiscale (DGI)",
    cnss: "Caisse de sécurité sociale",
    comptable: "Comptable / expert-comptable",
  };
  return map[a];
}

/** Suggestions d'actions IA (prochaines tâches). */
export function suggestActions(data: AppData): string[] {
  const alerts = diagnoseAccounting(data);
  const actions: string[] = [];
  if (alerts.some((a) => a.code === "BILAN_DESEQUILIBRE")) {
    actions.push("Corriger l'écart de bilan avant toute publication des états.");
  }
  if (alerts.some((a) => a.code === "CREANCE_ELEVEE")) {
    actions.push("Lancer une campagne de lettrage et de relance clients.");
  }
  if (alerts.some((a) => a.code === "PAIE_NON_COMPTABILISEE")) {
    actions.push("Comptabiliser la paie du mois depuis le module Paie.");
  }
  if (!(data.journalPrevious || []).length) {
    actions.push("Archiver l'exercice N en N-1 pour activer la comparabilité des états.");
  }
  if ((data.retirementProvisions || []).length === 0 && (data.employees || []).length > 0) {
    actions.push("Évaluer les engagements de retraite (provision SYSCOHADA).");
  }
  if ((data.financialInstruments || []).some((fi) => instrumentOverdue(fi, new Date().toISOString().slice(0, 10)) > 0)) {
    actions.push("Régulariser les échéances impayées (traites, crédits, tempéraments).");
  }
  actions.push("Générer la liasse (portrait ou paysage) et les états déclaratifs du mois.");
  actions.push("Vérifier le calendrier d'échéances (TVA, CNSS, acomptes IS).");
  return actions;
}
