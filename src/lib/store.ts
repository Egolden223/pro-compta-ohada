import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppData,
  Article,
  Asset,
  BankImportLine,
  CounterKey,
  Document,
  Employee,
  JournalLine,
  Partner,
  Settings,
  StockMove,
} from "./types";
import { createSeed } from "./seed";
import { uid } from "./utils";
import { nextNumber, suggestedEntries, cogsEntries, cogsEntriesWithMethod, rasEntries, parseBankCsv, computePayroll, assetDotation, computeIs, nextLetteringCode, canLetter, openItemsForAccount } from "./engine"; // engine helpers used in actions
import { countryByName } from "./countries";

const STORAGE_KEY = "pro-compta-ohada-v6";

type Actions = {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  resetDemo: () => void;
  importData: (data: AppData) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  markBackedUp: () => void;
  addJournalLine: (line: Omit<JournalLine, "id">) => void;
  updateJournalLine: (id: string, patch: Partial<JournalLine>) => void;
  removeJournalLine: (id: string) => void;
  addPartner: (p: Omit<Partner, "id">) => string;
  updatePartner: (id: string, patch: Partial<Partner>) => void;
  removePartner: (id: string) => void;
  addArticle: (a: Omit<Article, "id">) => string;
  updateArticle: (id: string, patch: Partial<Article>) => void;
  removeArticle: (id: string) => void;
  addStockMove: (m: Omit<StockMove, "id">) => void;
  removeStockMove: (id: string) => void;
  addDocument: (
    d: Pick<Document, "type" | "date" | "partnerId" | "lines"> &
      Partial<Omit<Document, "id" | "number" | "type" | "date" | "partnerId" | "lines">> & {
        number?: string;
      },
  ) => string;
  updateDocument: (id: string, patch: Partial<Document>) => void;
  removeDocument: (id: string) => void;
  convertQuote: (id: string) => string | null;
  postDocument: (id: string) => string | null;
  unpostDocument: (id: string) => string | null;
  postIs: () => string | null;
  setVatCredit: (n: number) => void;
  setFiscal: (patch: Partial<Pick<AppData, "fiscalReintegrations" | "fiscalDeductions" | "deficitImputed">>) => void;
  setBudgetLine: (id: string, patch: Partial<{ label: string; accountPrefix: string; amount: number }>) => void;
  addBudgetLine: (line: { label: string; accountPrefix: string; amount: number }) => void;
  removeBudgetLine: (id: string) => void;
  toggleClosingStep: (id: string) => void;
  resetClosingSteps: () => void;
  letterLines: (lineIds: string[]) => string | null;
  unletter: (code: string) => void;
  addRecurring: (t: Omit<import("./types").RecurringTemplate, "id">) => string;
  updateRecurring: (id: string, patch: Partial<import("./types").RecurringTemplate>) => void;
  removeRecurring: (id: string) => void;
  generateRecurringInvoices: (asOf?: string) => number;
  lockJournalLine: (id: string) => void;
  reverseJournalLine: (id: string) => string | null;
  addProvision: (p: Omit<import("./types").Provision, "id" | "posted">) => string;
  postProvision: (id: string) => string | null;
  removeProvision: (id: string) => void;
  setAnnexNote: (id: string, patch: Partial<import("./types").AnnexNote>) => void;
  addAnnexNote: (n: Omit<import("./types").AnnexNote, "id">) => void;
  removeAnnexNote: (id: string) => void;
  addMobileMoney: (m: Omit<import("./types").MobileMoneyAccount, "id">) => string;
  removeMobileMoney: (id: string) => void;
  addAttachment: (a: Omit<import("./types").Attachment, "id" | "createdAt">) => string;
  removeAttachment: (id: string) => void;
  listWorkspaces: () => import("./types").WorkspaceMeta[];
  saveAsWorkspace: (name: string) => string;
  switchWorkspace: (id: string) => void;
  deleteWorkspace: (id: string) => void;
  addAnalyticAxis: (a: Omit<import("./types").AnalyticAxis, "id">) => string;
  removeAnalyticAxis: (id: string) => void;
  setCurrentUser: (id: string) => void;
  addUser: (u: Omit<import("./types").AppUser, "id">) => string;
  removeUser: (id: string) => void;
  importBankCsv: (csvText: string) => number;
  applyBankMatch: (bankId: string, journalId: string) => void;
  updateBudgetCommitted: (id: string, committed: number) => void;
  updateEmployee: (id: string, patch: Partial<import("./types").Employee>) => void;
  can: (action: "write" | "post" | "admin" | "read") => boolean;
  markDeclarationDone: (obligationId: string, periodKey: string) => void;
  unmarkDeclarationDone: (obligationId: string, periodKey: string) => void;
  resetDeclarationObligations: () => void;
  recordAcompteIs: (periodKey: string, amount: number) => void;
  setIsBaseN1: (amount: number) => void;
  addJournalLines: (lines: import("./types").JournalLine[]) => void;
  setAssetComponents: (items: import("./types").AssetComponent[]) => void;
  setRetirementProvisions: (items: import("./types").RetirementProvision[]) => void;
  archiveJournalAsPrevious: () => void;
  setFinancialInstruments: (items: import("./types").FinancialInstrument[]) => void;
  upsertFinancialInstrument: (item: import("./types").FinancialInstrument) => void;
  removeFinancialInstrument: (id: string) => void;
  payInstallment: (instrumentId: string, installmentId: string, paidAmount?: number) => void;
  setSeveranceCalcs: (items: import("./types").SeveranceCalc[]) => void;
  addSeveranceCalc: (item: import("./types").SeveranceCalc) => void;
  stockOutFromInvoice: (id: string) => number;
  peekNumber: (key: CounterKey) => string;
  consumeNumber: (key: CounterKey) => string;
  addAsset: (a: Omit<Asset, "id" | "posted">) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  postAmortizations: () => number;
  addEmployee: (e: Omit<Employee, "id">) => void;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  removeEmployee: (id: string) => void;
  postPayroll: (month: string) => number;
  setBank: (patch: Partial<Pick<AppData, "bankStatementBalance" | "bankOutstandingChecks" | "bankOutstandingDeposits" | "bankAdjustments">>) => void;
  importBankCsv: (lines: Omit<BankImportLine, "id">[]) => void;
  toggleBankMatch: (id: string) => void;
};

export type Store = AppData & Actions;

function bump(counters: AppData["counters"], key: CounterKey): { counters: AppData["counters"]; number: string } {
  const n = nextNumber({ counters } as AppData, key);
  return {
    number: n,
    counters: {
      ...counters,
      [key]: { ...counters[key], last: counters[key].last + 1 },
    },
  };
}

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createSeed(),
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      resetDemo: () => set({ ...createSeed(), hydrated: true }),
      importData: (data) =>
        set({
          ...data,
          budget: data.budget ?? [],
          closingSteps: data.closingSteps ?? [],
          vatCreditBroughtForward: data.vatCreditBroughtForward ?? 0,
          fiscalReintegrations: data.fiscalReintegrations ?? 0,
          fiscalDeductions: data.fiscalDeductions ?? 0,
          deficitImputed: data.deficitImputed ?? 0,
          recurring: data.recurring ?? [],
          lastLettering: data.lastLettering ?? "AA",
          provisions: data.provisions ?? [],
          annexNotes: data.annexNotes ?? [],
          mobileMoneyAccounts: data.mobileMoneyAccounts ?? [],
          attachments: data.attachments ?? [],
          analyticAxes: data.analyticAxes ?? [],
          users: data.users ?? [],
          currentUserId: data.currentUserId ?? "",
          declarationObligations: data.declarationObligations ?? [],
          declarationsDone: data.declarationsDone ?? [],
          acomptesIsPaid: data.acomptesIsPaid ?? [],
          isBaseN1: data.isBaseN1 ?? 0,
          assetComponents: data.assetComponents ?? [],
          retirementProvisions: data.retirementProvisions ?? [],
          journalPrevious: data.journalPrevious ?? [],
          financialInstruments: data.financialInstruments ?? [],
          severanceCalcs: data.severanceCalcs ?? [],
          hydrated: true,
        }),
      updateSettings: (patch) =>
        set((s) => {
          const settings = { ...s.settings, ...patch };
          return { settings };
        }),
      markBackedUp: () => set({ lastBackupAt: new Date().toISOString().slice(0, 10) }),
      addJournalLine: (line) =>
        set((s) => ({ journal: [...s.journal, { ...line, id: uid("j") }] })),
      updateJournalLine: (id, patch) =>
        set((s) => ({
          journal: s.journal.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      removeJournalLine: (id) =>
        set((s) => {
          const line = s.journal.find((l) => l.id === id);
          if (line?.locked || line?.reversedBy) return s; // interdit
          return { journal: s.journal.filter((l) => l.id !== id) };
        }),
      addPartner: (p) => {
        const id = uid("p");
        set((s) => {
          const same = s.partners.filter((x) => x.kind === p.kind);
          let account = p.account;
          if (!account || account === "411" || account === "401") {
            const n = same.length + 1;
            if (p.kind === "client") account = n <= 3 ? `411${n}` : "411";
            else account = n <= 3 ? `401${n}` : "401";
          }
          const code = p.code || String(same.length + 1).padStart(3, "0");
          return { partners: [...s.partners, { ...p, id, account, code }] };
        });
        return id;
      },
      recordAcompteIs: (periodKey, amount) =>
        set((s) => ({
          acomptesIsPaid: [
            ...(s.acomptesIsPaid || []).filter((a) => a.periodKey !== periodKey),
            { periodKey, amount, paidAt: new Date().toISOString() },
          ],
        })),
      setIsBaseN1: (amount) => set({ isBaseN1: amount }),
      addJournalLines: (lines) =>
        set((s) => ({
          journal: [
            ...s.journal,
            ...lines.map((l) => ({ ...l, id: l.id || uid("j") })),
          ],
        })),
      updatePartner: (id, patch) =>
        set((s) => ({
          partners: s.partners.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removePartner: (id) =>
        set((s) => ({ partners: s.partners.filter((p) => p.id !== id) })),
      addArticle: (a) => {
        const id = uid("a");
        set((s) => ({ articles: [...s.articles, { ...a, id }] }));
        return id;
      },
      setAssetComponents: (items) => set({ assetComponents: items }),
      setRetirementProvisions: (items) => set({ retirementProvisions: items }),
      archiveJournalAsPrevious: () =>
        set((s) => ({
          journalPrevious: s.journal.map((l) => ({ ...l })),
        })),
      setFinancialInstruments: (items) => set({ financialInstruments: items }),
      upsertFinancialInstrument: (item) =>
        set((s) => {
          const list = s.financialInstruments || [];
          const i = list.findIndex((x) => x.id === item.id);
          if (i >= 0) {
            const next = [...list];
            next[i] = item;
            return { financialInstruments: next };
          }
          return { financialInstruments: [...list, item] };
        }),
      removeFinancialInstrument: (id) =>
        set((s) => ({
          financialInstruments: (s.financialInstruments || []).filter((x) => x.id !== id),
        })),
      payInstallment: (instrumentId, installmentId, paidAmount) =>
        set((s) => ({
          financialInstruments: (s.financialInstruments || []).map((fi) => {
            if (fi.id !== instrumentId) return fi;
            const installments = fi.installments.map((ins) =>
              ins.id === installmentId
                ? {
                    ...ins,
                    paid: true,
                    paidAt: new Date().toISOString().slice(0, 10),
                    paidAmount: paidAmount ?? ins.amount,
                  }
                : ins,
            );
            const allPaid = installments.every((i) => i.paid);
            return { ...fi, installments, status: allPaid ? ("solde" as const) : fi.status };
          }),
        })),
      setSeveranceCalcs: (items) => set({ severanceCalcs: items }),
      addSeveranceCalc: (item) =>
        set((s) => ({ severanceCalcs: [...(s.severanceCalcs || []), item] })),

      updateArticle: (id, patch) =>
        set((s) => ({
          articles: s.articles.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeArticle: (id) =>
        set((s) => ({ articles: s.articles.filter((a) => a.id !== id) })),
      addStockMove: (m) =>
        set((s) => ({ stockMoves: [...s.stockMoves, { ...m, id: uid("s") }] })),
      removeStockMove: (id) =>
        set((s) => ({ stockMoves: s.stockMoves.filter((m) => m.id !== id) })),
      peekNumber: (key) => nextNumber(get(), key),
      consumeNumber: (key) => {
        const { number, counters } = bump(get().counters, key);
        set({ counters });
        return number;
      },
      addDocument: (d) => {
        const s = get();
        const keyMap: Record<Document["type"], CounterKey> = {
          FACTURE: "FACTURE",
          DEVIS: "DEVIS",
          RECU: "RECU",
          AVOIR: "AVOIR",
          BON_CMD: "BON_CMD",
          BON_CLIENT: "BON_CLIENT",
        };
        const key = keyMap[d.type];
        const number = d.number || nextNumber(s, key);
        const counters = d.number
          ? s.counters
          : { ...s.counters, [key]: { ...s.counters[key], last: s.counters[key].last + 1 } };
        const id = uid("d");
        set({
          counters,
          documents: [
            ...s.documents,
            {
              paid: 0,
              status: "Brouillon",
              paymentMode: "",
              linkedDoc: "",
              notes: "",
              currency: countryByName(s.settings.country).currency,
              fxRate: 1,
              saleAccount: d.type === "BON_CMD" ? "601" : "701",
              posted: false,
              validityDays: 30,
              motif: "",
              ...d,
              id,
              number,
            },
          ],
        });
        return id;
      },
      updateDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
      convertQuote: (id) => {
        const s = get();
        const q = s.documents.find((d) => d.id === id && d.type === "DEVIS");
        if (!q) return null;
        const { number, counters } = bump(s.counters, "FACTURE");
        const newId = uid("d");
        set({
          counters,
          documents: [
            ...s.documents.map((d) =>
              d.id === id
                ? { ...d, status: "Converti en facture" as const, linkedDoc: number }
                : d,
            ),
            {
              ...q,
              id: newId,
              type: "FACTURE",
              number,
              date: new Date().toISOString().slice(0, 10),
              status: "Envoyée",
              paid: 0,
              posted: false,
              linkedDoc: q.number,
              notes: `Converti depuis devis ${q.number}`,
            },
          ],
        });
        return newId;
      },
      postDocument: (id) => {
        const s = get();
        const doc = s.documents.find((d) => d.id === id);
        if (!doc || doc.posted) return "Déjà transféré au brouillard.";
        const partner = s.partners.find((p) => p.id === doc.partnerId);
        if (!partner) return "Partenaire introuvable.";
        const entries = suggestedEntries(doc, partner.account);
        if (!entries.length) {
          if (doc.type === "BON_CMD" && !doc.goodsReceived)
            return "Cochez « Marchandises reçues » avant de transférer un bon de commande.";
          return "Aucune écriture à générer pour ce type.";
        }
        const method = s.settings.stockMethod || "CUMP";
        const cogs = cogsEntriesWithMethod(doc, s.articles, s.stockMoves, method);
        const ras = rasEntries(doc, partner.account);
        set({
          journal: [
            ...s.journal,
            ...entries.map((e) => ({ ...e, id: uid("j") })),
            ...cogs.map((e) => ({ ...e, id: uid("j") })),
            ...ras.map((e) => ({ ...e, id: uid("j") })),
          ],
          documents: s.documents.map((d) =>
            d.id === id
              ? {
                  ...d,
                  posted: true,
                  rasAmount: ras[0]?.amount || d.rasAmount || 0,
                }
              : d,
          ),
        });
        return null;
      },
      unpostDocument: (id) => {
        const s = get();
        const doc = s.documents.find((d) => d.id === id);
        if (!doc) return "Document introuvable.";
        if (!doc.posted) return "Document non encore transféré.";
        // Supprime les écritures auto liées à ce n° de pièce
        set({
          journal: s.journal.filter((l) => !(l.piece === doc.number && l.source === "auto")),
          documents: s.documents.map((d) => (d.id === id ? { ...d, posted: false } : d)),
        });
        return null;
      },
      postIs: () => {
        const s = get();
        const { isDue } = computeIs(s);
        if (isDue <= 0) return "IS dû = 0 — rien à comptabiliser.";
        // Évite double comptabilisation
        const already = s.journal.some((l) => l.debit === "891" && l.source === "auto");
        if (already) return "IS déjà comptabilisé (écriture 891 auto présente).";
        const { number, counters } = bump(s.counters, "PIECE_BROUILLARD");
        set({
          counters,
          journal: [
            ...s.journal,
            {
              id: uid("j"),
              date: s.settings.fyEnd,
              piece: number,
              journal: "OD",
              debit: "891",
              credit: "441",
              libelle: `IS exercice ${s.settings.fyStart.slice(0, 4)}`,
              amount: isDue,
              source: "auto",
              remark: "Auto-IS",
            },
          ],
        });
        return null;
      },
      setVatCredit: (n) => set({ vatCreditBroughtForward: Math.max(0, n) }),
      setBudgetLine: (id, patch) =>
        set((s) => ({
          budget: (s.budget || []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),
      addBudgetLine: (line) =>
        set((s) => ({
          budget: [...(s.budget || []), { ...line, id: uid("bg") }],
        })),
      removeBudgetLine: (id) =>
        set((s) => ({ budget: (s.budget || []).filter((b) => b.id !== id) })),
      toggleClosingStep: (id) =>
        set((s) => ({
          closingSteps: (s.closingSteps || []).map((c) =>
            c.id === id ? { ...c, done: !c.done } : c,
          ),
        })),
      resetClosingSteps: () =>
        set((s) => ({
          closingSteps: (s.closingSteps || []).map((c) => ({ ...c, done: false })),
        })),
      letterLines: (lineIds) => {
        const s = get();
        const idSet = new Set(lineIds);
        const lines = s.journal.filter((l) => idSet.has(l.id));
        if (lines.length < 2) return "Sélectionnez au moins 2 lignes.";
        if (lines.some((l) => l.lettering)) return "Certaines lignes sont déjà lettrées.";
        // Déterminer le compte commun (débit ou crédit identique)
        const accounts = new Set<string>();
        for (const l of lines) {
          accounts.add(l.debit);
          accounts.add(l.credit);
        }
        // Pour chaque compte candidat, vérifier équilibre des mouvements sélectionnés
        let target: string | null = null;
        for (const acc of accounts) {
          const items = openItemsForAccount(s.journal, acc).filter((it) => idSet.has(it.lineId));
          if (items.length === lines.length && canLetter(items).ok) {
            target = acc;
            break;
          }
        }
        if (!target) {
          // Essai : construire OpenItem depuis les lignes
          const byAcc = new Map<string, { d: number; c: number; n: number }>();
          for (const l of lines) {
            for (const [acc, side] of [
              [l.debit, "d"] as const,
              [l.credit, "c"] as const,
            ]) {
              const cur = byAcc.get(acc) ?? { d: 0, c: 0, n: 0 };
              if (side === "d") cur.d += l.amount;
              else cur.c += l.amount;
              cur.n += 1;
              byAcc.set(acc, cur);
            }
          }
          for (const [acc, v] of byAcc) {
            if (v.d === v.c && v.d > 0) {
              target = acc;
              break;
            }
          }
        }
        if (!target) return "Lettrage impossible : débits ≠ crédits sur le compte tiers.";
        const code = nextLetteringCode(s.lastLettering || "AA");
        set({
          lastLettering: code,
          journal: s.journal.map((l) => (idSet.has(l.id) ? { ...l, lettering: code } : l)),
        });
        return null;
      },
      unletter: (code) =>
        set((s) => ({
          journal: s.journal.map((l) =>
            l.lettering === code ? { ...l, lettering: undefined } : l,
          ),
        })),
      addRecurring: (t) => {
        const id = uid("rc");
        set((s) => ({ recurring: [...(s.recurring || []), { ...t, id }] }));
        return id;
      },
      updateRecurring: (id, patch) =>
        set((s) => ({
          recurring: (s.recurring || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeRecurring: (id) =>
        set((s) => ({ recurring: (s.recurring || []).filter((r) => r.id !== id) })),
      generateRecurringInvoices: (asOf) => {
        const s = get();
        const today = asOf || new Date().toISOString().slice(0, 10);
        let count = 0;
        let docs = [...s.documents];
        let counters = s.counters;
        let recurring = [...(s.recurring || [])];
        for (let i = 0; i < recurring.length; i++) {
          const r = recurring[i]!;
          if (!r.active || !r.partnerId || !r.lines.length) continue;
          let next = r.nextDate;
          // Générer toutes les échéances <= today (max 24 pour éviter boucle)
          let guard = 0;
          while (next <= today && guard < 24) {
            guard++;
            const key = "FACTURE" as const;
            const number = nextNumber({ ...s, counters } as typeof s, key);
            counters = {
              ...counters,
              [key]: { ...counters[key], last: counters[key].last + 1 },
            };
            const id = uid("d");
            docs.push({
              id,
              type: "FACTURE",
              number,
              date: next,
              partnerId: r.partnerId,
              lines: r.lines.map((l) => ({ ...l })),
              paid: 0,
              status: "Envoyée",
              paymentMode: "",
              linkedDoc: r.name,
              notes: `Facture récurrente : ${r.name}`,
              currency: countryByName(s.settings.country).currency,
              fxRate: 1,
              saleAccount: r.saleAccount || "701",
              posted: false,
              validityDays: 30,
              motif: "",
              dueDate: "",
              goodsReceived: false,
            });
            count++;
            // Avancer d'un mois
            const [y, m, d] = next.split("-").map(Number);
            const dt = new Date(Date.UTC(y, m - 1 + 1, Math.min(d, r.dayOfMonth)));
            next = dt.toISOString().slice(0, 10);
            recurring[i] = {
              ...r,
              nextDate: next,
              lastGenerated: number,
            };
            r.nextDate = next; // for next while iter
          }
        }
        if (count) set({ documents: docs, counters, recurring });
        return count;
      
      lockJournalLine: (id) =>
        set((s) => ({
          journal: s.journal.map((l) => (l.id === id ? { ...l, locked: true } : l)),
        })),
      reverseJournalLine: (id) => {
        const s = get();
        const line = s.journal.find((l) => l.id === id);
        if (!line) return "Ligne introuvable.";
        if (line.reversedBy) return "Déjà contrepassée.";
        if (line.reversesId) return "Impossible de contrepasser une contrepassation.";
        const revId = uid("j");
        const reverse: JournalLine = {
          id: revId,
          date: new Date().toISOString().slice(0, 10),
          piece: `CP-${line.piece}`,
          journal: "OD",
          debit: line.credit, // inversion
          credit: line.debit,
          libelle: `Contrepassation : ${line.libelle}`,
          amount: line.amount,
          source: "auto",
          remark: "Contrepassation",
          reversesId: line.id,
          locked: true,
        };
        set({
          journal: [
            ...s.journal.map((l) =>
              l.id === id ? { ...l, locked: true, reversedBy: revId } : l,
            ),
            reverse,
          ],
        });
        return null;
      },
      addProvision: (p) => {
        const id = uid("pv");
        set((s) => ({
          provisions: [...(s.provisions || []), { ...p, id, posted: false }],
        }));
        return id;
      },
      postProvision: (id) => {
        const s = get();
        const p = (s.provisions || []).find((x) => x.id === id);
        if (!p) return "Provision introuvable.";
        if (p.posted) return "Déjà comptabilisée.";
        if (p.amount <= 0) return "Montant invalide.";
        const { number, counters } = bump(s.counters, "PROVISION");
        set({
          counters,
          provisions: (s.provisions || []).map((x) =>
            x.id === id ? { ...x, posted: true } : x,
          ),
          journal: [
            ...s.journal,
            {
              id: uid("j"),
              date: p.date,
              piece: number,
              journal: "OD",
              debit: p.chargeAccount,
              credit: p.provisionAccount,
              libelle: p.label,
              amount: p.amount,
              source: "auto",
              remark: "Provision",
              locked: true,
            },
          ],
        });
        return null;
      },
      removeProvision: (id) =>
        set((s) => ({
          provisions: (s.provisions || []).filter((x) => x.id !== id || x.posted),
        })),
      setAnnexNote: (id, patch) =>
        set((s) => ({
          annexNotes: (s.annexNotes || []).map((n) =>
            n.id === id ? { ...n, ...patch } : n,
          ),
        })),
      addAnnexNote: (n) =>
        set((s) => ({
          annexNotes: [...(s.annexNotes || []), { ...n, id: uid("an") }],
        })),
      removeAnnexNote: (id) =>
        set((s) => ({
          annexNotes: (s.annexNotes || []).filter((n) => n.id !== id),
        })),
},

      setFiscal: (patch) => set(patch),
      stockOutFromInvoice: (id) => {
        const s = get();
        const doc = s.documents.find((d) => d.id === id && d.type === "FACTURE");
        if (!doc) return 0;
        let n = 0;
        const moves: StockMove[] = [];
        for (const line of doc.lines) {
          if (!line.articleId || line.qty <= 0) continue;
          const art = s.articles.find((a) => a.id === line.articleId);
          if (!art || art.purchasePrice <= 0) continue;
          moves.push({
            id: uid("s"),
            articleId: art.id,
            date: doc.date,
            type: "SORTIE",
            qtyIn: 0,
            qtyOut: line.qty,
            piece: doc.number,
            libelle: `Vente ${art.designation}`,
            pu: art.purchasePrice,
          });
          n += 1;
        }
        if (moves.length) set({ stockMoves: [...s.stockMoves, ...moves] });
        return n;
      
      addMobileMoney: (m) => {
        const id = uid("mm");
        set((s) => ({
          mobileMoneyAccounts: [...(s.mobileMoneyAccounts || []), { ...m, id }],
        }));
        return id;
      },
      removeMobileMoney: (id) =>
        set((s) => ({
          mobileMoneyAccounts: (s.mobileMoneyAccounts || []).filter((x) => x.id !== id),
        })),
      addAttachment: (a) => {
        const id = uid("at");
        set((s) => ({
          attachments: [
            ...(s.attachments || []),
            { ...a, id, createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },
      removeAttachment: (id) =>
        set((s) => ({
          attachments: (s.attachments || []).filter((x) => x.id !== id),
        })),
},
      addAsset: (a) =>
        set((s) => ({ assets: [...s.assets, { ...a, id: uid("im"), posted: false }] })),
      updateAsset: (id, patch) =>
        set((s) => ({
          assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
      postAmortizations: () => {
        const s = get();
        const fy = s.settings.fyStart.slice(0, 4);
        // Uniquement les immobilisations non encore dotées cette génération de posted
        // (posted = déjà passé une fois ; pour multi-exercices on autorise si cumul < value)
        const toPost = s.assets.filter((a) => a.value > 0 && a.years > 0);
        const lines: JournalLine[] = [];
        const { number, counters } = bump(s.counters, "AMORTISSEMENT");
        const updated = s.assets.map((a) => {
          if (a.value <= 0 || a.years <= 0) return a;
          if (a.posted) return a; // déjà doté sur cet exercice (flag simple)
          const dot = assetDotation(a, s.settings.fyStart, s.settings.fyEnd);
          if (dot <= 0) return a;
          lines.push({
            id: uid("j"),
            date: s.settings.fyEnd,
            piece: number,
            journal: "AMORT",
            debit: "681",
            credit: a.amortAccount || "284",
            libelle: `Dotation ${fy} — ${a.name}`,
            amount: dot,
            source: "auto",
          });
          return { ...a, posted: true, cumulOpen: (a.cumulOpen || 0) + dot };
        });
        if (!lines.length) return 0;
        set({
          counters,
          journal: [...s.journal, ...lines],
          assets: updated,
        });
        return lines.length;
      
      listWorkspaces: () => loadWorkspaceIndex(),
      saveAsWorkspace: (name) => {
        const s = get();
        const id = uid("ws");
        const meta: import("./types").WorkspaceMeta = {
          id,
          name: name || s.settings.companyName || "Dossier",
          country: s.settings.country,
          accountingSystem: s.settings.accountingSystem || "NORMAL",
          entityProfile: s.settings.entityProfile || "SYSCOHADA",
          updatedAt: new Date().toISOString(),
        };
        const data: AppData = {
          settings: s.settings,
          counters: s.counters,
          partners: s.partners,
          articles: s.articles,
          journal: s.journal,
          documents: s.documents,
          stockMoves: s.stockMoves,
          employees: s.employees,
          assets: s.assets,
          bankImport: s.bankImport,
          budgetLines: s.budgetLines || [],
          closingSteps: s.closingSteps || [],
          recurring: s.recurring || [],
          provisions: s.provisions || [],
          annexNotes: s.annexNotes || [],
          mobileMoneyAccounts: s.mobileMoneyAccounts || [],
          attachments: s.attachments || [],
          analyticAxes: s.analyticAxes || [],
          users: s.users || [],
          currentUserId: s.currentUserId || "",
          lastLettering: s.lastLettering || "AA",
        };
        localStorage.setItem(WORKSPACE_PREFIX + id, JSON.stringify(data));
        const idx = loadWorkspaceIndex().filter((w) => w.id !== id);
        idx.push(meta);
        saveWorkspaceIndex(idx);
        return id;
      },
      switchWorkspace: (id) => {
        try {
          const raw = localStorage.getItem(WORKSPACE_PREFIX + id);
          if (!raw) return;
          const data = JSON.parse(raw) as AppData;
          set({
            ...data,
            budgetLines: data.budgetLines ?? [],
            closingSteps: data.closingSteps ?? [],
            recurring: data.recurring ?? [],
            provisions: data.provisions ?? [],
            annexNotes: data.annexNotes ?? [],
            mobileMoneyAccounts: data.mobileMoneyAccounts ?? [],
            attachments: data.attachments ?? [],
            lastLettering: data.lastLettering ?? "AA",
            hydrated: true,
          });
        } catch {
          /* ignore */
        }
      },
      deleteWorkspace: (id) => {
        localStorage.removeItem(WORKSPACE_PREFIX + id);
        saveWorkspaceIndex(loadWorkspaceIndex().filter((w) => w.id !== id));
      
      addAnalyticAxis: (a) => {
        const id = uid("ax");
        set((s) => ({
          analyticAxes: [...(s.analyticAxes || []), { ...a, id }],
        }));
        return id;
      },
      removeAnalyticAxis: (id) =>
        set((s) => ({
          analyticAxes: (s.analyticAxes || []).filter((x) => x.id !== id),
        })),
      setCurrentUser: (id) => set({ currentUserId: id }),
      addUser: (u) => {
        const id = uid("u");
        set((s) => ({ users: [...(s.users || []), { ...u, id }] }));
        return id;
      },
      removeUser: (id) =>
        set((s) => ({
          users: (s.users || []).filter((x) => x.id !== id),
          currentUserId: s.currentUserId === id ? (s.users.find((x) => x.id !== id)?.id || "") : s.currentUserId,
        })),
      importBankCsv: (csvText) => {
        const rows = parseBankCsv(csvText);
        if (!rows.length) return 0;
        set((s) => ({
          bankImport: [
            ...(s.bankImport || []),
            ...rows.map((r) => ({
              id: uid("bk"),
              date: r.date,
              libelle: r.libelle,
              debit: r.side === "debit" ? r.amount : 0,
              credit: r.side === "credit" ? r.amount : 0,
              matched: false,
            })),
          ],
        }));
        return rows.length;
      },
      applyBankMatch: (bankId, journalId) =>
        set((s) => ({
          bankImport: (s.bankImport || []).map((b) =>
            b.id === bankId ? { ...b, matched: true } : b,
          ),
          journal: s.journal.map((l) =>
            l.id === journalId ? { ...l, lettering: l.lettering || "BQ-MATCH" } : l,
          ),
        })),
      updateBudgetCommitted: (id, committed) =>
        set((s) => ({
          budgetLines: (s.budgetLines || []).map((b) =>
            b.id === id ? { ...b, committed } : b,
          ),
        })),
},
},
      addEmployee: (e) =>
        set((s) => ({ employees: [...s.employees, { ...e, id: uid("e") }] })),
      updateEmployee: (id, patch) =>
        set((s) => ({
          employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeEmployee: (id) =>
        set((s) => ({ employees: s.employees.filter((e) => e.id !== id) })),
      postPayroll: (month) => {
        const s = get();
        const tax = countryByName(s.settings.country);
        const emps = s.employees.filter((e) => e.base > 0);
        if (!emps.length) return 0;
        const { number, counters } = bump(s.counters, "PAIE");
        const date = `${month}-28`;
        const lines: JournalLine[] = [];
        for (const e of emps) {
          const p = computePayroll(e, tax);
          // 1. Charge brut
          lines.push({
            id: uid("j"),
            date,
            piece: number,
            journal: "PAIE",
            debit: "661",
            credit: "422",
            libelle: `Salaire brut ${e.name} — ${month}`,
            amount: p.brut,
            source: "auto",
          });
          // 2. CNSS salariale
          if (p.cnssSal) {
            lines.push({
              id: uid("j"),
              date,
              piece: number,
              journal: "PAIE",
              debit: "422",
              credit: "431",
              libelle: `CNSS salariale ${e.name} — ${month}`,
              amount: p.cnssSal,
              source: "auto",
            });
          }
          // 3. IUTS
          if (p.iuts) {
            lines.push({
              id: uid("j"),
              date,
              piece: number,
              journal: "PAIE",
              debit: "422",
              credit: "4471",
              libelle: `IUTS ${e.name} — ${month}`,
              amount: p.iuts,
              source: "auto",
            });
          }
          // 4. CNSS patronale
          if (p.cnssPat) {
            lines.push({
              id: uid("j"),
              date,
              piece: number,
              journal: "PAIE",
              debit: "664",
              credit: "431",
              libelle: `CNSS patronale ${e.name} — ${month}`,
              amount: p.cnssPat,
              source: "auto",
            });
          }
          // 5. Taxe apprentissage
          if (p.apprenticeship) {
            lines.push({
              id: uid("j"),
              date,
              piece: number,
              journal: "PAIE",
              debit: "641",
              credit: "442",
              libelle: `Taxe apprentissage ${e.name} — ${month}`,
              amount: p.apprenticeship,
              source: "auto",
            });
          }
          // 6. Paiement net
          if (p.net > 0) {
            lines.push({
              id: uid("j"),
              date,
              piece: number,
              journal: "PAIE",
              debit: "422",
              credit: "521",
              libelle: `Paiement net ${e.name} — ${month}`,
              amount: p.net,
              source: "auto",
            });
          }
        }
        set({ counters, journal: [...s.journal, ...lines] });
        return emps.length;
      
      updateEmployee: (id, patch) =>
        set((s) => ({
          employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      can: (action) => {
        const s = get();
        const u = (s.users || []).find((x) => x.id === s.currentUserId);
        const role = u?.role || "admin";
        if (action === "read") return true;
        if (action === "admin") return role === "admin";
        if (action === "post") return role === "admin" || role === "comptable";
        if (action === "write") return role !== "lecture";
        return true;
      
      markDeclarationDone: (obligationId, periodKey) =>
        set((s) => ({
          declarationsDone: [
            ...(s.declarationsDone || []).filter(
              (d) => !(d.obligationId === obligationId && d.periodKey === periodKey),
            ),
            { obligationId, periodKey, doneAt: new Date().toISOString() },
          ],
        })),
      unmarkDeclarationDone: (obligationId, periodKey) =>
        set((s) => ({
          declarationsDone: (s.declarationsDone || []).filter(
            (d) => !(d.obligationId === obligationId && d.periodKey === periodKey),
          ),
        })),
      resetDeclarationObligations: () => {
        const s = get();
        set({
          declarationObligations: defaultDeclarationObligations(
            countryByName(s.settings.country),
          ),
        });
      },
},
},
      setBank: (patch) => set(patch),
      importBankCsv: (lines) =>
        set((s) => ({
          bankImport: [
            ...s.bankImport,
            ...lines.map((l) => ({ ...l, id: uid("b"), matched: l.matched ?? false })),
          ],
        })),
      toggleBankMatch: (id) =>
        set((s) => ({
          bankImport: s.bankImport.map((l) => (l.id === id ? { ...l, matched: !l.matched } : l)),
        })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const {
          hydrated,
          setHydrated,
          resetDemo,
          importData,
          updateSettings,
          markBackedUp,
          addJournalLine,
          updateJournalLine,
          removeJournalLine,
          addPartner,
          updatePartner,
          removePartner,
          addArticle,
          updateArticle,
          removeArticle,
          addStockMove,
          removeStockMove,
          addDocument,
          updateDocument,
          removeDocument,
          convertQuote,
          postDocument,
          stockOutFromInvoice,
          peekNumber,
          consumeNumber,
          addAsset,
          updateAsset,
          removeAsset,
          postAmortizations,
          addEmployee,
          updateEmployee,
          removeEmployee,
          postPayroll,
          setBank,
          importBankCsv,
          toggleBankMatch,
          ...data
        } = s;
        void hydrated;
        void setHydrated;
        void resetDemo;
        void importData;
        void updateSettings;
        void markBackedUp;
        void addJournalLine;
        void updateJournalLine;
        void removeJournalLine;
        void addPartner;
        void updatePartner;
        void removePartner;
        void addArticle;
        void updateArticle;
        void removeArticle;
        void addStockMove;
        void removeStockMove;
        void addDocument;
        void updateDocument;
        void removeDocument;
        void convertQuote;
        void postDocument;
        void stockOutFromInvoice;
        void peekNumber;
        void consumeNumber;
        void addAsset;
        void updateAsset;
        void removeAsset;
        void postAmortizations;
        void addEmployee;
        void updateEmployee;
        void removeEmployee;
        void postPayroll;
        void setBank;
        void importBankCsv;
        void toggleBankMatch;
        return data;
      },
    },
  ),
);

export function exportBackup(): string {
  const s = useAppStore.getState();
  const data: AppData = {
    version: 1,
    settings: s.settings,
    counters: s.counters,
    journal: s.journal,
    partners: s.partners,
    articles: s.articles,
    stockMoves: s.stockMoves,
    documents: s.documents,
    assets: s.assets,
    employees: s.employees,
    bankImport: s.bankImport,
    bankStatementBalance: s.bankStatementBalance,
    bankOutstandingChecks: s.bankOutstandingChecks,
    bankOutstandingDeposits: s.bankOutstandingDeposits,
    bankAdjustments: s.bankAdjustments,
    relanceDelays: s.relanceDelays,
    lastBackupAt: s.lastBackupAt,
  };
  return JSON.stringify(data, null, 2);
}
