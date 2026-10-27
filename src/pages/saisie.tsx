import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AccountPicker } from "@/components/account-picker";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { ECRITURES_TYPES } from "@/lib/engine";
import { accountLabel } from "@/lib/accounts";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/utils";
import type { JournalCode, JournalLine } from "@/lib/types";
import { countryByName } from "@/lib/countries";
import { Trash2 } from "lucide-react";

const JOURNAL_OPTIONS: { code: JournalCode; label: string }[] = [
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
function suggestJournal(debit: string, credit: string): JournalCode {
  const d = (debit || "").trim();
  const c = (credit || "").trim();
  // Paie
  if (/^(661|664|422|431|447)/.test(d) || /^(422|431|447)/.test(c)) return "PAIE";
  // Amortissements
  if (/^681/.test(d) || /^28/.test(c) || /^28/.test(d)) return "AMORT";
  // À-nouveaux / capitaux
  if (/^(10|11|12)/.test(d) || /^(10|11|12)/.test(c)) return "AN";
  // Caisse
  if (d.startsWith("571") || c.startsWith("571")) return "CAI";
  // Banque / trésorerie
  if (/^(521|531|538)/.test(d) || /^(521|531|538)/.test(c)) return "BQ";
  // Ventes
  if (/^7/.test(c) || (d.startsWith("411") && /^7|^443/.test(c))) return "VTE";
  if (d.startsWith("411") && c.startsWith("443")) return "VTE";
  // Achats
  if (/^6[0-3]/.test(d) || c.startsWith("401") || d.startsWith("445")) return "ACH";
  if (d.startsWith("401") || c.startsWith("401")) return "ACH";
  // Immobilisations / OD
  if (/^2/.test(d) || c.startsWith("481")) return "OD";
  return "OD";
}
