import { ACCOUNT_BY_CODE, PLAN_COMPTABLE, accountLabel } from "./accounts";
import { countryByName } from "./countries";
import { daysUntil } from "./format";
import type {
  AppData,
  Article,
  BalanceRow,
  Document,
  DocLine,
  JournalLine,
  PnlBlock,
  StockMove,
  TaxBracket,
  Employee,
  CountryTax,
  Asset,
  PayrollResult,
} from "./types";

/* ============================================================
   PRO COMPTA OHADA — Moteur comptable (v2 corrigé)
   Corrections : fxRate, CMV/stock, BC, paie IUTS, découvert,
   amort prorata, IS, balance âgée, équilibre pièces
   ============================================================ */

export function lineHt(line: DocLine, fxRate = 1): number {
  const rate = fxRate > 0 ? fxRate : 1;
  return Math.round(line.qty * line.unitPrice * rate);
}

export function lineTva(line: DocLine, fxRate = 1): number {
  return Math.round(lineHt(line, fxRate) * line.vatRate);
}

export function docTotals(doc: Document): { ht: number; tva: number; ttc: number; reste: number } {
  const fx = doc.fxRate > 0 ? doc.fxRate : 1;
  const ht = doc.lines.reduce((s, l) => s + lineHt(l, fx), 0);
  const tva = doc.lines.reduce((s, l) => s + lineTva(l, fx), 0);
  const ttc = ht + tva;
  return { ht, tva, ttc, reste: Math.max(0, ttc - (doc.paid || 0)) };
}

export function nextNumber(data: AppData, key: keyof AppData["counters"]): string {
  const c = data.counters[key];
  const n = String(c.last + 1).padStart(3, "0");
  return `${c.prefix}-${c.year}-${n}`;
}

export function buildBalance(journal: JournalLine[]): BalanceRow[] {
  const map = new Map<string, { d: number; c: number }>();
  const bump = (code: string, side: "d" | "c", amt: number) => {
    if (!code) return;
    const cur = map.get(code) ?? { d: 0, c: 0 };
    cur[side] += amt;
    map.set(code, cur);
  };
  for (const l of journal) {
    bump(l.debit, "d", l.amount);
    bump(l.credit, "c", l.amount);
  }
  const codes = new Set([...map.keys(), ...PLAN_COMPTABLE.map((a) => a.code)]);
  const rows: BalanceRow[] = [];
  for (const code of codes) {
    const m = map.get(code) ?? { d: 0, c: 0 };
    if (m.d === 0 && m.c === 0) continue;
    const net = m.d - m.c;
    const acc = ACCOUNT_BY_CODE[code];
    rows.push({
      code,
      label: acc?.label ?? code,
      classe: acc?.classe ?? code[0] ?? "",
      debitMvt: m.d,
      creditMvt: m.c,
      soldeD: net > 0 ? net : 0,
      soldeC: net < 0 ? -net : 0,
    });
  }
  rows.sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));
  return rows;
}

/** Vérifie qu'une ligne journal est valide (comptes distincts, montant > 0). */
export function pieceIsBalanced(journal: JournalLine[], piece: string): boolean {
  const lines = journal.filter((l) => l.piece === piece);
  if (!lines.length) return true;
  return lines.every((l) => l.amount >= 0 && !!l.debit && !!l.credit && l.debit !== l.credit);
}

export function accountMovements(journal: JournalLine[], code: string): JournalLine[] {
  return journal
    .filter((l) => l.debit === code || l.credit === code)
    .sort((a, b) => a.date.localeCompare(b.date) || a.piece.localeCompare(b.piece));
}

function sumPrefix(rows: BalanceRow[], prefixes: string[], side: "d" | "c" | "net"): number {
  let t = 0;
  for (const r of rows) {
    if (!prefixes.some((p) => r.code.startsWith(p))) continue;
    if (side === "d") t += r.soldeD;
    else if (side === "c") t += r.soldeC;
    else t += r.soldeD - r.soldeC;
  }
  return t;
}

function mvtPrefix(rows: BalanceRow[], prefixes: string[], side: "d" | "c"): number {
  let t = 0;
  for (const r of rows) {
    if (!prefixes.some((p) => r.code.startsWith(p))) continue;
    t += side === "d" ? r.debitMvt : r.creditMvt;
  }
  return t;
}

/** Compte de résultat SYSCOHADA (forme simplifiée du système normal). */
export function buildPnl(journal: JournalLine[]): PnlBlock[] {
  const rows = buildBalance(journal);
  const ch = (p: string[]) => mvtPrefix(rows, p, "d") - mvtPrefix(rows, p, "c");
  const pr = (p: string[]) => mvtPrefix(rows, p, "c") - mvtPrefix(rows, p, "d");

  const ventesMarch = pr(["701"]);
  const achatsMarch = ch(["601"]);
  const varStock = ch(["6031"]);
  const marge = ventesMarch - achatsMarch - varStock;

  const prodVendue = pr(["702", "703", "704", "705", "706", "707"]);
  const prodStockee = pr(["736"]);
  const prodImmo = pr(["721", "722"]);
  const production = prodVendue + prodStockee + prodImmo;

  const autresAchats = ch(["602", "604", "605", "608"]);
  const transports = ch(["611", "612", "614", "618"]);
  const services = ch([
    "621", "622", "623", "624", "625", "626", "627", "628", "631", "632", "633", "635", "637", "638",
  ]);
  const va = marge + production - autresAchats - transports - services;

  const impots = ch(["641", "645", "646", "647", "648"]);
  const perso = ch(["661", "662", "663", "664"]);
  const ebe = va - impots - perso;

  const dota = ch(["681", "691"]);
  const reprises = pr(["791", "781"]);
  const autresCh = ch(["651", "658"]);
  const autresPr = pr(["711", "754", "758"]);
  const rex = ebe - dota + reprises - autresCh + autresPr;

  const chFin = ch(["671", "673", "674", "676", "678"]);
  const prFin = pr(["771", "772", "776", "777"]);
  const rfin = prFin - chFin;
  const rao = rex + rfin;

  const chHao = ch(["811", "831", "851", "871"]);
  const prHao = pr(["821", "841", "861", "881"]);
  const rhao = prHao - chHao;
  const rai = rao + rhao;
  const is = ch(["891", "872"]);
  const net = rai - is;

  return [
    { label: "Ventes de marchandises (701)", amount: ventesMarch, indent: 1 },
    { label: "Achats de marchandises (601)", amount: -achatsMarch, indent: 1 },
    { label: "Variation de stocks (6031)", amount: -varStock, indent: 1 },
    { label: "Marge commerciale", amount: marge, bold: true, total: true },
    { label: "Production vendue (702–707)", amount: prodVendue, indent: 1 },
    { label: "Production stockée / immobilisée", amount: prodStockee + prodImmo, indent: 1 },
    { label: "Autres achats", amount: -autresAchats, indent: 1 },
    { label: "Transports & services extérieurs", amount: -(transports + services), indent: 1 },
    { label: "Valeur ajoutée", amount: va, bold: true, total: true },
    { label: "Impôts et taxes", amount: -impots, indent: 1 },
    { label: "Charges de personnel", amount: -perso, indent: 1 },
    { label: "Excédent brut d'exploitation (EBE)", amount: ebe, bold: true, total: true },
    { label: "Dotations amort. / provisions", amount: -dota, indent: 1 },
    { label: "Reprises / autres", amount: reprises - autresCh + autresPr, indent: 1 },
    { label: "Résultat d'exploitation", amount: rex, bold: true, total: true },
    { label: "Résultat financier", amount: rfin, indent: 1 },
    { label: "Résultat des activités ordinaires", amount: rao, bold: true, total: true },
    { label: "Résultat HAO", amount: rhao, indent: 1 },
    { label: "Résultat avant impôt", amount: rai, indent: 1 },
    { label: "Impôts sur le résultat", amount: -is, indent: 1 },
    { label: "Résultat net de l'exercice", amount: net, bold: true, total: true },
  ];
}

export function resultatNet(journal: JournalLine[]): number {
  const blocks = buildPnl(journal);
  const last = blocks[blocks.length - 1];
  return last?.amount ?? 0;
}

/** Résultat avant IS (pour calcul de l'impôt). */
export function resultatAvantIs(journal: JournalLine[]): number {
  const rows = buildBalance(journal);
  const ch = (p: string[]) => mvtPrefix(rows, p, "d") - mvtPrefix(rows, p, "c");
  const net = resultatNet(journal);
  const is = ch(["891", "872"]);
  return net + is;
}

type BilanSide = { label: string; amount: number; indent?: number; total?: boolean };

export function buildBilan(journal: JournalLine[]): { actif: BilanSide[]; passif: BilanSide[]; ecart: number } {
  const rows = buildBalance(journal);
  const netP = (p: string[]) => sumPrefix(rows, p, "net");

  const immoBrut = netP(["21", "22", "23", "24", "25", "26", "27"]);
  const amort = netP(["28", "29"]);
  const immoNet = immoBrut + amort;
  const stocks = netP(["31", "32", "33", "34", "35", "36", "37", "38"]) + netP(["39"]);
  const clients = netP(["411", "416", "418"]) + netP(["491"]);
  const autresCreances = netP(["409", "421", "445", "449", "46", "47", "48"]);

  let tresoActif = 0;
  let tresoPassifFrom52 = 0;
  for (const r of rows) {
    if (r.code.startsWith("56")) {
      tresoPassifFrom52 += r.soldeC - r.soldeD;
      continue;
    }
    if (
      r.code.startsWith("50") ||
      r.code.startsWith("51") ||
      r.code.startsWith("52") ||
      r.code.startsWith("53") ||
      r.code.startsWith("57") ||
      r.code.startsWith("58")
    ) {
      const net = r.soldeD - r.soldeC;
      if (net >= 0) tresoActif += net;
      else tresoPassifFrom52 += -net;
    }
    if (r.code.startsWith("59")) {
      tresoActif += r.soldeD - r.soldeC;
    }
  }

  const actifTotal = immoNet + stocks + clients + autresCreances + tresoActif;

  const capital = -netP(["10"]);
  const reserves = -netP(["11"]);
  const ran = -netP(["12"]) - netP(["13"]);
  const hasClosedResult = rows.some(
    (r) => (r.code.startsWith("12") || r.code.startsWith("13")) && (r.soldeD !== 0 || r.soldeC !== 0),
  );
  const rn = hasClosedResult ? 0 : resultatNet(journal);
  const subv = -netP(["14"]);
  const emprunts = -netP(["16", "17", "18"]);
  const prov = -netP(["19", "15"]);
  const fourn = -netP(["401", "408", "481"]);
  const social = -netP(["42", "43"]);
  const fiscal = -netP(["441", "442", "443", "447", "448"]);
  const autresDettes = -netP(["419", "462", "464", "472", "476"]);
  const tresoPassif = tresoPassifFrom52;

  const cp = capital + reserves + ran + rn + subv;
  const passifTotal = cp + emprunts + prov + fourn + social + fiscal + autresDettes + tresoPassif;

  return {
    actif: [
      { label: "Immobilisations brutes", amount: immoBrut, indent: 1 },
      { label: "Amortissements et dépréciations", amount: amort, indent: 1 },
      { label: "Actif immobilisé net", amount: immoNet, total: true },
      { label: "Stocks", amount: stocks, indent: 1 },
      { label: "Clients et comptes rattachés", amount: clients, indent: 1 },
      { label: "Autres créances", amount: autresCreances, indent: 1 },
      { label: "Trésorerie-actif", amount: tresoActif, indent: 1 },
      { label: "Actif circulant", amount: stocks + clients + autresCreances + tresoActif, total: true },
      { label: "TOTAL ACTIF", amount: actifTotal, total: true },
    ],
    passif: [
      { label: "Capital", amount: capital, indent: 1 },
      { label: "Réserves", amount: reserves, indent: 1 },
      { label: "Report à nouveau", amount: ran, indent: 1 },
      { label: "Résultat net de l'exercice", amount: rn, indent: 1 },
      { label: "Subventions d'investissement", amount: subv, indent: 1 },
      { label: "Capitaux propres", amount: cp, total: true },
      { label: "Emprunts et dettes financières", amount: emprunts, indent: 1 },
      { label: "Provisions", amount: prov, indent: 1 },
      { label: "Fournisseurs", amount: fourn, indent: 1 },
      { label: "Dettes sociales", amount: social, indent: 1 },
      { label: "Dettes fiscales", amount: fiscal, indent: 1 },
      { label: "Autres dettes", amount: autresDettes, indent: 1 },
      { label: "Trésorerie-passif (découverts)", amount: tresoPassif, indent: 1 },
      { label: "TOTAL PASSIF", amount: passifTotal, total: true },
    ],
    ecart: Math.round(actifTotal - passifTotal),
  };
}

export function stockOf(article: Article, moves: StockMove[]): {
  entries: number;
  exits: number;
  qty: number;
  value: number;
  status: "OK" | "ALERTE" | "RUPTURE";
} {
  const related = moves.filter((m) => m.articleId === article.id);
  const entries = related.reduce((s, m) => s + m.qtyIn, 0);
  const exits = related.reduce((s, m) => s + m.qtyOut, 0);
  const qty = article.stockInitial + entries - exits;
  const value = qty * article.purchasePrice;
  let status: "OK" | "ALERTE" | "RUPTURE" = "OK";
  if (qty <= 0) status = "RUPTURE";
  else if (article.alertMin > 0 && qty <= article.alertMin) status = "ALERTE";
  return { entries, exits, qty, value, status };
}

export function kpis(data: AppData) {
  const tax = countryByName(data.settings.country);
  const rows = buildBalance(data.journal);
  const netP = (p: string[]) => sumPrefix(rows, p, "net");
  const rn = resultatNet(data.journal);
  const clients = netP(["411", "416", "418"]);
  const fourn = -netP(["401", "408"]);
  const bil = buildBilan(data.journal);
  const ta = bil.actif.find((a) => a.label === "Trésorerie-actif")?.amount ?? 0;
  const tp = bil.passif.find((a) => a.label.startsWith("Trésorerie-passif"))?.amount ?? 0;
  const treso = ta - tp;

  const fy = data.settings.fyStart.slice(0, 4);
  const caYear = data.journal
    .filter((l) => l.credit.startsWith("70") && l.date.startsWith(fy))
    .reduce((s, l) => s + l.amount, 0);
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const caMonth = data.journal
    .filter((l) => l.credit.startsWith("70") && l.date.startsWith(ym))
    .reduce((s, l) => s + l.amount, 0);
  const encaissMonth = data.journal
    .filter(
      (l) =>
        (l.debit === "521" || l.debit === "571") &&
        l.date.startsWith(ym) &&
        (l.credit.startsWith("411") || l.credit === "411"),
    )
    .reduce((s, l) => s + l.amount, 0);

  const unpaid = data.documents
    .filter((d) => d.type === "FACTURE")
    .reduce((s, d) => s + docTotals(d).reste, 0);

  const stockValue = data.articles.reduce((s, a) => s + stockOf(a, data.stockMoves).value, 0);
  const ruptures = data.articles.filter((a) => stockOf(a, data.stockMoves).status === "RUPTURE").length;

  const vatCollected = data.journal.filter((l) => l.credit === "4431").reduce((s, l) => s + l.amount, 0);
  const vatDeduct = data.journal.filter((l) => l.debit.startsWith("445")).reduce((s, l) => s + l.amount, 0);
  const vatCredit = data.vatCreditBroughtForward || 0;

  return {
    caMonth,
    caYear,
    encaissMonth,
    clients,
    fourn,
    treso,
    unpaid,
    stockValue,
    ruptures,
    rn,
    vatDue: vatCollected - vatDeduct - vatCredit,
    currency: tax.currency,
  };
}

export function fiscalDeadlines(data: AppData, asOf = new Date()) {
  const tax = countryByName(data.settings.country);
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const vatDate = new Date(Date.UTC(y, m, tax.vatDay));
  if (vatDate < asOf) vatDate.setUTCMonth(vatDate.getUTCMonth() + 1);
  const cnssDate = new Date(Date.UTC(y, m, tax.cnssDay));
  if (cnssDate < asOf) cnssDate.setUTCMonth(cnssDate.getUTCMonth() + 1);
  const fyEnd = data.settings.fyEnd;
  const [ey, em] = fyEnd.split("-").map(Number);
  const isDate = new Date(Date.UTC(ey, em - 1 + tax.isMonth, tax.isDay));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return [
    { id: "tva", label: "Déclaration TVA du mois", date: iso(vatDate), days: daysUntil(iso(vatDate)) },
    { id: "cnss", label: "Cotisations sociales (CNSS/CNPS)", date: iso(cnssDate), days: daysUntil(iso(cnssDate)) },
    { id: "is", label: "Impôt sur les sociétés (IS)", date: iso(isDate), days: daysUntil(iso(isDate)) },
  ];
}

export function relanceLevel(daysLate: number, delays: [number, number, number]): string {
  if (daysLate < delays[0]) return "À jour";
  if (daysLate < delays[1]) return "1re relance";
  if (daysLate < delays[2]) return "2e relance";
  return "Mise en demeure";
}

export function invoiceDueDate(doc: Document): string {
  if (doc.dueDate) return doc.dueDate;
  const [y, m, d] = doc.date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 30));
  return dt.toISOString().slice(0, 10);
}

export function agingBuckets(docs: Document[], asOf: string = new Date().toISOString().slice(0, 10)) {
  const buckets = { d0: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
  const [ay, am, ad] = asOf.split("-").map(Number);
  const asOfMs = Date.UTC(ay, am - 1, ad);
  for (const d of docs.filter((x) => x.type === "FACTURE")) {
    const reste = docTotals(d).reste;
    if (reste <= 0) continue;
    const due = invoiceDueDate(d);
    const [dy, dm, dd] = due.split("-").map(Number);
    const dueMs = Date.UTC(dy, dm - 1, dd);
    const late = Math.round((asOfMs - dueMs) / 86_400_000);
    if (late <= 0) buckets.d0 += reste;
    else if (late <= 30) buckets.d30 += reste;
    else if (late <= 60) buckets.d60 += reste;
    else if (late <= 90) buckets.d90 += reste;
    else buckets.d90p += reste;
  }
  return buckets;
}

export const DEFAULT_IUTS_BRACKETS_BF: TaxBracket[] = [
  { from: 0, to: 25000, rate: 0 },
  { from: 25000, to: 50000, rate: 0.0825 },
  { from: 50000, to: 75000, rate: 0.1375 },
  { from: 75000, to: 125000, rate: 0.165 },
  { from: 125000, to: 250000, rate: 0.22 },
  { from: 250000, to: 1e12, rate: 0.275 },
];

export function computeIuts(base: number, brackets: TaxBracket[]): number {
  if (base <= 0) return 0;
  let tax = 0;
  let remaining = base;
  for (const b of brackets) {
    const width = b.to - b.from;
    const slice = Math.min(remaining, width);
    if (slice <= 0) break;
    tax += slice * b.rate;
    remaining -= slice;
  }
  return Math.round(tax);
}

export type PayrollResult = {
  brut: number;
  cnssSal: number;
  cnssPat: number;
  iuts: number;
  net: number;
  apprenticeship: number;
  costEmployer: number;
};


/** Barème ITS Côte d'Ivoire (mensuel, réforme 2024) — source DGI / guides 2026. */
export const ITS_BRACKETS_CI: TaxBracket[] = [
  { from: 0, to: 75000, rate: 0 },
  { from: 75000, to: 240000, rate: 0.16 },
  { from: 240000, to: 800000, rate: 0.21 },
  { from: 800000, to: 2400000, rate: 0.24 },
  { from: 2400000, to: 8000000, rate: 0.28 },
  { from: 8000000, to: Infinity, rate: 0.32 },
];

export function computePayroll(e: Employee, tax: CountryTax): PayrollResult {
  const overtime = Math.round((e.base / 173.33) * (e.overtimeHours || 0) * (e.overtimeRate || 1.25));
  const brut =
    (e.base || 0) +
    overtime +
    (e.transport || 0) +
    (e.housing || 0) +
    (e.otherTaxable || 0) +
    (e.benefits || 0);
  const ceiling = tax.cnssCeiling > 0 ? Math.min(brut, tax.cnssCeiling) : brut;
  const cnssSal = Math.round(ceiling * (tax.cnssEmployee || 0));
  const cnssPat = Math.round(ceiling * (tax.cnssEmployer || 0));
  const cmuSal = Math.round(brut * (tax.cmuEmployee || 0));
  const cmuPat = Math.round(brut * (tax.cmuEmployer || 0));
  const atPat = Math.round(brut * (tax.atRate || 0));
  const housingPat = Math.round(brut * (tax.housingContribRate || 0));
  const transportPat = Math.round(brut * (tax.transportTaxRate || 0));
  const brackets = tax.iutsBrackets?.length
    ? tax.iutsBrackets
    : tax.country === "Côte d'Ivoire"
      ? ITS_BRACKETS_CI
      : DEFAULT_IUTS_BRACKETS_BF;
  const deductCnss = tax.iutsDeductCnss !== false;
  const socialSal = cnssSal + cmuSal;
  const taxable = Math.max(0, (deductCnss ? brut - socialSal : brut) - (e.exempt || 0));
  const parts = Math.max(1, e.taxParts || 1);
  const iutsBase = Math.round(taxable / parts);
  const iuts = computeIuts(iutsBase, brackets);
  const net = brut - cnssSal - cmuSal - iuts;
  const apprenticeship = Math.round(brut * (tax.apprenticeshipRate ?? 0));
  const tfp = Math.round(brut * (tax.tfpRate ?? 0));
  const employerCharges: { code: string; label: string; amount: number }[] = [
    { code: "CNSS_PAT", label: `${tax.socialOrgName || "CNSS"} patronale`, amount: cnssPat },
    { code: "CMU_PAT", label: "CMU / maladie patronale", amount: cmuPat },
    { code: "AT", label: "Accidents du travail", amount: atPat },
    { code: "LOGEMENT", label: "Contribution logement", amount: housingPat },
    { code: "TRANSPORT", label: "Versement transport", amount: transportPat },
    { code: "APPRENTISSAGE", label: "Taxe d'apprentissage", amount: apprenticeship },
    { code: "TFP", label: "TFP / formation", amount: tfp },
  ].filter((x) => x.amount > 0);
  const costEmployer =
    brut + cnssPat + cmuPat + atPat + housingPat + transportPat + apprenticeship + tfp;
  return {
    brut,
    cnssSal,
    cnssPat,
    cmuSal,
    cmuPat,
    atPat,
    housingPat,
    transportPat,
    iuts,
    net,
    apprenticeship,
    tfp,
    costEmployer,
    iutsBase,
    overtime,
    taxable,
    employerCharges,
  };
}

export function assetDotation(asset: Asset, fyStart: string, fyEnd: string): number {
  if (asset.value <= 0 || asset.years <= 0) return 0;
  const residual = Math.max(0, asset.residualValue || 0);
  const amortizable = Math.max(0, asset.value - residual);
  if (amortizable <= 0) return 0;
  const annual = amortizable / asset.years;
  const service = asset.dateService || asset.dateAcq;
  const start = service > fyStart ? service : fyStart;
  if (start > fyEnd) return 0;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = fyEnd.split("-").map(Number);
  let months = (ey - sy) * 12 + (em - sm) + 1;
  if (months < 0) months = 0;
  if (months > 12) months = 12;
  const already = asset.cumulOpen || 0;
  const remaining = Math.max(0, amortizable - already);
  const raw = Math.round((annual * months) / 12);
  return Math.min(raw, remaining);
}

export function computeIs(data: AppData): {
  resultatComptable: number;
  resultatFiscal: number;
  isTheorique: number;
  isMinimum: number;
  isDue: number;
} {
  const tax = countryByName(data.settings.country);
  const resultatComptable = resultatAvantIs(data.journal);
  const reint = data.fiscalReintegrations || 0;
  const deduc = data.fiscalDeductions || 0;
  const deficit = data.deficitImputed || 0;
  const resultatFiscal = resultatComptable + reint - deduc - deficit;
  const isTheorique = Math.round(Math.max(0, resultatFiscal) * tax.isRate);
  const k = kpis(data);
  const isMinimum = Math.round(Math.max(0, k.caYear) * tax.isMin);
  const isDue = Math.max(isTheorique, isMinimum);
  return { resultatComptable, resultatFiscal, isTheorique, isMinimum, isDue };
}

export function suggestedEntries(doc: Document, partnerAccount: string): Omit<JournalLine, "id">[] {
  const { ht, tva, ttc } = docTotals(doc);
  const common = {
    date: doc.date,
    piece: doc.number,
    source: "auto" as const,
    remark: "Auto",
  };
  if (doc.type === "FACTURE") {
    const sale = doc.saleAccount || "701";
    const lines: Omit<JournalLine, "id">[] = [
      {
        ...common,
        journal: "VTE",
        debit: partnerAccount,
        credit: sale,
        libelle: `Facture ${doc.number} — HT`,
        amount: ht,
      },
    ];
    if (tva) {
      lines.push({
        ...common,
        journal: "VTE",
        debit: partnerAccount,
        credit: "4431",
        libelle: `TVA — ${doc.number}`,
        amount: tva,
      });
    }
    return lines;
  }
  if (doc.type === "AVOIR") {
    const sale = doc.saleAccount || "701";
    const lines: Omit<JournalLine, "id">[] = [
      {
        ...common,
        journal: "VTE",
        debit: sale,
        credit: partnerAccount,
        libelle: `Avoir ${doc.number} — HT`,
        amount: ht,
      },
    ];
    if (tva) {
      lines.push({
        ...common,
        journal: "VTE",
        debit: "4431",
        credit: partnerAccount,
        libelle: `Avoir ${doc.number} — TVA`,
        amount: tva,
      });
    }
    return lines;
  }
  if (doc.type === "RECU") {
    const mode = (doc.paymentMode || "").toLowerCase();
    const debit =
      mode.includes("caisse") || mode.includes("espèce") || mode.includes("espece") ? "571" : "521";
    return [
      {
        ...common,
        journal: debit === "571" ? "CAI" : "BQ",
        debit,
        credit: partnerAccount,
        libelle: `Reçu ${doc.number}`,
        amount: doc.paid || ttc,
      },
    ];
  }
  if (doc.type === "BON_CMD") {
    if (!doc.goodsReceived) return [];
    const lines: Omit<JournalLine, "id">[] = [
      {
        ...common,
        journal: "ACH",
        debit: "601",
        credit: partnerAccount,
        libelle: `Réception commande ${doc.number} — HT`,
        amount: ht,
      },
    ];
    if (tva) {
      lines.push({
        ...common,
        journal: "ACH",
        debit: "4452",
        credit: partnerAccount,
        libelle: `TVA récupérable — ${doc.number}`,
        amount: tva,
      });
    }
    return lines;
  }
  return [];
}

/** CMV : Débit 6031 / Crédit 311 (facture) ou inverse (avoir). */
export function cogsEntries(doc: Document, articles: Article[]): Omit<JournalLine, "id">[] {
  if (doc.type !== "FACTURE" && doc.type !== "AVOIR") return [];
  const lines: Omit<JournalLine, "id">[] = [];
  const isAvoir = doc.type === "AVOIR";
  for (const line of doc.lines) {
    if (!line.articleId || line.qty <= 0) continue;
    const art = articles.find((a) => a.id === line.articleId);
    if (!art || art.purchasePrice <= 0) continue;
    const amount = Math.round(line.qty * art.purchasePrice);
    if (amount <= 0) continue;
    if (!isAvoir) {
      lines.push({
        date: doc.date,
        piece: doc.number,
        journal: "OD",
        debit: "6031",
        credit: "311",
        libelle: `CMV ${art.designation} — ${doc.number}`,
        amount,
        source: "auto",
        remark: "Auto-CMV",
      });
    } else {
      lines.push({
        date: doc.date,
        piece: doc.number,
        journal: "OD",
        debit: "311",
        credit: "6031",
        libelle: `Reprise CMV ${art.designation} — ${doc.number}`,
        amount,
        source: "auto",
        remark: "Auto-CMV",
      });
    }
  }
  return lines;
}

export { accountLabel };


/* ---------- Tableau des flux de trésorerie (simplifié SYSCOHADA) ---------- */
export type TftLine = { label: string; amount: number; indent?: number; bold?: boolean; total?: boolean };

export function buildTft(journal: JournalLine[]): TftLine[] {
  const rows = buildBalance(journal);
  const mvt = (prefixes: string[], side: "d" | "c") => {
    let t = 0;
    for (const r of rows) {
      if (!prefixes.some((p) => r.code.startsWith(p))) continue;
      t += side === "d" ? r.debitMvt : r.creditMvt;
    }
    return t;
  };
  // CAFG approx = RN + dotations - reprises
  const rn = resultatNet(journal);
  const dota = mvt(["681", "691"], "d") - mvt(["681", "691"], "c");
  const reprises = mvt(["781", "791"], "c") - mvt(["781", "791"], "d");
  const cafg = rn + dota - reprises;

  // Variation BFR simplifiée : Δ clients + Δ stocks - Δ fournisseurs
  const clients = mvt(["411", "416", "418"], "d") - mvt(["411", "416", "418"], "c");
  const stocks = mvt(["31", "32", "33", "34", "35"], "d") - mvt(["31", "32", "33", "34", "35"], "c");
  const fourn = mvt(["401", "408"], "c") - mvt(["401", "408"], "d");
  const varBfr = clients + stocks - fourn;

  const fluxExpl = cafg - varBfr;

  // Investissement : acquisitions immo (débit 2x hors 28)
  const inv = mvt(["21", "22", "23", "24", "25", "26", "27"], "d");
  const cessions = mvt(["21", "22", "23", "24", "25", "26", "27"], "c");
  const fluxInv = cessions - inv;

  // Financement : capital, emprunts
  const capital = mvt(["10"], "c") - mvt(["10"], "d");
  const emprunts = mvt(["16", "17"], "c") - mvt(["16", "17"], "d");
  const fluxFin = capital + emprunts;

  const variation = fluxExpl + fluxInv + fluxFin;

  return [
    { label: "Résultat net", amount: rn, indent: 1 },
    { label: "Dotations aux amortissements / provisions", amount: dota, indent: 1 },
    { label: "Reprises", amount: -reprises, indent: 1 },
    { label: "Capacité d'autofinancement globale (CAFG)", amount: cafg, bold: true, total: true },
    { label: "Variation du BFR (clients + stocks − fournisseurs)", amount: -varBfr, indent: 1 },
    { label: "Flux net de trésorerie d'exploitation", amount: fluxExpl, bold: true, total: true },
    { label: "Acquisitions d'immobilisations", amount: -inv, indent: 1 },
    { label: "Cessions d'immobilisations", amount: cessions, indent: 1 },
    { label: "Flux net de trésorerie d'investissement", amount: fluxInv, bold: true, total: true },
    { label: "Variation de capital", amount: capital, indent: 1 },
    { label: "Variation des emprunts", amount: emprunts, indent: 1 },
    { label: "Flux net de trésorerie de financement", amount: fluxFin, bold: true, total: true },
    { label: "Variation de trésorerie de la période", amount: variation, bold: true, total: true },
  ];
}

/** Budget vs réalisé par préfixe de compte. */
export function budgetVsActual(
  journal: JournalLine[],
  budget: { accountPrefix: string; label: string; amount: number }[],
): { label: string; prefix: string; budget: number; actual: number; variance: number; pct: number }[] {
  const rows = buildBalance(journal);
  return budget.map((b) => {
    let actual = 0;
    for (const r of rows) {
      if (!r.code.startsWith(b.accountPrefix)) continue;
      // Charges (6) = solde débiteur ; produits (7) = solde créditeur
      if (b.accountPrefix.startsWith("6") || b.accountPrefix.startsWith("8")) {
        actual += r.soldeD - r.soldeC;
      } else if (b.accountPrefix.startsWith("7")) {
        actual += r.soldeC - r.soldeD;
      } else {
        actual += Math.abs(r.soldeD - r.soldeC);
      }
    }
    const variance = actual - b.amount;
    const pct = b.amount !== 0 ? (actual / b.amount) * 100 : 0;
    return { label: b.label, prefix: b.accountPrefix, budget: b.amount, actual, variance, pct };
  });
}


/* ---------- Lettrage ---------- */
export type OpenItem = {
  lineId: string;
  date: string;
  piece: string;
  libelle: string;
  /** Sens du mouvement sur le compte : D ou C */
  side: "D" | "C";
  amount: number;
  lettering?: string;
};

/** Mouvements non lettrés (ou partiellement) sur un compte tiers. */
export function openItemsForAccount(journal: JournalLine[], account: string): OpenItem[] {
  const items: OpenItem[] = [];
  for (const l of journal) {
    if (l.lettering) continue; // déjà lettré
    if (l.debit === account) {
      items.push({
        lineId: l.id,
        date: l.date,
        piece: l.piece,
        libelle: l.libelle,
        side: "D",
        amount: l.amount,
      });
    }
    if (l.credit === account) {
      items.push({
        lineId: l.id,
        date: l.date,
        piece: l.piece,
        libelle: l.libelle,
        side: "C",
        amount: l.amount,
      });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.piece.localeCompare(b.piece));
  return items;
}

/** Solde ouvert d'un compte (non lettré). */
export function openBalance(journal: JournalLine[], account: string): number {
  const items = openItemsForAccount(journal, account);
  let bal = 0;
  for (const it of items) {
    bal += it.side === "D" ? it.amount : -it.amount;
  }
  return bal;
}

/**
 * Vérifie qu'un ensemble de lignes peut être lettré :
 * Σ débits = Σ crédits sur le compte.
 */
export function canLetter(items: OpenItem[]): { ok: boolean; debit: number; credit: number } {
  let debit = 0;
  let credit = 0;
  for (const it of items) {
    if (it.side === "D") debit += it.amount;
    else credit += it.amount;
  }
  return { ok: debit === credit && debit > 0, debit, credit };
}

/** Génère le prochain code de lettrage (AA, AB… AZ, BA…). */
export function nextLetteringCode(last: string): string {
  if (!last || last.length < 2) return "AA";
  const a = last.charCodeAt(0);
  const b = last.charCodeAt(1);
  if (b < 90) return String.fromCharCode(a) + String.fromCharCode(b + 1); // A..Z
  if (a < 90) return String.fromCharCode(a + 1) + "A";
  return "AA";
}


/** Soldes intermédiaires de gestion / ESS (forme pédagogique SYSCOHADA). */
export function buildEss(journal: JournalLine[]): PnlBlock[] {
  // Réutilise la cascade du CR pour exposer les SSG nommés
  const pnl = buildPnl(journal);
  const find = (labelPart: string) => pnl.find((b) => b.label.includes(labelPart))?.amount ?? 0;
  return [
    { label: "Chiffre d'affaires (ventes marchandises + production)", amount: find("Ventes de marchandises") + find("Production vendue"), bold: true },
    { label: "Marge commerciale", amount: find("Marge commerciale"), total: true },
    { label: "Production de l'exercice", amount: find("Production vendue") + find("Production stockée"), indent: 1 },
    { label: "Valeur ajoutée (VA)", amount: find("Valeur ajoutée"), bold: true, total: true },
    { label: "Excédent brut d'exploitation (EBE)", amount: find("Excédent brut"), bold: true, total: true },
    { label: "Résultat d'exploitation (RE)", amount: find("Résultat d'exploitation"), bold: true, total: true },
    { label: "Résultat financier", amount: find("Résultat financier"), indent: 1 },
    { label: "Résultat des activités ordinaires (RAO)", amount: find("activités ordinaires"), total: true },
    { label: "Résultat HAO", amount: find("Résultat HAO"), indent: 1 },
    { label: "Résultat net de l'exercice", amount: find("Résultat net"), bold: true, total: true },
  ];
}

/** Catalogue d'écritures types (assistant formation). */
export type EcritureType = {
  id: string;
  label: string;
  debit: string;
  credit: string;
  libelle: string;
  journal: "CAI" | "BQ" | "VTE" | "ACH" | "OD" | "AN" | "PAIE" | "AMORT";
};

export const ECRITURES_TYPES: EcritureType[] = [
  { id: "achat_march", label: "Achat marchandises à crédit", debit: "601", credit: "401", libelle: "Achats marchandises", journal: "ACH" },
  { id: "tva_ach", label: "TVA récupérable sur achat", debit: "4452", credit: "401", libelle: "TVA récupérable", journal: "ACH" },
  { id: "vente_credit", label: "Vente à crédit HT", debit: "411", credit: "701", libelle: "Vente marchandises", journal: "VTE" },
  { id: "tva_vte", label: "TVA collectée sur vente", debit: "411", credit: "4431", libelle: "TVA collectée", journal: "VTE" },
  { id: "regl_client_bq", label: "Règlement client banque", debit: "521", credit: "411", libelle: "Règlement client", journal: "BQ" },
  { id: "regl_client_caisse", label: "Règlement client caisse", debit: "571", credit: "411", libelle: "Règlement client espèces", journal: "CAI" },
  { id: "regl_fourn", label: "Règlement fournisseur", debit: "401", credit: "521", libelle: "Paiement fournisseur", journal: "BQ" },
  { id: "dot_amort", label: "Dotation amortissement", debit: "681", credit: "284", libelle: "Dotation amortissement", journal: "AMORT" },
  { id: "var_stock", label: "Variation stock marchandises (sortie)", debit: "6031", credit: "311", libelle: "Variation de stock", journal: "OD" },
  { id: "prov_clients", label: "Provision clients douteux", debit: "691", credit: "491", libelle: "Provision pour dépréciation clients", journal: "OD" },
  { id: "prov_risques", label: "Provision pour risques", debit: "691", credit: "191", libelle: "Provision pour risques et charges", journal: "OD" },
  { id: "salaire_brut", label: "Salaire brut", debit: "661", credit: "422", libelle: "Rémunérations du personnel", journal: "PAIE" },
];


/** Coût unitaire moyen pondéré (CUMP) d'un article. */
export function cumpUnitCost(article: Article, moves: StockMove[]): number {
  let qty = article.stockInitial;
  let value = article.stockInitial * article.purchasePrice;
  const sorted = [...moves]
    .filter((m) => m.articleId === article.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const m of sorted) {
    if (m.qtyIn > 0) {
      value += m.qtyIn * (m.pu || article.purchasePrice);
      qty += m.qtyIn;
    }
    if (m.qtyOut > 0 && qty > 0) {
      const unit = value / qty;
      value -= m.qtyOut * unit;
      qty -= m.qtyOut;
    }
  }
  if (qty <= 0) return article.purchasePrice;
  return value / qty;
}

/** CMV avec CUMP si method = CUMP. */
export function cogsEntriesWithMethod(
  doc: Document,
  articles: Article[],
  moves: StockMove[],
  method: "CUMP" | "FIFO" = "CUMP",
): Omit<JournalLine, "id">[] {
  if (doc.type !== "FACTURE" && doc.type !== "AVOIR") return [];
  const lines: Omit<JournalLine, "id">[] = [];
  const isAvoir = doc.type === "AVOIR";
  for (const line of doc.lines) {
    if (!line.articleId || line.qty <= 0) continue;
    const art = articles.find((a) => a.id === line.articleId);
    if (!art || art.purchasePrice <= 0) continue;
    const unit = method === "CUMP" ? cumpUnitCost(art, moves) : art.purchasePrice;
    const amount = Math.round(line.qty * unit);
    if (amount <= 0) continue;
    if (!isAvoir) {
      lines.push({
        date: doc.date,
        piece: doc.number,
        journal: "OD",
        debit: "6031",
        credit: "311",
        libelle: `CMV CUMP ${art.designation} — ${doc.number}`,
        amount,
        source: "auto",
        remark: "Auto-CMV",
      });
    } else {
      lines.push({
        date: doc.date,
        piece: doc.number,
        journal: "OD",
        debit: "311",
        credit: "6031",
        libelle: `Reprise CMV ${art.designation} — ${doc.number}`,
        amount,
        source: "auto",
        remark: "Auto-CMV",
      });
    }
  }
  return lines;
}

/** Écriture RAS (retenue à la source) sur facture fournisseur ou client. */
export function rasEntries(
  doc: Document,
  partnerAccount: string,
): Omit<JournalLine, "id">[] {
  const rate = doc.rasRate || 0;
  if (rate <= 0) return [];
  const { ht } = docTotals(doc);
  const ras = Math.round(ht * rate);
  if (ras <= 0) return [];
  // RAS sur paiement fournisseur (marché public / prestation) : 401 / 4472 (État RAS)
  // Ou sur encaissement client si on est retenu : 4472 / 411
  if (doc.type === "BON_CMD" || (doc.type === "FACTURE" && doc.saleAccount === "601")) {
    return [
      {
        date: doc.date,
        piece: doc.number,
        journal: "OD",
        debit: partnerAccount,
        credit: "4472",
        libelle: `RAS ${(rate * 100).toFixed(1)} % — ${doc.number}`,
        amount: ras,
        source: "auto",
        remark: "RAS",
      },
    ];
  }
  // Facture client avec RAS subie (client retient)
  if (doc.type === "FACTURE") {
    return [
      {
        date: doc.date,
        piece: doc.number,
        journal: "OD",
        debit: "4472",
        credit: partnerAccount,
        libelle: `RAS subie ${(rate * 100).toFixed(1)} % — ${doc.number}`,
        amount: ras,
        source: "auto",
        remark: "RAS",
      },
    ];
  }
  return [];
}


/** Livre de recettes-dépenses (Système Minimal de Trésorerie). */
export function buildSmtRecettesDepenses(journal: JournalLine[]): {
  recettes: number;
  depenses: number;
  solde: number;
  lines: { date: string; libelle: string; recette: number; depense: number }[];
} {
  const cash = journal.filter(
    (l) =>
      l.debit.startsWith("5") ||
      l.credit.startsWith("5") ||
      l.journal === "CAI" ||
      l.journal === "BQ",
  );
  const lines: { date: string; libelle: string; recette: number; depense: number }[] = [];
  let recettes = 0;
  let depenses = 0;
  for (const l of cash) {
    const isRecette = l.debit.startsWith("5") || (l.journal === "CAI" && l.debit.startsWith("5"));
    // Encaissement : débit trésorerie
    if (l.debit.startsWith("5")) {
      recettes += l.amount;
      lines.push({ date: l.date, libelle: l.libelle, recette: l.amount, depense: 0 });
    } else if (l.credit.startsWith("5")) {
      depenses += l.amount;
      lines.push({ date: l.date, libelle: l.libelle, recette: 0, depense: l.amount });
    }
  }
  return { recettes, depenses, solde: recettes - depenses, lines };
}

/** Bilan simplifié (système allégé). */
export function buildBilanAllege(journal: JournalLine[]): {
  actif: { label: string; amount: number }[];
  passif: { label: string; amount: number }[];
  totalActif: number;
  totalPassif: number;
} {
  const bil = buildBilan(journal);
  const sum = (keys: string[]) =>
    bil.actif.filter((r) => keys.some((k) => r.label.includes(k))).reduce((a, r) => a + r.net, 0) ||
    bil.actif.reduce((a, r) => a + (keys.some((k) => r.label.toLowerCase().includes(k.toLowerCase())) ? r.net : 0), 0);
  // Groupes larges
  let immob = 0, stocks = 0, creances = 0, treso = 0;
  for (const r of bil.actif) {
    const L = r.label.toLowerCase();
    if (L.includes("immobil") || L.includes("amort")) immob += r.net;
    else if (L.includes("stock")) stocks += r.net;
    else if (L.includes("créance") || L.includes("client") || L.includes("état")) creances += r.net;
    else if (L.includes("trésor") || L.includes("banque") || L.includes("caisse")) treso += r.net;
    else immob += r.net; // fallback
  }
  let capitaux = 0, dettes = 0;
  for (const r of bil.passif) {
    const L = r.label.toLowerCase();
    if (L.includes("capital") || L.includes("réserve") || L.includes("résultat") || L.includes("report"))
      capitaux += r.net;
    else dettes += r.net;
  }
  const actif = [
    { label: "Actif immobilisé", amount: immob },
    { label: "Stocks", amount: stocks },
    { label: "Créances", amount: creances },
    { label: "Trésorerie", amount: treso },
  ];
  const passif = [
    { label: "Capitaux propres", amount: capitaux },
    { label: "Dettes", amount: dettes },
  ];
  return {
    actif,
    passif,
    totalActif: actif.reduce((a, x) => a + x.amount, 0),
    totalPassif: passif.reduce((a, x) => a + x.amount, 0),
  };
}


/** Compte de résultat par axe analytique. */
export function buildAnalyticPnl(
  journal: JournalLine[],
  axeCode?: string,
): { axe: string; charges: number; produits: number; resultat: number }[] {
  const map = new Map<string, { charges: number; produits: number }>();
  for (const l of journal) {
    const axe = l.axeAnalytique || "(sans axe)";
    if (axeCode && axe !== axeCode && !(axeCode === "(sans axe)" && !l.axeAnalytique)) continue;
    if (!map.has(axe)) map.set(axe, { charges: 0, produits: 0 });
    const row = map.get(axe)!;
    if (l.debit.startsWith("6") || l.debit.startsWith("8")) row.charges += l.amount;
    if (l.credit.startsWith("6") || l.credit.startsWith("8")) row.charges -= l.amount;
    if (l.credit.startsWith("7") || l.credit.startsWith("8")) row.produits += l.amount;
    if (l.debit.startsWith("7") || l.debit.startsWith("8")) row.produits -= l.amount;
  }
  // Fix HAO double-count: simplify — 6 = charges, 7 = produits only
  map.clear();
  for (const l of journal) {
    const axe = l.axeAnalytique || "(sans axe)";
    if (axeCode && axe !== axeCode) continue;
    if (!map.has(axe)) map.set(axe, { charges: 0, produits: 0 });
    const row = map.get(axe)!;
    if (l.debit.startsWith("6")) row.charges += l.amount;
    if (l.credit.startsWith("6")) row.charges -= l.amount;
    if (l.credit.startsWith("7")) row.produits += l.amount;
    if (l.debit.startsWith("7")) row.produits -= l.amount;
  }
  return [...map.entries()]
    .map(([axe, v]) => ({
      axe,
      charges: Math.round(v.charges),
      produits: Math.round(v.produits),
      resultat: Math.round(v.produits - v.charges),
    }))
    .sort((a, b) => a.axe.localeCompare(b.axe));
}

/** Parse CSV relevé bancaire (date;libelle;debit;credit ou date,libelle,montant). */
export function parseBankCsv(text: string): {
  date: string;
  libelle: string;
  amount: number;
  side: "debit" | "credit";
}[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].toLowerCase().split(sep).map((h) => h.trim().replace(/"/g, ""));
  const di = header.findIndex((h) => h.includes("date"));
  const li = header.findIndex((h) => h.includes("libell") || h.includes("label") || h.includes("desc"));
  const dei = header.findIndex((h) => h.includes("débit") || h.includes("debit"));
  const cri = header.findIndex((h) => h.includes("crédit") || h.includes("credit"));
  const mi = header.findIndex((h) => h.includes("montant") || h.includes("amount") || h === "mvt");
  const out: { date: string; libelle: string; amount: number; side: "debit" | "credit" }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const rawDate = di >= 0 ? cols[di] : cols[0];
    const libelle = li >= 0 ? cols[li] : cols[1] || "";
    let amount = 0;
    let side: "debit" | "credit" = "debit";
    if (dei >= 0 || cri >= 0) {
      const d = dei >= 0 ? parseFloat((cols[dei] || "0").replace(/\s/g, "").replace(",", ".")) : 0;
      const c = cri >= 0 ? parseFloat((cols[cri] || "0").replace(/\s/g, "").replace(",", ".")) : 0;
      if (d > 0) {
        amount = d;
        side = "debit";
      } else if (c > 0) {
        amount = c;
        side = "credit";
      }
    } else if (mi >= 0) {
      amount = Math.abs(parseFloat((cols[mi] || "0").replace(/\s/g, "").replace(",", ".")));
      const signed = parseFloat((cols[mi] || "0").replace(/\s/g, "").replace(",", "."));
      side = signed < 0 ? "debit" : "credit";
    }
    if (!amount || !rawDate) continue;
    // normalize date
    let date = rawDate;
    const m = rawDate.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? "20" + m[3] : m[3];
      date = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    out.push({ date, libelle, amount: Math.round(amount), side });
  }
  return out;
}

/** Suggère un lettrage banque : montant journal vs ligne relevé. */
export function suggestBankMatches(
  journal: JournalLine[],
  bankLines: { id: string; date: string; libelle: string; debit: number; credit: number; matched?: boolean }[],
  bankAccount = "521",
): { bankId: string; journalId: string; score: number }[] {
  const openBank = bankLines.filter((b) => !b.matched);
  const cashJ = journal.filter(
    (l) => (l.debit.startsWith(bankAccount) || l.credit.startsWith(bankAccount)) && !l.lettering,
  );
  const suggestions: { bankId: string; journalId: string; score: number }[] = [];
  for (const b of openBank) {
    const bAmt = b.debit || b.credit;
    for (const j of cashJ) {
      if (Math.abs(j.amount - bAmt) > 1) continue;
      let score = 50;
      if (j.date === b.date) score += 30;
      const jl = j.libelle.toLowerCase();
      const bl = b.libelle.toLowerCase();
      if (jl && bl && (jl.includes(bl.slice(0, 8)) || bl.includes(jl.slice(0, 8)))) score += 20;
      suggestions.push({ bankId: b.id, journalId: j.id, score });
    }
  }
  return suggestions.sort((a, b) => b.score - a.score);
}


/** Balance analytique : soldes de comptes ventilés par axe. */
export function buildAnalyticBalance(
  journal: JournalLine[],
  axeField: "axeAnalytique" | "axe2" = "axeAnalytique",
): { axe: string; code: string; debit: number; credit: number; solde: number }[] {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const l of journal) {
    const axe = (axeField === "axe2" ? l.axe2 : l.axeAnalytique) || "(sans axe)";
    const keyD = `${axe}||${l.debit}`;
    const keyC = `${axe}||${l.credit}`;
    if (!map.has(keyD)) map.set(keyD, { debit: 0, credit: 0 });
    if (!map.has(keyC)) map.set(keyC, { debit: 0, credit: 0 });
    map.get(keyD)!.debit += l.amount;
    map.get(keyC)!.credit += l.amount;
  }
  return [...map.entries()]
    .map(([k, v]) => {
      const [axe, code] = k.split("||");
      return {
        axe,
        code,
        debit: Math.round(v.debit),
        credit: Math.round(v.credit),
        solde: Math.round(v.debit - v.credit),
      };
    })
    .filter((r) => r.debit || r.credit)
    .sort((a, b) => a.axe.localeCompare(b.axe) || a.code.localeCompare(b.code));
}

/** KPIs élargis style tableau de bord Sage. */
export function buildDashboardBi(data: {
  journal: JournalLine[];
  documents: Document[];
  partners: { id: string; type: string }[];
  bankImport?: { matched: boolean }[];
}): {
  ca: number;
  charges: number;
  resultat: number;
  tresorerie: number;
  creancesClients: number;
  dettesFournisseurs: number;
  facturesImpayees: number;
  devisEnCours: number;
  tauxRapprochementBanque: number;
  nbEcritures: number;
  topCharges: { code: string; amount: number }[];
  caMensuel: { month: string; amount: number }[];
} {
  const bal = buildBalance(data.journal);
  let ca = 0, charges = 0, tresorerie = 0, creances = 0, dettes = 0;
  for (const r of bal) {
    const s = (r.soldeD || 0) - (r.soldeC || 0);
    if (r.code.startsWith("7")) ca += (r.soldeC || 0) - (r.soldeD || 0);
    if (r.code.startsWith("6")) charges += (r.soldeD || 0) - (r.soldeC || 0);
    if (r.code.startsWith("5")) tresorerie += s;
    if (r.code.startsWith("411")) creances += s;
    if (r.code.startsWith("401")) dettes += -s;
  }
  const unpaid = data.documents.filter(
    (d) => d.type === "FACTURE" && d.posted && (d.paid || 0) < d.lines.reduce((a, l) => a + l.qty * l.pu * (1 + (l.tva || 0) / 100), 0) * 0.99,
  ).length;
  const devis = data.documents.filter((d) => d.type === "DEVIS" && d.status !== "annule").length;
  const bank = data.bankImport || [];
  const matched = bank.filter((b) => b.matched).length;
  const taux = bank.length ? Math.round((matched / bank.length) * 100) : 100;

  const chargeMap = new Map<string, number>();
  for (const l of data.journal) {
    if (l.debit.startsWith("6")) {
      chargeMap.set(l.debit, (chargeMap.get(l.debit) || 0) + l.amount);
    }
  }
  const topCharges = [...chargeMap.entries()]
    .map(([code, amount]) => ({ code, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const monthMap = new Map<string, number>();
  for (const l of data.journal) {
    if (!l.credit.startsWith("7")) continue;
    const m = l.date.slice(0, 7);
    monthMap.set(m, (monthMap.get(m) || 0) + l.amount);
  }
  const caMensuel = [...monthMap.entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    ca: Math.round(ca),
    charges: Math.round(charges),
    resultat: Math.round(ca - charges),
    tresorerie: Math.round(tresorerie),
    creancesClients: Math.round(creances),
    dettesFournisseurs: Math.round(dettes),
    facturesImpayees: unpaid,
    devisEnCours: devis,
    tauxRapprochementBanque: taux,
    nbEcritures: data.journal.length,
    topCharges,
    caMensuel,
  };
}


/** Obligations déclaratives par défaut selon pays / CountryTax. */
export function defaultDeclarationObligations(tax: CountryTax): import("./types").DeclarationObligation[] {
  const org = tax.socialOrgName || "CNSS";
  const taxName = tax.incomeTaxName || "IUTS";
  return [
    {
      id: "tva_m",
      kind: "TVA",
      label: "Déclaration TVA",
      freq: "mensuel",
      dueDay: tax.vatDay || 15,
      monthOffset: 1,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "cnss_m",
      kind: "CNSS",
      label: `Cotisations ${org}`,
      freq: "mensuel",
      dueDay: tax.cnssDay || 15,
      monthOffset: 1,
      organism: org,
      enabled: true,
    },
    {
      id: "iuts_m",
      kind: "IUTS",
      label: `${taxName} (retenues salaires)`,
      freq: "mensuel",
      dueDay: tax.cnssDay || 15,
      monthOffset: 1,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "tfp_m",
      kind: "TFP",
      label: "TFP / formation / apprentissage",
      freq: "mensuel",
      dueDay: tax.cnssDay || 15,
      monthOffset: 1,
      organism: "DGI / Fonds",
      enabled: !!(tax.tfpRate || tax.apprenticeshipRate),
    },
    {
      id: "ras_m",
      kind: "RAS",
      label: "Retenues à la source (prestations)",
      freq: "mensuel",
      dueDay: tax.vatDay || 15,
      monthOffset: 1,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "is_t1",
      kind: "IS_ACOMPTE",
      label: "Acompte IS 1er trimestre",
      freq: "trimestriel",
      dueDay: tax.isDay || 30,
      monthOffset: 0,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "is_t2",
      kind: "IS_ACOMPTE",
      label: "Acompte IS 2e trimestre",
      freq: "trimestriel",
      dueDay: tax.isDay || 30,
      monthOffset: 0,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "is_t3",
      kind: "IS_ACOMPTE",
      label: "Acompte IS 3e trimestre",
      freq: "trimestriel",
      dueDay: tax.isDay || 30,
      monthOffset: 0,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "is_solde",
      kind: "IS_SOLDE",
      label: "Solde IS / déclaration annuelle",
      freq: "annuel",
      dueDay: tax.isDay || 30,
      monthOffset: tax.isMonth || 4,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "liasse",
      kind: "LIASSE",
      label: "Liasse fiscale / DSF",
      freq: "annuel",
      dueDay: tax.isDay || 30,
      monthOffset: tax.isMonth || 4,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "patente",
      kind: "PATENTE",
      label: "Patente / taxe professionnelle",
      freq: "annuel",
      dueDay: 31,
      monthOffset: 1,
      organism: "Trésor / communes",
      enabled: true,
    },
    {
      id: "imf",
      kind: "IMF",
      label: "Impôt minimum forfaitaire (IMF)",
      freq: "annuel",
      dueDay: tax.isDay || 30,
      monthOffset: tax.isMonth || 4,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "irm",
      kind: "IRM",
      label: "Impôt minimum / IRM (si applicable)",
      freq: "annuel",
      dueDay: tax.isDay || 30,
      monthOffset: tax.isMonth || 4,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "ircm_m",
      kind: "IRCM",
      label: "IRCM (revenus de capitaux mobiliers)",
      freq: "mensuel",
      dueDay: tax.vatDay || 15,
      monthOffset: 1,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "is_acompte_t1",
      kind: "IS_ACOMPTE",
      label: "Acompte provisionnel IS n°1",
      freq: "trimestriel",
      dueDay: tax.isDay || 30,
      monthOffset: 0,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "is_acompte_t2",
      kind: "IS_ACOMPTE",
      label: "Acompte provisionnel IS n°2",
      freq: "trimestriel",
      dueDay: tax.isDay || 30,
      monthOffset: 0,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "is_acompte_t3",
      kind: "IS_ACOMPTE",
      label: "Acompte provisionnel IS n°3",
      freq: "trimestriel",
      dueDay: tax.isDay || 30,
      monthOffset: 0,
      organism: "DGI",
      enabled: true,
    },
    {
      id: "is_acompte_t4",
      kind: "IS_ACOMPTE",
      label: "Acompte provisionnel IS n°4 (si 4 acomptes)",
      freq: "trimestriel",
      dueDay: tax.isDay || 30,
      monthOffset: 0,
      organism: "DGI",
      enabled: tax.country === "Bénin",
    },
    {
      id: "cnss_s1",
      kind: "CNSS",
      label: `Régularisation ${org} semestrielle (si applicable)`,
      freq: "semestriel",
      dueDay: 30,
      monthOffset: 1,
      organism: org,
      enabled: false,
    },
    {
      id: "cnss_t1",
      kind: "CNSS",
      label: `Déclaration trimestrielle ${org} (T1)`,
      freq: "trimestriel",
      dueDay: 30,
      monthOffset: 0,
      organism: org,
      enabled: tax.country === "Gabon" || tax.country === "Côte d'Ivoire",
    },
    {
      id: "cnss_t2",
      kind: "CNSS",
      label: `Déclaration trimestrielle ${org} (T2)`,
      freq: "trimestriel",
      dueDay: 30,
      monthOffset: 0,
      organism: org,
      enabled: tax.country === "Gabon" || tax.country === "Côte d'Ivoire",
    },
    {
      id: "cnss_t3",
      kind: "CNSS",
      label: `Déclaration trimestrielle ${org} (T3)`,
      freq: "trimestriel",
      dueDay: 30,
      monthOffset: 0,
      organism: org,
      enabled: tax.country === "Gabon" || tax.country === "Côte d'Ivoire",
    },
    {
      id: "cnss_t4",
      kind: "CNSS",
      label: `Déclaration trimestrielle ${org} (T4)`,
      freq: "trimestriel",
      dueDay: 30,
      monthOffset: 0,
      organism: org,
      enabled: tax.country === "Gabon" || tax.country === "Côte d'Ivoire",
    },
  ];
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

/** Calcule les prochaines échéances (12 mois glissants) + statut rappel. */
export function buildDeclarationCalendar(
  obligations: import("./types").DeclarationObligation[],
  done: { obligationId: string; periodKey: string; doneAt: string }[],
  asOf: string,
  estimates: Partial<Record<import("./types").DeclarationKind, number>>,
): import("./types").DeclarationReminder[] {
  const asOfDate = new Date(asOf + "T12:00:00");
  const y0 = asOfDate.getFullYear();
  const m0 = asOfDate.getMonth() + 1;
  const reminders: import("./types").DeclarationReminder[] = [];
  const doneSet = new Set(done.map((d) => `${d.obligationId}|${d.periodKey}`));

  for (const ob of obligations.filter((o) => o.enabled)) {
    // generate candidate due dates for ~14 months around asOf
    for (let k = -1; k <= 12; k++) {
      let y = y0;
      let m = m0 + k;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      while (m > 12) {
        m -= 12;
        y += 1;
      }

      let dueY = y;
      let dueM = m;
      let periodKey = "";
      let periodLabel = "";

      if (ob.freq === "mensuel") {
        // due in month m for period m - monthOffset
        let py = y;
        let pm = m - ob.monthOffset;
        while (pm < 1) {
          pm += 12;
          py -= 1;
        }
        periodKey = `${py}-${pad2(pm)}`;
        periodLabel = `Période ${periodKey}`;
        dueY = y;
        dueM = m;
      } else if (ob.freq === "trimestriel") {
        if (![3, 6, 9, 12].includes(m)) continue;
        const q = m / 3;
        periodKey = `${y}-T${q}`;
        periodLabel = `T${q} ${y}`;
        dueY = y;
        dueM = m;
      } else if (ob.freq === "semestriel") {
        if (m !== 6 && m !== 12) continue;
        periodKey = `${y}-S${m === 6 ? 1 : 2}`;
        periodLabel = `S${m === 6 ? 1 : 2} ${y}`;
        dueY = y;
        dueM = m;
      } else {
        // annuel : due in monthOffset
        if (m !== ob.monthOffset) continue;
        periodKey = `${y}`;
        periodLabel = `Exercice ${y - 1}`;
        dueY = y;
        dueM = m;
      }

      const dim = lastDayOfMonth(dueY, dueM);
      const day = Math.min(ob.dueDay, dim);
      const dueDate = `${dueY}-${pad2(dueM)}-${pad2(day)}`;
      const due = new Date(dueDate + "T12:00:00");
      const diffDays = Math.round((due.getTime() - asOfDate.getTime()) / 86400000);
      if (diffDays < -60 || diffDays > 120) continue;

      let status: import("./types").DeclarationReminder["status"] = "a_venir";
      if (doneSet.has(`${ob.id}|${periodKey}`)) status = "fait";
      else if (diffDays < 0) status = "en_retard";
      else if (diffDays <= 10) status = "urgent";

      reminders.push({
        id: `${ob.id}_${periodKey}`,
        obligationId: ob.id,
        periodLabel: `${ob.label} — ${periodLabel}`,
        dueDate,
        status,
        amountEstimate: estimates[ob.kind] || 0,
      });
    }
  }

  const order = { en_retard: 0, urgent: 1, a_venir: 2, fait: 3 };
  return reminders.sort(
    (a, b) => order[a.status] - order[b.status] || a.dueDate.localeCompare(b.dueDate),
  );
}

/** Estimations de montants déclaratifs depuis journal + paie. */
export function estimateDeclarationAmounts(
  journal: JournalLine[],
  employees: Employee[],
  tax: CountryTax,
): Partial<Record<import("./types").DeclarationKind, number>> {
  let tvaCol = 0;
  let tvaDed = 0;
  let ras = 0;
  for (const l of journal) {
    if (l.credit.startsWith("443")) tvaCol += l.amount;
    if (l.debit.startsWith("445")) tvaDed += l.amount;
    if (l.credit.startsWith("4472")) ras += l.amount;
  }
  const tvaNet = Math.max(0, tvaCol - tvaDed);
  let cnss = 0;
  let iuts = 0;
  let tfp = 0;
  for (const e of employees) {
    const p = computePayroll(e, tax);
    cnss += p.cnssSal + p.cnssPat + p.cmuSal + p.cmuPat + p.atPat + p.housingPat + p.transportPat;
    iuts += p.iuts;
    tfp += p.tfp + p.apprenticeship;
  }
  // IS approx from CR
  let ca = 0;
  let charges = 0;
  for (const l of journal) {
    if (l.credit.startsWith("7")) ca += l.amount;
    if (l.debit.startsWith("6")) charges += l.amount;
  }
  const isEst = Math.max(0, Math.round((ca - charges) * (tax.isRate || 0.25)));
  const imf = Math.round(Math.max(0, ca) * (tax.isMin || 0));
  const acompteUnit = Math.round(Math.max(isEst, imf) / 4);
  return {
    TVA: tvaNet,
    CNSS: cnss,
    IUTS: iuts,
    TFP: tfp,
    RAS: ras,
    IS_ACOMPTE: acompteUnit,
    IS_SOLDE: Math.max(0, isEst - acompteUnit * 3),
    IMF: imf,
    IRM: imf,
    IRCM: ras, // approx si RAS sur dividendes/intérêts passée en 447x
    LIASSE: 0,
    PATENTE: Math.round(ca * 0.001), // estimation très grossière
  };
}


/**
 * Acomptes provisionnels d'IS + impôt minimum (IMF/IRM).
 * - Base N-1 saisie (isBaseN1) ou estimation résultat N × taux IS
 * - IMF = CA × isMin (plancher)
 * - Chaque acompte ≈ max(IS estimé, IMF) / nombre d'acomptes
 * - Solde = IS définitif − acomptes déjà versés (min. 0, ou crédit d'impôt)
 */
export function computeAcomptesIs(params: {
  caYear: number;
  resultatFiscal: number;
  tax: CountryTax;
  isBaseN1: number;
  acomptesPaid: { periodKey: string; amount: number }[];
  nbAcomptes?: number;
}): {
  isTheorique: number;
  imf: number;
  irm: number;
  baseAcomptes: number;
  montantAcompte: number;
  nbAcomptes: number;
  totalAcomptesPrevus: number;
  totalAcomptesPayes: number;
  soldeEstime: number;
  detail: { num: number; label: string; amount: number; paid: number }[];
} {
  const nb = params.nbAcomptes || 3;
  const isTheorique = Math.round(Math.max(0, params.resultatFiscal) * (params.tax.isRate || 0.25));
  const imf = Math.round(Math.max(0, params.caYear) * (params.tax.isMin || 0));
  // IRM souvent assimilé à l'impôt minimum forfaitaire en zone OHADA
  const irm = imf;
  const baseFromN1 = params.isBaseN1 > 0 ? params.isBaseN1 : Math.max(isTheorique, imf);
  const baseAcomptes = Math.max(baseFromN1, imf);
  const montantAcompte = Math.round(baseAcomptes / nb);
  const paid = params.acomptesPaid.reduce((s, a) => s + a.amount, 0);
  const detail = Array.from({ length: nb }, (_, i) => {
    const key = `T${i + 1}`;
    const paidRow = params.acomptesPaid
      .filter((a) => a.periodKey.includes(key) || a.periodKey === String(i + 1))
      .reduce((s, a) => s + a.amount, 0);
    return {
      num: i + 1,
      label: `Acompte provisionnel n°${i + 1}`,
      amount: montantAcompte,
      paid: paidRow,
    };
  });
  const totalAcomptesPrevus = montantAcompte * nb;
  const soldeEstime = Math.max(0, Math.max(isTheorique, imf) - paid);
  return {
    isTheorique,
    imf,
    irm,
    baseAcomptes,
    montantAcompte,
    nbAcomptes: nb,
    totalAcomptesPrevus,
    totalAcomptesPayes: paid,
    soldeEstime,
    detail,
  };
}


export type PrintableDeclaration = {
  kind: string;
  title: string;
  periodLabel: string;
  organism: string;
  dueDate?: string;
  lines: { label: string; base?: number; rate?: string; amount: number }[];
  total: number;
  notes: string;
};

/** Génère tous les états déclaratifs calculés automatiquement pour une période. */
export function buildPrintableDeclarations(
  data: {
    journal: JournalLine[];
    employees: Employee[];
    settings: { companyName: string; country: string; ifu?: string; rccm?: string; address?: string };
    isBaseN1?: number;
    acomptesIsPaid?: { periodKey: string; amount: number }[];
    fiscalReintegrations?: number;
    fiscalDeductions?: number;
  },
  period: string, // YYYY-MM
  tax: CountryTax,
): PrintableDeclaration[] {
  const periodJournal = data.journal.filter((l) => l.date.startsWith(period));
  let tvaCol = 0,
    tvaDed = 0,
    ras = 0,
    ircm = 0,
    ca = 0,
    charges = 0;
  for (const l of data.journal) {
    if (l.credit.startsWith("7")) ca += l.amount;
    if (l.debit.startsWith("6")) charges += l.amount;
  }
  for (const l of periodJournal) {
    if (l.credit.startsWith("443")) tvaCol += l.amount;
    if (l.debit.startsWith("445")) tvaDed += l.amount;
    if (l.credit.startsWith("4472")) ras += l.amount;
    if (l.credit.startsWith("4473") || l.libelle.toLowerCase().includes("ircm")) ircm += l.amount;
  }
  const tvaNet = Math.max(0, tvaCol - tvaDed);

  let cnssSal = 0,
    cnssPat = 0,
    iuts = 0,
    tfp = 0,
    employerAll = 0;
  const empLines: PrintableDeclaration["lines"] = [];
  for (const e of data.employees) {
    const p = computePayroll(e, tax);
    cnssSal += p.cnssSal + p.cmuSal;
    cnssPat += p.cnssPat + p.cmuPat + p.atPat + p.housingPat + p.transportPat;
    iuts += p.iuts;
    tfp += p.tfp + p.apprenticeship;
    employerAll += p.costEmployer - p.brut;
    empLines.push({
      label: `${e.matricule || e.id.slice(0, 6)} — ${e.name}`,
      base: p.brut,
      amount: p.cnssSal + p.cnssPat + p.iuts,
    });
  }

  const resultatFiscal =
    ca - charges + (data.fiscalReintegrations || 0) - (data.fiscalDeductions || 0);
  const ac = computeAcomptesIs({
    caYear: ca,
    resultatFiscal,
    tax,
    isBaseN1: data.isBaseN1 || 0,
    acomptesPaid: data.acomptesIsPaid || [],
    nbAcomptes: tax.country === "Bénin" ? 4 : 3,
  });

  const out: PrintableDeclaration[] = [
    {
      kind: "TVA",
      title: "Déclaration de TVA",
      periodLabel: period,
      organism: "DGI",
      lines: [
        { label: "TVA collectée", amount: tvaCol },
        { label: "TVA déductible", amount: tvaDed },
        { label: "TVA nette due", amount: tvaNet },
      ],
      total: tvaNet,
      notes: `Taux normal ${(tax.vat * 100).toFixed(2)} %. Échéance typique : le ${tax.vatDay} du mois suivant.`,
    },
    {
      kind: "CNSS",
      title: `Déclaration cotisations ${tax.socialOrgName || "CNSS"}`,
      periodLabel: period,
      organism: tax.socialOrgName || "CNSS",
      lines: [
        { label: "Part salariale (retenue)", amount: cnssSal },
        { label: "Part patronale (toutes branches)", amount: cnssPat },
        ...empLines.slice(0, 20),
      ],
      total: cnssSal + cnssPat,
      notes: `Sal. ${((tax.cnssEmployee || 0) * 100).toFixed(2)} % · Pat. ${((tax.cnssEmployer || 0) * 100).toFixed(2)} % · Échéance j+${tax.cnssDay}.`,
    },
    {
      kind: "IUTS",
      title: `Retenues ${tax.incomeTaxName || "IUTS/ITS"} sur salaires`,
      periodLabel: period,
      organism: "DGI",
      lines: data.employees.map((e) => {
        const p = computePayroll(e, tax);
        return { label: e.name, base: p.iutsBase, amount: p.iuts };
      }),
      total: iuts,
      notes: `Barème progressif. À reverser avec l'état des salaires.`,
    },
    {
      kind: "TFP",
      title: "TFP / taxe d'apprentissage / formation",
      periodLabel: period,
      organism: "DGI / Fonds",
      lines: [{ label: "Total formation + apprentissage", amount: tfp }],
      total: tfp,
      notes: "Selon taux pays (TFP, apprentissage).",
    },
    {
      kind: "RAS",
      title: "Retenues à la source (prestations)",
      periodLabel: period,
      organism: "DGI",
      lines: [{ label: "RAS comptabilisées (4472)", amount: ras }],
      total: ras,
      notes: `Taux RAS indicatif ${((tax.ras || 0) * 100).toFixed(1)} %.`,
    },
    {
      kind: "IRCM",
      title: "IRCM — revenus de capitaux mobiliers",
      periodLabel: period,
      organism: "DGI",
      lines: [{ label: "Retenues IRCM / assimilées", amount: ircm || ras }],
      total: ircm || ras,
      notes: "Dividendes, intérêts et produits assimilés — vérifier le taux CGI local.",
    },
    {
      kind: "IS_ACOMPTE",
      title: "Acomptes provisionnels d'IS",
      periodLabel: `Exercice en cours`,
      organism: "DGI",
      lines: [
        { label: "IS théorique (résultat × taux)", amount: ac.isTheorique },
        { label: "IMF / IRM (minimum)", amount: ac.imf },
        { label: "Base des acomptes", amount: ac.baseAcomptes },
        ...ac.detail.map((d) => ({
          label: d.label + (d.paid ? ` (payé ${d.paid.toLocaleString("fr-FR")})` : ""),
          amount: d.amount,
        })),
        { label: "Solde estimé", amount: ac.soldeEstime },
      ],
      total: ac.montantAcompte,
      notes: `${ac.nbAcomptes} acomptes · Solde à la liasse annuelle.`,
    },
    {
      kind: "IMF",
      title: "Impôt minimum forfaitaire (IMF) / IRM",
      periodLabel: `CA cumulé`,
      organism: "DGI",
      lines: [
        { label: "Chiffre d'affaires (cl. 7)", amount: ca },
        {
          label: `Taux minimum (${((tax.isMin || 0) * 100).toFixed(2)} %)`,
          amount: ac.imf,
        },
        { label: "IS théorique", amount: ac.isTheorique },
        { label: "IS dû = max(IS, IMF)", amount: Math.max(ac.isTheorique, ac.imf) },
      ],
      total: Math.max(ac.isTheorique, ac.imf),
      notes: "L'IRM désigne souvent le même plancher minimum selon les pays.",
    },
    {
      kind: "LIASSE",
      title: "Préparation liasse / solde IS",
      periodLabel: data.settings.country,
      organism: "DGI",
      lines: [
        { label: "CA", amount: ca },
        { label: "Charges", amount: charges },
        { label: "Résultat fiscal estimé", amount: resultatFiscal },
        { label: "IS théorique", amount: ac.isTheorique },
        { label: "IMF", amount: ac.imf },
        { label: "Acomptes déjà payés", amount: ac.totalAcomptesPayes },
        { label: "Solde IS estimé", amount: ac.soldeEstime },
      ],
      total: ac.soldeEstime,
      notes: "Document préparatoire — à compléter avec la liasse SYSCOHADA officielle.",
    },
  ];

  return out;
}

/** HTML imprimable pour un état déclaratif. */
export function declarationToHtml(
  decl: PrintableDeclaration,
  settings: { companyName: string; country: string; ifu?: string; rccm?: string; address?: string },
  currency: string,
): string {
  const rows = decl.lines
    .map(
      (l) =>
        `<tr><td>${l.label}</td><td class="r">${l.base != null ? l.base.toLocaleString("fr-FR") : "—"}</td><td class="r">${l.amount.toLocaleString("fr-FR")}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${decl.title}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;max-width:900px;margin:auto;font-size:12px;color:#111}
h1{font-size:16px;margin:0 0 4px}h2{font-size:14px;margin:16px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
.meta{color:#444;font-size:11px}table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{padding:5px 8px;border-bottom:1px solid #eee;text-align:left}th{background:#f5f5f5}
.r{text-align:right}.tot{font-weight:700;background:#f0f0f0}
.box{border:1px solid #ddd;padding:10px;border-radius:6px;margin:12px 0}
@media print{body{padding:12px}}
</style></head><body>
<div style="display:flex;justify-content:space-between;gap:16px">
  <div>
    <h1>${settings.companyName}</h1>
    <p class="meta">${settings.address || ""} · ${settings.country}<br/>
    IFU/NIU : ${settings.ifu || "—"} · RCCM : ${settings.rccm || "—"}</p>
  </div>
  <div class="box">
    <strong>${decl.title}</strong><br/>
    Période : ${decl.periodLabel}<br/>
    Organisme : ${decl.organism}
  </div>
</div>
<h2>Détail calculé automatiquement</h2>
<table>
<thead><tr><th>Libellé</th><th class="r">Base</th><th class="r">Montant (${currency})</th></tr></thead>
<tbody>
${rows}
<tr class="tot"><td colspan="2">Total à reverser / indicateur</td><td class="r">${decl.total.toLocaleString("fr-FR")} ${currency}</td></tr>
</tbody></table>
<p class="meta">${decl.notes}</p>
<p class="meta" style="margin-top:24px">Document généré automatiquement par PRO COMPTA OHADA — contrôlez les montants avant dépôt sur le portail ${decl.organism}.</p>
</body></html>`;
}


/** Poste de bilan officiel SYSCOHADA (codes AD…RZ). */
export type BilanPoste = {
  ref: string;
  label: string;
  brut: number;
  amort: number;
  net: number;
  netN1: number;
  total?: boolean;
  section?: "actif" | "passif";
};

function sumNet(rows: ReturnType<typeof buildBalance>, prefixes: string[]): number {
  return sumPrefix(rows, prefixes, "net");
}

/**
 * Bilan SYSCOHADA révisé — structure officielle (codes AD à RZ).
 * Comparabilité N / N-1 si journalPrevious fourni.
 */
export function buildBilanOfficial(
  journal: JournalLine[],
  journalPrevious: JournalLine[] = [],
): { actif: BilanPoste[]; passif: BilanPoste[]; totalActif: number; totalPassif: number; ecart: number } {
  const rows = buildBalance(journal);
  const rows1 = journalPrevious.length ? buildBalance(journalPrevious) : [];

  const n = (p: string[]) => sumNet(rows, p);
  const n1 = (p: string[]) => (rows1.length ? sumNet(rows1, p) : 0);

  // Immobilisations incorporelles 21x (sauf 22 corp)
  const incorpBrut = n(["211", "212", "213", "214", "215", "216", "217", "218", "219"]);
  // Simplified: all 21
  const incorpAll = n(["21"]);
  const corpBrut = n(["22", "23", "24"]);
  const finBrut = n(["26", "27"]);
  const amortImmo = Math.abs(Math.min(0, n(["28"]))); // 28 credit-ish stored as net
  // Better: amort accounts have credit balances -> net = soldeC - soldeD positive as reduction
  let amortTotal = 0;
  let deprecTotal = 0;
  for (const r of rows) {
    if (r.code.startsWith("28")) amortTotal += r.soldeC - r.soldeD;
    if (r.code.startsWith("29")) deprecTotal += r.soldeC - r.soldeD;
  }
  const immoBrut = incorpAll + corpBrut + finBrut + n(["25"]);
  const immoNet = immoBrut - amortTotal - deprecTotal;

  const stocks = n(["31", "32", "33", "34", "35", "36", "37", "38"]) + n(["39"]); // 39 dep reduces
  let stocksN = stocks;
  // 39 is depreciation of stocks
  for (const r of rows) {
    if (r.code.startsWith("39")) stocksN -= r.soldeC - r.soldeD;
  }

  const clients = n(["411", "416", "418"]);
  let clientsDep = 0;
  for (const r of rows) {
    if (r.code.startsWith("491")) clientsDep += r.soldeC - r.soldeD;
  }
  const clientsNet = clients - clientsDep;
  const autresCreances = n(["409", "421", "445", "449", "46", "47", "48"]);

  let tresoActif = 0;
  let tresoPassif = 0;
  for (const r of rows) {
    if (r.code.startsWith("56")) {
      tresoPassif += r.soldeC - r.soldeD;
      continue;
    }
    if (/^5[0-3]/.test(r.code) || r.code.startsWith("57") || r.code.startsWith("58")) {
      const net = r.soldeD - r.soldeC;
      if (net >= 0) tresoActif += net;
      else tresoPassif += -net;
    }
  }

  const totalActif = immoNet + stocksN + clientsNet + autresCreances + tresoActif;

  // Passif
  const capital = -n(["101", "104", "10"]);
  const reserves = -n(["11"]);
  const ran = -n(["12"]) - n(["13"]);
  const hasClosed = rows.some(
    (r) => (r.code.startsWith("12") || r.code.startsWith("13")) && (r.soldeD !== 0 || r.soldeC !== 0),
  );
  const rn = hasClosed ? 0 : resultatNet(journal);
  const subv = -n(["14"]);
  const cp = capital + reserves + ran + rn + subv;

  const emprunts = -n(["16", "17"]);
  const dettesLoc = -n(["18"]);
  let prov = 0;
  for (const r of rows) {
    if (r.code.startsWith("19") || r.code.startsWith("15")) prov += r.soldeC - r.soldeD;
  }
  const fourn = -n(["401", "408"]);
  const social = -n(["42", "43"]);
  const fiscal = -n(["441", "442", "443", "447", "448"]);
  const autresDettes = -n(["419", "462", "464", "472", "476", "481"]);
  const totalPassif = cp + emprunts + dettesLoc + prov + fourn + social + fiscal + autresDettes + tresoPassif;

  // N-1 simplified nets
  const immoNet1 = (() => {
    if (!rows1.length) return 0;
    let a = 0, am = 0, dp = 0;
    for (const r of rows1) {
      if (/^2[1-7]/.test(r.code)) a += r.soldeD - r.soldeC;
      if (r.code.startsWith("28")) am += r.soldeC - r.soldeD;
      if (r.code.startsWith("29")) dp += r.soldeC - r.soldeD;
    }
    return a - am - dp;
  })();
  const stocks1 = rows1.length ? sumNet(rows1, ["31", "32", "33", "34", "35", "36", "37", "38"]) : 0;
  const clients1 = rows1.length ? sumNet(rows1, ["411", "416", "418"]) : 0;
  const treso1 = (() => {
    if (!rows1.length) return 0;
    let t = 0;
    for (const r of rows1) {
      if (/^5[0-3]/.test(r.code) || r.code.startsWith("57") || r.code.startsWith("58")) {
        t += r.soldeD - r.soldeC;
      }
    }
    return Math.max(0, t);
  })();
  const cp1 = rows1.length
    ? -sumNet(rows1, ["10", "11", "12", "13", "14"]) + (hasClosed ? 0 : 0)
    : 0;

  const actif: BilanPoste[] = [
    { ref: "AD", label: "IMMOBILISATIONS INCORPORELLES", brut: incorpAll, amort: 0, net: incorpAll, netN1: 0, section: "actif" },
    { ref: "AE", label: "Frais de développement et de prospection", brut: n(["211", "2181"]), amort: 0, net: n(["211", "2181"]), netN1: 0, section: "actif" },
    { ref: "AF", label: "Brevets, licences, logiciels et droits similaires", brut: n(["212", "213", "214"]), amort: 0, net: n(["212", "213", "214"]), netN1: 0, section: "actif" },
    { ref: "AG", label: "Fonds commercial et droit au bail", brut: n(["215", "216"]), amort: 0, net: n(["215", "216"]), netN1: 0, section: "actif" },
    { ref: "AI", label: "IMMOBILISATIONS CORPORELLES", brut: corpBrut, amort: 0, net: corpBrut, netN1: 0, section: "actif" },
    { ref: "AJ", label: "Terrains", brut: n(["22"]), amort: 0, net: n(["22"]), netN1: 0, section: "actif" },
    { ref: "AK", label: "Bâtiments", brut: n(["231", "232", "233", "237"]), amort: 0, net: n(["231", "232", "233", "237"]), netN1: 0, section: "actif" },
    { ref: "AL", label: "Aménagements, agencements et installations", brut: n(["234", "235"]), amort: 0, net: n(["234", "235"]), netN1: 0, section: "actif" },
    { ref: "AM", label: "Matériel, mobilier et actifs biologiques", brut: n(["24"]), amort: 0, net: n(["24"]), netN1: 0, section: "actif" },
    { ref: "AN", label: "Matériel de transport", brut: n(["245"]), amort: 0, net: n(["245"]), netN1: 0, section: "actif" },
    { ref: "AP", label: "Avances et acomptes versés sur immobilisations", brut: n(["25"]), amort: 0, net: n(["25"]), netN1: 0, section: "actif" },
    { ref: "AQ", label: "IMMOBILISATIONS FINANCIÈRES", brut: finBrut, amort: 0, net: finBrut, netN1: 0, section: "actif" },
    { ref: "AR", label: "Titres de participation", brut: n(["26"]), amort: 0, net: n(["26"]), netN1: 0, section: "actif" },
    { ref: "AS", label: "Autres immobilisations financières", brut: n(["27"]), amort: 0, net: n(["27"]), netN1: 0, section: "actif" },
    {
      ref: "AZ",
      label: "TOTAL ACTIF IMMOBILISÉ",
      brut: immoBrut,
      amort: amortTotal + deprecTotal,
      net: immoNet,
      netN1: immoNet1,
      total: true,
      section: "actif",
    },
    { ref: "BB", label: "STOCKS ET EN-COURS", brut: stocksN, amort: 0, net: stocksN, netN1: stocks1, section: "actif" },
    { ref: "BI", label: "Clients", brut: clients, amort: clientsDep, net: clientsNet, netN1: clients1, section: "actif" },
    { ref: "BJ", label: "Autres créances", brut: autresCreances, amort: 0, net: autresCreances, netN1: 0, section: "actif" },
    {
      ref: "BK",
      label: "TOTAL ACTIF CIRCULANT",
      brut: stocksN + clients + autresCreances,
      amort: clientsDep,
      net: stocksN + clientsNet + autresCreances,
      netN1: stocks1 + clients1,
      total: true,
      section: "actif",
    },
    { ref: "BS", label: "Banques, chèques postaux, caisse et assimilés", brut: tresoActif, amort: 0, net: tresoActif, netN1: treso1, section: "actif" },
    {
      ref: "BT",
      label: "TOTAL TRÉSORERIE-ACTIF",
      brut: tresoActif,
      amort: 0,
      net: tresoActif,
      netN1: treso1,
      total: true,
      section: "actif",
    },
    {
      ref: "RZ",
      label: "TOTAL GÉNÉRAL ACTIF",
      brut: immoBrut + stocksN + clients + autresCreances + tresoActif,
      amort: amortTotal + deprecTotal + clientsDep,
      net: totalActif,
      netN1: immoNet1 + stocks1 + clients1 + treso1,
      total: true,
      section: "actif",
    },
  ];

  const passif: BilanPoste[] = [
    { ref: "CA", label: "Capital", brut: 0, amort: 0, net: capital, netN1: 0, section: "passif" },
    { ref: "CG", label: "Réserves", brut: 0, amort: 0, net: reserves, netN1: 0, section: "passif" },
    { ref: "CH", label: "Report à nouveau", brut: 0, amort: 0, net: ran, netN1: 0, section: "passif" },
    { ref: "CJ", label: "Résultat net de l'exercice", brut: 0, amort: 0, net: rn, netN1: 0, section: "passif" },
    { ref: "CL", label: "Subventions d'investissement", brut: 0, amort: 0, net: subv, netN1: 0, section: "passif" },
    {
      ref: "CP",
      label: "TOTAL CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES",
      brut: 0,
      amort: 0,
      net: cp,
      netN1: cp1,
      total: true,
      section: "passif",
    },
    { ref: "DA", label: "Emprunts et dettes financières", brut: 0, amort: 0, net: emprunts + dettesLoc, netN1: 0, section: "passif" },
    { ref: "DC", label: "Provisions pour risques et charges", brut: 0, amort: 0, net: prov, netN1: 0, section: "passif" },
    {
      ref: "DD",
      label: "TOTAL DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES",
      brut: 0,
      amort: 0,
      net: emprunts + dettesLoc + prov,
      netN1: 0,
      total: true,
      section: "passif",
    },
    { ref: "DH", label: "Fournisseurs", brut: 0, amort: 0, net: fourn, netN1: 0, section: "passif" },
    { ref: "DI", label: "Clients avances reçues", brut: 0, amort: 0, net: -n(["419"]), netN1: 0, section: "passif" },
    { ref: "DJ", label: "Dettes fiscales et sociales", brut: 0, amort: 0, net: social + fiscal, netN1: 0, section: "passif" },
    { ref: "DM", label: "Autres dettes", brut: 0, amort: 0, net: autresDettes, netN1: 0, section: "passif" },
    {
      ref: "DP",
      label: "TOTAL PASSIF CIRCULANT",
      brut: 0,
      amort: 0,
      net: fourn + social + fiscal + autresDettes - n(["419"]),
      netN1: 0,
      total: true,
      section: "passif",
    },
    { ref: "DT", label: "TOTAL TRÉSORERIE-PASSIF", brut: 0, amort: 0, net: tresoPassif, netN1: 0, total: true, section: "passif" },
    {
      ref: "DZ",
      label: "TOTAL GÉNÉRAL PASSIF",
      brut: 0,
      amort: 0,
      net: totalPassif,
      netN1: 0,
      total: true,
      section: "passif",
    },
  ];

  return {
    actif,
    passif,
    totalActif,
    totalPassif,
    ecart: Math.round(totalActif - totalPassif),
  };
}

/** Notes annexes auto-générées (SYSCOHADA — même valeur que Bilan/CR/TFT). */
export function buildNotesAnnexes(data: {
  journal: JournalLine[];
  settings: { companyName: string; country: string; ifu?: string; rccm?: string; accountingSystem?: string };
  annexNotes?: { code: string; title: string; body: string }[];
  assetComponents?: import("./types").AssetComponent[];
  retirementProvisions?: import("./types").RetirementProvision[];
  fiscalReintegrations?: number;
  fiscalDeductions?: number;
}): { code: string; title: string; body: string }[] {
  const taxNote = `Les états financiers sont établis en conformité avec le Système comptable OHADA (SYSCOHADA révisé) et l'Acte uniforme relatif au droit comptable et à l'information financière.`;
  const bil = buildBilanOfficial(data.journal);
  const notes: { code: string; title: string; body: string }[] = [
    {
      code: "1",
      title: "Déclaration de conformité",
      body: taxNote + ` Entité : ${data.settings.companyName}. Pays : ${data.settings.country}. Système : ${data.settings.accountingSystem || "NORMAL"}.`,
    },
    {
      code: "2",
      title: "Règles et méthodes comptables",
      body: "Évaluation au coût historique. Stocks : CUMP. Amortissements : linéaire sauf mention contraire. Créances clients : valeur nominale diminuée des dépréciations. Les frais accessoires d'achat sont incorporés au coût d'acquisition des stocks et immobilisations.",
    },
    {
      code: "3",
      title: "Immobilisations",
      body: `Actif immobilisé net : ${bil.actif.find((p) => p.ref === "AZ")?.net.toLocaleString("fr-FR") || 0}. L'approche par composants est appliquée lorsque les durées d'utilité des parties significatives diffèrent (SYSCOHADA).`,
    },
    {
      code: "4",
      title: "Stocks",
      body: `Stocks nets : ${bil.actif.find((p) => p.ref === "BB")?.net.toLocaleString("fr-FR") || 0}. Méthode CUMP.`,
    },
    {
      code: "5",
      title: "Créances clients",
      body: `Clients nets : ${bil.actif.find((p) => p.ref === "BI")?.net.toLocaleString("fr-FR") || 0}.`,
    },
    {
      code: "6",
      title: "Capitaux propres",
      body: `Total capitaux propres : ${bil.passif.find((p) => p.ref === "CP")?.net.toLocaleString("fr-FR") || 0}.`,
    },
    {
      code: "7",
      title: "Provisions pour risques et charges / engagements de retraite",
      body:
        (data.retirementProvisions || []).length > 0
          ? (data.retirementProvisions || [])
              .map(
                (r) =>
                  `${r.label} : ${r.amount.toLocaleString("fr-FR")} (${r.method}${r.booked ? ", comptabilisé" : ", non comptabilisé"}).`,
              )
              .join(" ")
          : "Aucune provision pour engagement de retraite enregistrée. Selon le SYSCOHADA révisé, une provision est obligatoire si obligation actuelle, sortie de ressources probable et montant fiable.",
    },
    {
      code: "8",
      title: "Événements postérieurs à la clôture",
      body: "Néant à la date d'établissement des états, sauf information contraire portée en note manuelle.",
    },
  ];

  if ((data.assetComponents || []).length) {
    notes.push({
      code: "3b",
      title: "Approche par composants",
      body: (data.assetComponents || [])
        .map(
          (c) =>
            `${c.label} : coût ${c.cost.toLocaleString("fr-FR")}, durée ${c.usefulLifeYears} ans, amort. cumulé ${c.accumulatedDep.toLocaleString("fr-FR")}.`,
        )
        .join(" | "),
    });
  }

  for (const m of data.annexNotes || []) {
    notes.push({ code: m.code, title: m.title, body: m.body });
  }
  return notes;
}

/** Dotation amortissement d'un composant (linéaire). */
export function depreciateComponent(c: import("./types").AssetComponent, yearsElapsed = 1): number {
  const base = Math.max(0, c.cost - c.residualValue);
  const annual = c.usefulLifeYears > 0 ? base / c.usefulLifeYears : 0;
  return Math.round(Math.min(annual * yearsElapsed, base - c.accumulatedDep));
}

/** Coût d'achat SYSCOHADA : prix + frais accessoires (transport, assurances, droits…). */
export function purchaseCost(price: number, accessories: number): number {
  return Math.round(price + Math.max(0, accessories));
}


/** Poste de compte de résultat officiel (codes RA–XI). */
export type CrPoste = {
  ref: string;
  label: string;
  amount: number;
  amountN1: number;
  total?: boolean;
  indent?: number;
};

/**
 * Compte de résultat SYSCOHADA révisé — structure en cascade avec codes RA–XI.
 */
export function buildPnlOfficial(
  journal: JournalLine[],
  journalPrevious: JournalLine[] = [],
): CrPoste[] {
  const calc = (j: JournalLine[]) => {
    const rows = buildBalance(j);
    const ch = (p: string[]) => mvtPrefix(rows, p, "d") - mvtPrefix(rows, p, "c");
    const pr = (p: string[]) => mvtPrefix(rows, p, "c") - mvtPrefix(rows, p, "d");
    const ventesMarch = pr(["701"]);
    const achatsMarch = ch(["601"]);
    const varStock = ch(["6031"]);
    const marge = ventesMarch - achatsMarch - varStock;
    const prodVendue = pr(["702", "703", "704", "705", "706", "707"]);
    const prodStockee = pr(["736"]);
    const prodImmo = pr(["721", "722"]);
    const production = prodVendue + prodStockee + prodImmo;
    const autresAchats = ch(["602", "604", "605", "608"]);
    const transports = ch(["611", "612", "614", "618"]);
    const services = ch([
      "621", "622", "623", "624", "625", "626", "627", "628", "631", "632", "633", "635", "637", "638",
    ]);
    const va = marge + production - autresAchats - transports - services;
    const impots = ch(["641", "645", "646", "647", "648"]);
    const perso = ch(["661", "662", "663", "664"]);
    const ebe = va - impots - perso;
    const dota = ch(["681", "691"]);
    const reprises = pr(["791", "781"]);
    const autresCh = ch(["651", "658"]);
    const autresPr = pr(["711", "754", "758"]);
    const rex = ebe - dota + reprises - autresCh + autresPr;
    const chFin = ch(["671", "673", "674", "676", "678"]);
    const prFin = pr(["771", "772", "776", "777"]);
    const rfin = prFin - chFin;
    const rao = rex + rfin;
    const chHao = ch(["811", "831", "851", "871"]);
    const prHao = pr(["821", "841", "861", "881"]);
    const rhao = prHao - chHao;
    const rai = rao + rhao;
    const is = ch(["891", "872"]);
    const net = rai - is;
    return {
      ventesMarch, achatsMarch, varStock, marge, prodVendue, production, autresAchats,
      transports, services, va, impots, perso, ebe, dota, reprises, autresCh, autresPr,
      rex, chFin, prFin, rfin, rao, chHao, prHao, rhao, rai, is, net,
    };
  };
  const n = calc(journal);
  const p = journalPrevious.length
    ? calc(journalPrevious)
    : (Object.fromEntries(Object.keys(n).map((k) => [k, 0])) as typeof n);

  return [
    { ref: "RA", label: "Ventes de marchandises", amount: n.ventesMarch, amountN1: p.ventesMarch, indent: 1 },
    { ref: "RB", label: "Achats de marchandises", amount: -n.achatsMarch, amountN1: -p.achatsMarch, indent: 1 },
    { ref: "RC", label: "Variation de stocks de marchandises", amount: -n.varStock, amountN1: -p.varStock, indent: 1 },
    { ref: "RD", label: "MARGE COMMERCIALE", amount: n.marge, amountN1: p.marge, total: true },
    { ref: "RE", label: "Production vendue", amount: n.prodVendue, amountN1: p.prodVendue, indent: 1 },
    { ref: "RF", label: "Production stockée / immobilisée", amount: n.production - n.prodVendue, amountN1: p.production - p.prodVendue, indent: 1 },
    { ref: "RG", label: "PRODUCTION DE L'EXERCICE", amount: n.production, amountN1: p.production, total: true },
    { ref: "RH", label: "Achats de matières et autres approvisionnements", amount: -n.autresAchats, amountN1: -p.autresAchats, indent: 1 },
    { ref: "RI", label: "Transports", amount: -n.transports, amountN1: -p.transports, indent: 1 },
    { ref: "RJ", label: "Services extérieurs", amount: -n.services, amountN1: -p.services, indent: 1 },
    { ref: "RK", label: "VALEUR AJOUTÉE", amount: n.va, amountN1: p.va, total: true },
    { ref: "RL", label: "Impôts et taxes", amount: -n.impots, amountN1: -p.impots, indent: 1 },
    { ref: "RM", label: "Charges de personnel", amount: -n.perso, amountN1: -p.perso, indent: 1 },
    { ref: "RN", label: "EXCÉDENT BRUT D'EXPLOITATION (EBE)", amount: n.ebe, amountN1: p.ebe, total: true },
    { ref: "RO", label: "Dotations aux amortissements et provisions", amount: -n.dota, amountN1: -p.dota, indent: 1 },
    { ref: "RP", label: "Reprises de charges / provisions", amount: n.reprises, amountN1: p.reprises, indent: 1 },
    { ref: "RQ", label: "Autres charges", amount: -n.autresCh, amountN1: -p.autresCh, indent: 1 },
    { ref: "RR", label: "Autres produits", amount: n.autresPr, amountN1: p.autresPr, indent: 1 },
    { ref: "RS", label: "RÉSULTAT D'EXPLOITATION", amount: n.rex, amountN1: p.rex, total: true },
    { ref: "RT", label: "Frais financiers et charges assimilées", amount: -n.chFin, amountN1: -p.chFin, indent: 1 },
    { ref: "RU", label: "Revenus financiers et produits assimilés", amount: n.prFin, amountN1: p.prFin, indent: 1 },
    { ref: "RV", label: "RÉSULTAT FINANCIER", amount: n.rfin, amountN1: p.rfin, total: true },
    { ref: "RW", label: "RÉSULTAT DES ACTIVITÉS ORDINAIRES (RAO)", amount: n.rao, amountN1: p.rao, total: true },
    { ref: "RX", label: "Produits HAO", amount: n.prHao, amountN1: p.prHao, indent: 1 },
    { ref: "RY", label: "Charges HAO", amount: -n.chHao, amountN1: -p.chHao, indent: 1 },
    { ref: "RZ", label: "RÉSULTAT HAO", amount: n.rhao, amountN1: p.rhao, total: true },
    { ref: "XA", label: "RÉSULTAT AVANT IMPÔTS (RAI)", amount: n.rai, amountN1: p.rai, total: true },
    { ref: "XB", label: "Impôts sur le résultat", amount: -n.is, amountN1: -p.is, indent: 1 },
    { ref: "XI", label: "RÉSULTAT NET DE L'EXERCICE", amount: n.net, amountN1: p.net, total: true },
  ];
}

/** Poste TFT officiel (codes FA–ZH). */
export type TftPoste = {
  ref: string;
  label: string;
  amount: number;
  amountN1: number;
  total?: boolean;
  indent?: number;
};

/**
 * Tableau des flux de trésorerie SYSCOHADA — codes FA–ZH.
 */
export function buildTftOfficial(
  journal: JournalLine[],
  journalPrevious: JournalLine[] = [],
): TftPoste[] {
  const one = (j: JournalLine[]) => {
    const rows = buildBalance(j);
    const rn = resultatNet(j);
    const dota = mvtPrefix(rows, ["681", "691"], "d");
    const reprises = mvtPrefix(rows, ["781", "791"], "c");
    const cafg = rn + dota - reprises;
    const clients = sumPrefix(rows, ["411", "416", "418"], "net");
    const stocks = sumPrefix(rows, ["31", "32", "33", "34", "35", "36", "37", "38"], "net");
    const fourn = -sumPrefix(rows, ["401", "408"], "net");
    const varBfr = clients + stocks - fourn;
    const fluxExpl = cafg - varBfr;
    const inv = mvtPrefix(rows, ["21", "22", "23", "24", "25", "26", "27"], "d");
    const cessions = mvtPrefix(rows, ["81", "82"], "c");
    const fluxInv = -inv + cessions;
    const capital = -sumPrefix(rows, ["10"], "net");
    const emprunts = -sumPrefix(rows, ["16", "17"], "net");
    const fluxFin = capital + emprunts;
    const variation = fluxExpl + fluxInv + fluxFin;
    return { rn, dota, reprises, cafg, varBfr, fluxExpl, inv, cessions, fluxInv, capital, emprunts, fluxFin, variation };
  };
  const n = one(journal);
  const p = journalPrevious.length
    ? one(journalPrevious)
    : (Object.fromEntries(Object.keys(n).map((k) => [k, 0])) as typeof n);

  return [
    { ref: "FA", label: "Résultat net", amount: n.rn, amountN1: p.rn, indent: 1 },
    { ref: "FB", label: "Dotations aux amortissements et provisions", amount: n.dota, amountN1: p.dota, indent: 1 },
    { ref: "FC", label: "Reprises de charges / provisions", amount: -n.reprises, amountN1: -p.reprises, indent: 1 },
    { ref: "FD", label: "CAPACITÉ D'AUTOFINANCEMENT GLOBALE (CAFG)", amount: n.cafg, amountN1: p.cafg, total: true },
    { ref: "FE", label: "Variation du BFR lié à l'activité", amount: -n.varBfr, amountN1: -p.varBfr, indent: 1 },
    { ref: "FF", label: "FLUX NET DE TRÉSORERIE D'EXPLOITATION", amount: n.fluxExpl, amountN1: p.fluxExpl, total: true },
    { ref: "FG", label: "Acquisitions d'immobilisations", amount: -n.inv, amountN1: -p.inv, indent: 1 },
    { ref: "FH", label: "Cessions d'immobilisations", amount: n.cessions, amountN1: p.cessions, indent: 1 },
    { ref: "FI", label: "FLUX NET DE TRÉSORERIE D'INVESTISSEMENT", amount: n.fluxInv, amountN1: p.fluxInv, total: true },
    { ref: "FJ", label: "Augmentation / diminution de capital", amount: n.capital, amountN1: p.capital, indent: 1 },
    { ref: "FK", label: "Variation des emprunts", amount: n.emprunts, amountN1: p.emprunts, indent: 1 },
    { ref: "FL", label: "FLUX NET DE TRÉSORERIE DE FINANCEMENT", amount: n.fluxFin, amountN1: p.fluxFin, total: true },
    { ref: "ZA", label: "VARIATION DE LA TRÉSORERIE DE LA PÉRIODE", amount: n.variation, amountN1: p.variation, total: true },
    { ref: "ZH", label: "Trésorerie nette de clôture (contrôle)", amount: n.variation, amountN1: p.variation, total: true },
  ];
}

/** Première application du SYSCOHADA révisé — écritures de transition types. */
export function firstApplicationEntries(opts: {
  fraisEtablissementNet: number;
  primesRemboursementNet: number;
  composantsAdjustment: number;
  retraiteProvision: number;
  date?: string;
}): import("./types").JournalLine[] {
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const lines: import("./types").JournalLine[] = [];
  let i = 0;
  const push = (libelle: string, debit: string, credit: string, amount: number) => {
    if (amount <= 0) return;
    i += 1;
    lines.push({
      id: `fa-${i}`,
      date,
      piece: "1ERE-APP",
      libelle,
      debit,
      credit,
      amount: Math.round(amount),
    });
  };
  // Frais d'établissement : sortie du bilan → RAN (révision)
  if (opts.fraisEtablissementNet > 0) {
    push("1ère application — élimination frais d'établissement", "12", "201", opts.fraisEtablissementNet);
  }
  // Primes de remboursement : traitement transition
  if (opts.primesRemboursementNet > 0) {
    push("1ère application — primes de remboursement", "12", "169", opts.primesRemboursementNet);
  }
  // Ajustement composants (reclassement)
  if (opts.composantsAdjustment > 0) {
    push("1ère application — reclassement composants immos", "23", "28", opts.composantsAdjustment);
  }
  // Engagements de retraite antérieurs → provision (imputation RAN, étalement max 5 ans possible hors scope)
  if (opts.retraiteProvision > 0) {
    push("1ère application — provision engagements de retraite", "12", "196", opts.retraiteProvision);
  }
  return lines;
}

/** Entité du périmètre de consolidation D4C. */
export type ConsolidateEntity = {
  id: string;
  name: string;
  percent: number; // % de détention 0-100
  journal: import("./types").JournalLine[];
  method: "integration_globale" | "integration_proportionnelle" | "mise_en_equivalence";
};

/**
 * Consolidation simplifiée D4C (intégration globale / proportionnelle / MEE).
 * — Intégration globale : 100 % des postes, intérêts minoritaires si % < 100
 * — Proportionnelle : quotité
 * — MEE : quote-part de capitaux propres en titres
 */
export function consolidateD4C(entities: ConsolidateEntity[]): {
  bilans: { name: string; totalActif: number; totalPassif: number; method: string; percent: number }[];
  combinedActif: number;
  combinedPassif: number;
  minoritaires: number;
  notes: string[];
} {
  let combinedActif = 0;
  let combinedPassif = 0;
  let minoritaires = 0;
  const bilans: { name: string; totalActif: number; totalPassif: number; method: string; percent: number }[] = [];
  const notes: string[] = [];

  for (const e of entities) {
    const bil = buildBilanOfficial(e.journal);
    const pct = Math.min(100, Math.max(0, e.percent)) / 100;
    if (e.method === "integration_globale") {
      combinedActif += bil.totalActif;
      combinedPassif += bil.totalPassif;
      if (pct < 1) {
        const mino = bil.passif.find((p) => p.ref === "CP")?.net || 0;
        minoritaires += mino * (1 - pct);
      }
      notes.push(`${e.name} : intégration globale (${(pct * 100).toFixed(0)} %)${pct < 1 ? " + intérêts minoritaires" : ""}.`);
    } else if (e.method === "integration_proportionnelle") {
      combinedActif += bil.totalActif * pct;
      combinedPassif += bil.totalPassif * pct;
      notes.push(`${e.name} : intégration proportionnelle ${(pct * 100).toFixed(0)} %.`);
    } else {
      const cp = bil.passif.find((p) => p.ref === "CP")?.net || 0;
      const mee = cp * pct;
      combinedActif += mee;
      combinedPassif += mee;
      notes.push(`${e.name} : mise en équivalence — quote-part CP ${mee.toLocaleString("fr-FR")}.`);
    }
    bilans.push({
      name: e.name,
      totalActif: Math.round(bil.totalActif),
      totalPassif: Math.round(bil.totalPassif),
      method: e.method,
      percent: e.percent,
    });
  }

  return {
    bilans,
    combinedActif: Math.round(combinedActif),
    combinedPassif: Math.round(combinedPassif),
    minoritaires: Math.round(minoritaires),
    notes,
  };
}

/** HTML imprimable liasse — orientation portrait ou paysage. */
export function liasseToHtml(opts: {
  settings: { companyName: string; country: string; ifu?: string; rccm?: string; address?: string; accountingSystem?: string };
  bil: ReturnType<typeof buildBilanOfficial>;
  cr: CrPoste[];
  tft: TftPoste[];
  notes: { code: string; title: string; body: string }[];
  currency: string;
  orientation: "portrait" | "landscape";
}): string {
  const { settings: s, bil, cr, tft, notes, currency, orientation } = opts;
  const page = orientation === "landscape"
    ? "@page{size:A4 landscape;margin:12mm}"
    : "@page{size:A4 portrait;margin:12mm}";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Liasse ${s.companyName}</title>
<style>
${page}
body{font-family:system-ui,sans-serif;font-size:${orientation === "landscape" ? "10px" : "11px"};color:#111}
h1{font-size:14px;margin:0 0 4px}h2{font-size:12px;margin:14px 0 6px;border-bottom:1px solid #333;padding-bottom:2px}
table{width:100%;border-collapse:collapse;margin:4px 0}th,td{padding:2px 5px;border-bottom:1px solid #e5e5e5;text-align:left}
.r{text-align:right}.tot{font-weight:700;background:#f0f0f0}.meta{color:#444;font-size:10px}
.section{page-break-before:always}.section:first-child{page-break-before:auto}
</style></head><body>
<div>
  <h1>${s.companyName} — États financiers SYSCOHADA révisé</h1>
  <p class="meta">${s.address || ""} · ${s.country} · IFU ${s.ifu || "—"} · RCCM ${s.rccm || "—"} · Système ${s.accountingSystem || "NORMAL"} · Format ${orientation}</p>
</div>
<div class="section">
<h2>Bilan (codes AD–RZ)</h2>
<table>
<thead><tr><th>Réf</th><th>Actif</th><th class="r">Brut</th><th class="r">Amort.</th><th class="r">Net N</th><th class="r">Net N-1</th></tr></thead>
<tbody>
${bil.actif.map((p) => `<tr class="${p.total ? "tot" : ""}"><td>${p.ref}</td><td>${p.label}</td><td class="r">${p.brut.toLocaleString("fr-FR")}</td><td class="r">${p.amort.toLocaleString("fr-FR")}</td><td class="r">${p.net.toLocaleString("fr-FR")}</td><td class="r">${p.netN1.toLocaleString("fr-FR")}</td></tr>`).join("")}
</tbody></table>
<table>
<thead><tr><th>Réf</th><th>Passif</th><th class="r">Net N</th><th class="r">Net N-1</th></tr></thead>
<tbody>
${bil.passif.map((p) => `<tr class="${p.total ? "tot" : ""}"><td>${p.ref}</td><td>${p.label}</td><td class="r">${p.net.toLocaleString("fr-FR")}</td><td class="r">${p.netN1.toLocaleString("fr-FR")}</td></tr>`).join("")}
</tbody></table>
<p class="meta">Écart actif − passif : ${bil.ecart.toLocaleString("fr-FR")} ${currency}</p>
</div>
<div class="section">
<h2>Compte de résultat (codes RA–XI)</h2>
<table>
<thead><tr><th>Réf</th><th>Libellé</th><th class="r">N</th><th class="r">N-1</th></tr></thead>
<tbody>
${cr.map((p) => `<tr class="${p.total ? "tot" : ""}"><td>${p.ref}</td><td>${p.label}</td><td class="r">${p.amount.toLocaleString("fr-FR")}</td><td class="r">${p.amountN1.toLocaleString("fr-FR")}</td></tr>`).join("")}
</tbody></table>
</div>
<div class="section">
<h2>Tableau des flux de trésorerie (codes FA–ZH)</h2>
<table>
<thead><tr><th>Réf</th><th>Libellé</th><th class="r">N</th><th class="r">N-1</th></tr></thead>
<tbody>
${tft.map((p) => `<tr class="${p.total ? "tot" : ""}"><td>${p.ref}</td><td>${p.label}</td><td class="r">${p.amount.toLocaleString("fr-FR")}</td><td class="r">${p.amountN1.toLocaleString("fr-FR")}</td></tr>`).join("")}
</tbody></table>
</div>
<div class="section">
<h2>Notes annexes</h2>
${notes.map((n) => `<h3 style="font-size:11px;margin:10px 0 4px">Note ${n.code} — ${n.title}</h3><p class="meta">${n.body.replace(/</g, "&lt;")}</p>`).join("")}
</div>
<p class="meta" style="margin-top:20px">Document généré par PRO COMPTA OHADA — structure conforme SYSCOHADA révisé. Arrêt des comptes ≤ 4 mois après clôture.</p>
</body></html>`;
}
