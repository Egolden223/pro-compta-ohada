import type { JournalCode } from "@/lib/types";

export const JOURNAL_OPTIONS: { code: JournalCode; label: string }[] = [
  { code: "VTE", label: "VTE — Ventes (factures clients, avoirs, TVA collectée)" },
  { code: "ACH", label: "ACH — Achats (fournisseurs, TVA déductible, charges d'exploitation)" },
  { code: "BQ", label: "BQ — Banque (virements, chèques, frais bancaires, mobile money)" },
  { code: "CAI", label: "CAI — Caisse (espèces entrées / sorties)" },
  { code: "PAIE", label: "PAIE — Paie (salaires, CNSS, IUTS, charges patronales)" },
  { code: "AMORT", label: "AMORT — Amortissements (dotations 68x / 28x)" },
  { code: "AN", label: "AN — À-nouveaux (report d'ouverture, affectation résultat)" },
  { code: "OD", label: "OD — Opérations diverses (stocks, provisions, OD de clôture)" },
];

/** Propose un journal selon les comptes débit / crédit (modifiable ensuite). */
export function suggestJournal(debit: string, credit: string): JournalCode {
  const d = (debit || "").trim();
  const c = (credit || "").trim();
  if (/^(661|664|422|431|447)/.test(d) || /^(422|431|447)/.test(c)) return "PAIE";
  if (/^681/.test(d) || /^28/.test(c) || /^28/.test(d)) return "AMORT";
  if (/^(10|11|12)/.test(d) || /^(10|11|12)/.test(c)) return "AN";
  if (d.startsWith("571") || c.startsWith("571")) return "CAI";
  if (/^(521|531|538)/.test(d) || /^(521|531|538)/.test(c)) return "BQ";
  if (/^7/.test(c) || (d.startsWith("411") && /^7|^443/.test(c))) return "VTE";
  if (d.startsWith("411") && c.startsWith("443")) return "VTE";
  if (/^6[0-3]/.test(d) || c.startsWith("401") || d.startsWith("445")) return "ACH";
  if (d.startsWith("401") || c.startsWith("401")) return "ACH";
  if (/^2/.test(d) || c.startsWith("481")) return "OD";
  return "OD";
}
