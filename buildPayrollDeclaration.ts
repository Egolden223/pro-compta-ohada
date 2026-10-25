/** Déclaration mensuelle de paie (CNSS/CNPS + impôt salarial) — préparation imprimable. */
export function buildPayrollDeclaration(
  employees: Employee[],
  tax: CountryTax,
  _month: string,
): {
  orgName: string;
  taxName: string;
  lines: {
    id: string;
    matricule: string;
    nom: string;
    brut: number;
    cnssSal: number;
    cnssPat: number;
    cmuSal: number;
    cmuPat: number;
    iuts: number;
    net: number;
    costEmployer: number;
  }[];
  totals: {
    brut: number;
    cnssSal: number;
    cnssPat: number;
    cmuSal: number;
    cmuPat: number;
    iuts: number;
    net: number;
    costEmployer: number;
  };
} {
  const orgName = tax.socialOrgName || "CNSS";
  const taxName = tax.incomeTaxName || "IUTS";
  const lines = (employees || [])
    .filter((e) => (e.base || 0) > 0)
    .map((e) => {
      const p = computePayroll(e, tax);
      return {
        id: e.id,
        matricule: e.matricule || e.id.slice(-6),
        nom: e.name,
        brut: p.brut,
        cnssSal: p.cnssSal,
        cnssPat: p.cnssPat,
        cmuSal: p.cmuSal,
        cmuPat: p.cmuPat,
        iuts: p.iuts,
        net: p.net,
        costEmployer: p.costEmployer,
      };
    });
  const totals = lines.reduce(
    (a, l) => ({
      brut: a.brut + l.brut,
      cnssSal: a.cnssSal + l.cnssSal,
      cnssPat: a.cnssPat + l.cnssPat,
      cmuSal: a.cmuSal + l.cmuSal,
      cmuPat: a.cmuPat + l.cmuPat,
      iuts: a.iuts + l.iuts,
      net: a.net + l.net,
      costEmployer: a.costEmployer + l.costEmployer,
    }),
    { brut: 0, cnssSal: 0, cnssPat: 0, cmuSal: 0, cmuPat: 0, iuts: 0, net: 0, costEmployer: 0 },
  );
  return { orgName, taxName, lines, totals };
}
