export type Lang = "FR" | "EN";

export type JournalCode = "CAI" | "BQ" | "VTE" | "ACH" | "OD" | "AN" | "PAIE" | "AMORT";

export type DocType = "FACTURE" | "DEVIS" | "RECU" | "AVOIR" | "BON_CMD" | "BON_CLIENT";

export type DocStatus =
  | "Brouillon"
  | "Envoyée"
  | "Payée"
  | "Payée part."
  | "Converti en facture"
  | "Annulée";

export type Account = {
  code: string;
  label: string;
  classe: string;
  categorie: string;
};

export type JournalLine = {
  id: string;
  date: string;
  piece: string;
  journal: JournalCode;
  debit: string;
  credit: string;
  libelle: string;
  amount: number;
  source: "manual" | "auto";
  remark?: string;
  /** Code de lettrage (ex. AA, AB) — même code = lignes pointées entre elles */
  lettering?: string;
  /** Écriture validée (non modifiable — contrepassation uniquement) */
  locked?: boolean;
  /** Id de la ligne de contrepassation (si cette ligne a été contrepassée) */
  reversedBy?: string;
  /** Id de la ligne d'origine (si cette ligne est une contrepassation) */
  reversesId?: string;
  /** Section / axe analytique (Sage-like) */
  axeAnalytique?: string;
  /** Second axe (ex. projet) */
  axe2?: string;
};

export type AnalyticAxis = {
  id: string;
  code: string;
  label: string;
  active: boolean;
};


export type Partner = {
  id: string;
  kind: "client" | "fournisseur";
  code: string;
  name: string;
  account: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
};

export type Article = {
  id: string;
  ref: string;
  designation: string;
  unit: string;
  salePrice: number;
  purchasePrice: number;
  vatRate: number;
  notes: string;
  stockInitial: number;
  alertMin: number;
};

export type StockMove = {
  id: string;
  articleId: string;
  date: string;
  type: "ENTREE" | "SORTIE";
  qtyIn: number;
  qtyOut: number;
  piece: string;
  libelle: string;
  pu: number;
};

export type DocLine = {
  articleId?: string;
  designation: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
};

export type Document = {
  id: string;
  type: DocType;
  number: string;
  date: string;
  partnerId: string;
  lines: DocLine[];
  paid: number;
  status: DocStatus;
  paymentMode: string;
  linkedDoc: string;
  notes: string;
  currency: string;
  fxRate: number;
  saleAccount: string;
  posted: boolean;
  validityDays: number;
  motif: string;
  /** Date d'échéance (factures) — défaut = date + 30 j si vide */
  dueDate?: string;
  /** BON_CMD : marchandises reçues → autorise l'écriture d'achat */
  goodsReceived?: boolean;
  /** Taux de retenue à la source (0.05 = 5 %) */
  rasRate?: number;
  /** Montant RAS déjà calculé */
  rasAmount?: number;
};

export type MobileMoneyAccount = {
  id: string;
  provider: "Orange Money" | "Wave" | "Moov" | "MTN" | "Autre";
  phone: string;
  /** Compte SYSCOHADA (ex. 5218, 5718) */
  account: string;
  label: string;
};

export type Attachment = {
  id: string;
  /** journal line id OR document id */
  refType: "journal" | "document";
  refId: string;
  name: string;
  /** data URL or text note (base64 limited) */
  dataUrl: string;
  mime: string;
  createdAt: string;
};


/** Tranche d'impôt sur salaire (barème mensuel) */
export type TaxBracket = {
  from: number;
  to: number;
  rate: number;
};


export type Asset = {
  id: string;
  name: string;
  account: string;
  amortAccount: string;
  dateAcq: string;
  dateService: string;
  value: number;
  years: number;
  cumulOpen: number;
  posted: boolean;
  /** Valeur résiduelle prévisionnelle (AUDCIF) */
  residualValue?: number;
};

export type Employee = {
  id: string;
  name: string;
  base: number;
  overtimeHours: number;
  overtimeRate: number;
  transport: number;
  housing: number;
  otherTaxable: number;
  benefits: number;
  exempt: number;
  /** Jours de congés acquis (annuel) */
  leaveDays?: number;
  /** Jours de congés pris */
  leaveTaken?: number;
  /** Poste / fonction */
  jobTitle?: string;
  /** Date d'embauche */
  hireDate?: string;
  matricule?: string;
  bankAccount?: string;
  /** Nombre de parts fiscales */
  taxParts?: number;
  children?: number;
};

export type BankImportLine = {
  id: string;
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  matched: boolean;
};

export type CounterKey =
  | "FACTURE"
  | "RECU"
  | "BON_CMD"
  | "BON_CLIENT"
  | "DEVIS"
  | "AVOIR"
  | "PIECE_BROUILLARD"
  | "AMORTISSEMENT"
  | "PAIE"
  | "PROVISION";

export type Counter = {
  prefix: string;
  year: number;
  last: number;
};

export type Settings = {
  companyName: string;
  sigle: string;
  legalForm: string;
  rccm: string;
  nif: string;
  address: string;
  phone: string;
  country: string;
  fyStart: string;
  fyEnd: string;
  system: string;
  lang: Lang;
  /** CUMP (coût unitaire moyen pondéré) ou FIFO */
  stockMethod: "CUMP" | "FIFO";
  /** SMT (très petites) | NORMAL (référence SYSCOHADA révisé). ALLEGE est déprécié (supprimé par la révision 2017). */
  accountingSystem: "SMT" | "ALLEGE" | "NORMAL";
  /** Entreprise commerciale ou entité non lucrative (SYCEBNL) */
  entityProfile: "SYSCOHADA" | "SYCEBNL";
  /** Identifiant fiscal (IFU / NIU) pour facture normalisée */
  ifu: string;
  /** RCCM */
  rccm: string;
};

export type CountryTax = {
  country: string;
  zone: string;
  currency: string;
  vat: number;
  isRate: number;
  isMin: number;
  vatDay: number;
  isMonth: number;
  isDay: number;
  cnssDay: number;
  reliability: string;
  notes: string;
  ras: number;
  cnssEmployee: number;
  cnssEmployer: number;
  cnssCeiling: number;
  /** Barème IUTS/ITS mensuel (optionnel — défaut BF si absent) */
  iutsBrackets?: TaxBracket[];
  iutsDeductCnss?: boolean;
  apprenticeshipRate?: number;
  /** Contribution unique / formation professionnelle (patronale) */
  tfpRate?: number;
  /** CMU / assurance maladie (salarié) si distincte */
  cmuEmployee?: number;
  cmuEmployer?: number;
  /** Libellé organisme social (CNSS, CNPS, CNSS…) */
  socialOrgName?: string;
  /** Libellé impôt salarial (IUTS, ITS, IRPP…) */
  incomeTaxName?: string;
};

export type PayrollResult = {
  brut: number;
  cnssSal: number;
  cnssPat: number;
  cmuSal: number;
  cmuPat: number;
  atPat: number;
  housingPat: number;
  transportPat: number;
  iuts: number;
  net: number;
  apprenticeship: number;
  tfp: number;
  costEmployer: number;
  iutsBase: number;
  overtime: number;
  taxable: number;
  /** Détail charges patronales */
  employerCharges: { code: string; label: string; amount: number }[];
};


export type ClosingStep = {
  id: string;
  label: string;
  done: boolean;
};


export type DeclarationKind =
  | "TVA"
  | "CNSS"
  | "IUTS"
  | "IS_ACOMPTE"
  | "IS_SOLDE"
  | "IMF"
  | "IRM"
  | "IRCM"
  | "LIASSE"
  | "PATENTE"
  | "TFP"
  | "RAS"
  | "AUTRE";

export type DeclarationFreq = "mensuel" | "trimestriel" | "semestriel" | "annuel";

export type DeclarationObligation = {
  id: string;
  kind: DeclarationKind;
  label: string;
  freq: DeclarationFreq;
  dueDay: number;
  monthOffset: number;
  organism: string;
  enabled: boolean;
};

export type DeclarationReminder = {
  id: string;
  obligationId: string;
  periodLabel: string;
  dueDate: string;
  status: "a_venir" | "urgent" | "en_retard" | "fait";
  amountEstimate: number;
};

/** Composant d'une immobilisation (approche par composants SYSCOHADA) */
export type AssetComponent = {
  id: string;
  assetId: string;
  label: string;
  cost: number;
  residualValue: number;
  usefulLifeYears: number;
  method: "lineaire" | "degressif" | "unites";
  accumulatedDep: number;
};

export type RetirementProvision = {
  id: string;
  employeeId?: string;
  label: string;
  amount: number;
  method: "actuarielle" | "simplifiee";
  booked: boolean;
};

/** Traite, DAT, crédit documentaire, crédit bancaire, crédit personnel, échéancier */
export type FinancialInstrumentKind =
  | "traite"
  | "traite_avalisee"
  | "dat"
  | "credit_documentaire"
  | "credit_bancaire"
  | "credit_personnel"
  | "echeancier_client"
  | "echeancier_fournisseur";

export type FinancialInstallment = {
  id: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  paidAt?: string;
  paidAmount?: number;
};

export type FinancialInstrument = {
  id: string;
  kind: FinancialInstrumentKind;
  reference: string;
  label: string;
  partnerId?: string;
  partnerName?: string;
  employeeId?: string;
  principal: number;
  interestRate: number; // % annuel
  startDate: string;
  endDate: string;
  bankName?: string;
  currency: string;
  status: "ouvert" | "solde" | "impaye" | "echu";
  installments: FinancialInstallment[];
  notes?: string;
  /** Avaliste pour traite avalisée */
  avaliste?: string;
  /** Banque émettrice / confirmatrice pour CREDOC */
  issuingBank?: string;
};

export type SeveranceCalc = {
  id: string;
  employeeId: string;
  employeeName: string;
  reason: "licenciement" | "demission" | "retraite" | "fin_contrat" | "deces";
  hireDate: string;
  exitDate: string;
  monthlySalary: number;
  yearsOfService: number;
  noticeDays: number;
  noticePay: number;
  severancePay: number; // indemnité de licenciement
  leavePay: number; // congés payés
  retirementBonus: number;
  other: number;
  total: number;
  notes?: string;
};

export type AppData = {
  version: 2;
  settings: Settings;
  counters: Record<CounterKey, Counter>;
  journal: JournalLine[];
  partners: Partner[];
  articles: Article[];
  stockMoves: StockMove[];
  documents: Document[];
  assets: Asset[];
  employees: Employee[];
  bankImport: BankImportLine[];
  bankStatementBalance: number;
  bankOutstandingChecks: number;
  bankOutstandingDeposits: number;
  bankAdjustments: number;
  relanceDelays: [number, number, number];
  lastBackupAt: string | null;
  /** Crédit de TVA reporté de la période précédente */
  vatCreditBroughtForward: number;
  /** Réintégrations fiscales manuelles pour calcul IS */
  fiscalReintegrations: number;
  fiscalDeductions: number;
  /** Déficits reportables imputés sur l'exercice */
  deficitImputed: number;
  closingSteps: ClosingStep[];
  budget: BudgetLine[];
  /** Modèles de facturation récurrente */
  recurring: RecurringTemplate[];
  provisions: Provision[];
  /** Notes annexes libres (clôture) */
  annexNotes: AnnexNote[];
  mobileMoneyAccounts: MobileMoneyAccount[];
  attachments: Attachment[];
  analyticAxes: AnalyticAxis[];
  users: AppUser[];
  currentUserId: string;
  declarationObligations: DeclarationObligation[];
  declarationsDone: { obligationId: string; periodKey: string; doneAt: string }[];
  /** Acomptes IS déjà versés (exercice en cours) */
  acomptesIsPaid: { periodKey: string; amount: number; paidAt: string }[];
  /** Base IS N-1 pour calcul acomptes (saisie manuelle) */
  isBaseN1: number;
  assetComponents: AssetComponent[];
  retirementProvisions: RetirementProvision[];
  /** Journal N-1 pour comparabilité (optionnel) */
  journalPrevious: JournalLine[];
  financialInstruments: FinancialInstrument[];
  severanceCalcs: SeveranceCalc[];







  /** Dernier code de lettrage attribué (compteur AA, AB…) */
  lastLettering: string;
};

export type RecurringTemplate = {
  id: string;
  name: string;
  partnerId: string;
  lines: DocLine[];
  /** Jour du mois (1–28) */
  dayOfMonth: number;
  /** Prochaine date de génération YYYY-MM-DD */
  nextDate: string;
  active: boolean;
  saleAccount: string;
  notes: string;
  /** Dernière facture générée */
  lastGenerated?: string;
};


export type BudgetLine = {
  id: string;
  accountPrefix: string;
  label: string;
  /** Montant budgété annuel */
  amount: number;
};



export type BalanceRow = {
  code: string;
  label: string;
  classe: string;
  debitMvt: number;
  creditMvt: number;
  soldeD: number;
  soldeC: number;
};

export type PnlBlock = {
  label: string;
  amount: number;
  indent?: number;
  bold?: boolean;
  total?: boolean;
};


export type ProvisionKind = "clients" | "stocks" | "risques" | "autres";

export type Provision = {
  id: string;
  kind: ProvisionKind;
  label: string;
  /** Compte de dotation (ex. 691) */
  chargeAccount: string;
  /** Compte de provision (ex. 491, 39, 19) */
  provisionAccount: string;
  amount: number;
  date: string;
  posted: boolean;
  notes: string;
};

export type AnnexNote = {
  id: string;
  code: string;
  title: string;
  body: string;
};


export type WorkspaceMeta = {
  id: string;
  name: string;
  country: string;
  accountingSystem: "SMT" | "ALLEGE" | "NORMAL";
  entityProfile: "SYSCOHADA" | "SYCEBNL";
  updatedAt: string;
};


export type UserRole = "admin" | "comptable" | "saisie" | "lecture";

export type AppUser = {
  id: string;
  name: string;
  role: UserRole;
  pin?: string;
};
