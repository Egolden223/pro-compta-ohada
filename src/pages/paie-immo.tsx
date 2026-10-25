import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { countryByName } from "@/lib/countries";
import { computePayroll, buildPayrollDeclaration, assetDotation } from "@/lib/engine";
import { formatPct } from "@/lib/format";
import { todayISO } from "@/lib/utils";
import type { Employee } from "@/lib/types";

export function PaiePage() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [name, setName] = useState("");
  const [base, setBase] = useState(0);
  const [tab, setTab] = useState<"employes" | "bulletins" | "declarations" | "immo">("employes");
  const decl = useMemo(
    () => buildPayrollDeclaration(data.employees, tax, month),
    [data.employees, tax, month],
  );

  function addEmp() {
    if (!name.trim() || base <= 0) {
      toast.error("Nom et salaire de base requis.");
      return;
    }
    data.addEmployee({
      name: name.trim(),
      base,
      overtimeHours: 0,
      overtimeRate: 1.25,
      transport: 0,
      housing: 0,
      otherTaxable: 0,
      benefits: 0,
      exempt: 0,
      leaveDays: 30,
      leaveTaken: 0,
      jobTitle: "Employé",
      matricule: `M${String(data.employees.length + 1).padStart(3, "0")}`,
      taxParts: 1,
      children: 0,
    });
    toast.success("Salarié ajouté.");
    setName("");
    setBase(0);
  }

  function printBulletin(e: Employee) {
    const p = computePayroll(e, tax);
    const s = data.settings;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Bulletin ${e.name}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;max-width:800px;margin:auto;font-size:12px;color:#111}
h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;border-bottom:1px solid #ccc;margin:16px 0 8px}
.meta{color:#444;font-size:11px}table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{padding:4px 6px;border-bottom:1px solid #eee;text-align:left}th{background:#f5f5f5}
.r{text-align:right}.tot{font-weight:700;background:#f0f0f0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.box{border:1px solid #ddd;padding:8px;border-radius:6px}
</style></head><body>
<div class="grid">
  <div>
    <h1>${s.companyName}</h1>
    <p class="meta">${s.address || ""} · ${s.country}<br/>
    IFU : ${s.ifu || "—"} · RCCM : ${s.rccm || "—"}</p>
  </div>
  <div class="box">
    <strong>BULLETIN DE PAIE</strong><br/>
    Période : ${month}<br/>
    Organisme : ${tax.socialOrgName || "CNSS"} · ${tax.incomeTaxName || "IUTS"}
  </div>
</div>
<div class="grid" style="margin-top:12px">
  <div class="box">
    <strong>${e.name}</strong><br/>
    Matricule : ${e.matricule || "—"} · Poste : ${e.jobTitle || "—"}<br/>
    Embauche : ${e.hireDate || "—"} · Parts : ${e.taxParts || 1}
  </div>
  <div class="box">
    Compte bancaire : ${e.bankAccount || "—"}<br/>
    Congés : ${e.leaveTaken || 0} / ${e.leaveDays || 0} jours
  </div>
</div>
<h2>Gains</h2>
<table>
<tr><th>Libellé</th><th class="r">Nombre</th><th class="r">Base / taux</th><th class="r">Montant</th></tr>
<tr><td>Salaire de base</td><td class="r">1</td><td class="r"></td><td class="r">${e.base.toLocaleString("fr-FR")}</td></tr>
${p.overtime ? `<tr><td>Heures supplémentaires</td><td class="r">${e.overtimeHours}</td><td class="r">× ${e.overtimeRate}</td><td class="r">${p.overtime.toLocaleString("fr-FR")}</td></tr>` : ""}
${e.transport ? `<tr><td>Indemnité transport</td><td class="r"></td><td class="r"></td><td class="r">${e.transport.toLocaleString("fr-FR")}</td></tr>` : ""}
${e.housing ? `<tr><td>Indemnité logement</td><td class="r"></td><td class="r"></td><td class="r">${e.housing.toLocaleString("fr-FR")}</td></tr>` : ""}
${e.otherTaxable ? `<tr><td>Autres éléments imposables</td><td class="r"></td><td class="r"></td><td class="r">${e.otherTaxable.toLocaleString("fr-FR")}</td></tr>` : ""}
${e.benefits ? `<tr><td>Avantages en nature</td><td class="r"></td><td class="r"></td><td class="r">${e.benefits.toLocaleString("fr-FR")}</td></tr>` : ""}
<tr class="tot"><td colspan="3">Salaire brut</td><td class="r">${p.brut.toLocaleString("fr-FR")} ${tax.currency}</td></tr>
</table>
<h2>Retenues salariales</h2>
<table>
<tr><th>Libellé</th><th class="r">Base</th><th class="r">Taux</th><th class="r">Montant</th></tr>
<tr><td>${tax.socialOrgName || "CNSS"} salariale</td><td class="r">${p.brut.toLocaleString("fr-FR")}</td><td class="r">${((tax.cnssEmployee || 0) * 100).toFixed(2)} %</td><td class="r">${p.cnssSal.toLocaleString("fr-FR")}</td></tr>
${p.cmuSal ? `<tr><td>CMU / maladie salariale</td><td class="r">${p.brut.toLocaleString("fr-FR")}</td><td class="r">${((tax.cmuEmployee || 0) * 100).toFixed(2)} %</td><td class="r">${p.cmuSal.toLocaleString("fr-FR")}</td></tr>` : ""}
<tr><td>${tax.incomeTaxName || "IUTS/ITS"}</td><td class="r">${p.iutsBase.toLocaleString("fr-FR")}</td><td class="r">barème</td><td class="r">${p.iuts.toLocaleString("fr-FR")}</td></tr>
<tr class="tot"><td colspan="3">Net à payer</td><td class="r">${p.net.toLocaleString("fr-FR")} ${tax.currency}</td></tr>
</table>
<h2>Charges patronales (information employeur)</h2>
<table>
<tr><td>${tax.socialOrgName || "CNSS"} patronale</td><td class="r">${p.cnssPat.toLocaleString("fr-FR")}</td></tr>
${p.cmuPat ? `<tr><td>CMU patronale</td><td class="r">${p.cmuPat.toLocaleString("fr-FR")}</td></tr>` : ""}
${p.apprenticeship ? `<tr><td>Taxe apprentissage / formation</td><td class="r">${p.apprenticeship.toLocaleString("fr-FR")}</td></tr>` : ""}
${p.tfp ? `<tr><td>TFP / contribution unique</td><td class="r">${p.tfp.toLocaleString("fr-FR")}</td></tr>` : ""}
<tr class="tot"><td>Coût total employeur</td><td class="r">${p.costEmployer.toLocaleString("fr-FR")} ${tax.currency}</td></tr>
</table>
<p class="meta" style="margin-top:24px">Document généré par PRO COMPTA OHADA — à contrôler avant remise au salarié et déclaration ${tax.socialOrgName || "CNSS"}.</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }

  function printDeclaration() {
    const s = data.settings;
    const t = decl.totals;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Déclaration paie ${month}</title>
<style>body{font-family:system-ui;padding:24px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}.r{text-align:right}.tot{font-weight:700;background:#f5f5f5}</style></head>
<body>
<h1>État déclaratif paie — ${month}</h1>
<p>${s.companyName} · ${s.country} · IFU ${s.ifu || "—"}</p>
<p>Organisme social : <strong>${decl.orgName}</strong> · Impôt salarial : <strong>${decl.taxName}</strong></p>
<table>
<thead><tr><th>Matricule</th><th>Nom</th><th class="r">Brut</th><th class="r">${decl.orgName} sal.</th><th class="r">${decl.orgName} pat.</th><th class="r">${decl.taxName}</th><th class="r">Net</th><th class="r">Coût</th></tr></thead>
<tbody>
${decl.lines
  .map(
    (l) =>
      `<tr><td>${l.matricule}</td><td>${l.name}</td><td class="r">${l.brut.toLocaleString("fr-FR")}</td><td class="r">${l.cnssSal.toLocaleString("fr-FR")}</td><td class="r">${l.cnssPat.toLocaleString("fr-FR")}</td><td class="r">${l.iuts.toLocaleString("fr-FR")}</td><td class="r">${l.net.toLocaleString("fr-FR")}</td><td class="r">${l.costEmployer.toLocaleString("fr-FR")}</td></tr>`,
  )
  .join("")}
<tr class="tot"><td colspan="2">Totaux</td><td class="r">${t.brut.toLocaleString("fr-FR")}</td><td class="r">${t.cnssSal.toLocaleString("fr-FR")}</td><td class="r">${t.cnssPat.toLocaleString("fr-FR")}</td><td class="r">${t.iuts.toLocaleString("fr-FR")}</td><td class="r">${t.net.toLocaleString("fr-FR")}</td><td class="r">${t.costEmployer.toLocaleString("fr-FR")}</td></tr>
</tbody></table>
<p style="margin-top:16px"><strong>À reverser :</strong><br/>
${decl.orgName} (sal. + pat. + CMU) : ${(t.cnssSal + t.cnssPat + t.cmuSal + t.cmuPat).toLocaleString("fr-FR")} ${tax.currency}<br/>
${decl.taxName} : ${t.iuts.toLocaleString("fr-FR")} ${tax.currency}<br/>
Formation / TFP : ${(t.apprenticeship + t.tfp).toLocaleString("fr-FR")} ${tax.currency}</p>
<p style="font-size:11px;color:#666">Préparation de déclaration — non substitut au portail officiel ${decl.orgName} / DGI. Échéance sociale typique : jour ${tax.cnssDay} du mois suivant.</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }

  function postMonth() {
    if (!data.employees.length) {
      toast.error("Aucun salarié.");
      return;
    }
    const date = `${month}-28`;
    let n = 0;
    for (const e of data.employees) {
      const p = computePayroll(e, tax);
      if (p.brut <= 0) continue;
      const piece = data.consumeNumber("PAIE");
      // Charge salariale
      data.addJournalLine({
        date,
        piece,
        journal: "PAIE",
        debit: "661",
        credit: "422",
        libelle: `Salaire brut ${e.name} ${month}`,
        amount: p.brut,
        source: "auto",
        remark: "Paie",
        locked: true,
      });
      // CNSS salariale
      if (p.cnssSal > 0) {
        data.addJournalLine({
          date,
          piece,
          journal: "PAIE",
          debit: "422",
          credit: "431",
          libelle: `${tax.socialOrgName} sal. ${e.name}`,
          amount: p.cnssSal,
          source: "auto",
          remark: "Paie",
          locked: true,
        });
      }
      if (p.cmuSal > 0) {
        data.addJournalLine({
          date,
          piece,
          journal: "PAIE",
          debit: "422",
          credit: "431",
          libelle: `CMU sal. ${e.name}`,
          amount: p.cmuSal,
          source: "auto",
          remark: "Paie",
          locked: true,
        });
      }
      if (p.iuts > 0) {
        data.addJournalLine({
          date,
          piece,
          journal: "PAIE",
          debit: "422",
          credit: "4471",
          libelle: `${tax.incomeTaxName} ${e.name}`,
          amount: p.iuts,
          source: "auto",
          remark: "Paie",
          locked: true,
        });
      }
      // Charges patronales détaillées
      for (const ch of p.employerCharges) {
        data.addJournalLine({
          date,
          piece,
          journal: "PAIE",
          debit: "664",
          credit: "431",
          libelle: `${ch.label} ${e.name}`,
          amount: ch.amount,
          source: "auto",
          remark: "Paie patronale",
          locked: true,
        });
      }
      n++;
    }
    toast.success(`Paie ${month} comptabilisée (${n} salarié(s)).`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Social"
        title="Paie légale OHADA"
        description={`${data.settings.country} · ${tax.socialOrgName || "CNSS"} sal. ${formatPct(tax.cnssEmployee)} / pat. ${formatPct(tax.cnssEmployer)} · ${tax.incomeTaxName || "IUTS"} · échéance j+${tax.cnssDay}`}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["employes", "Salariés"],
            ["bulletins", "Bulletins"],
            ["declarations", "Déclarations"],
            ["immo", "Immobilisations"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            variant={tab === id ? "default" : "secondary"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Période (AAAA-MM)">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        {tab === "declarations" || tab === "bulletins" ? (
          <Button type="button" onClick={postMonth}>
            Comptabiliser la paie du mois
          </Button>
        ) : null}
      </div>

      {tab === "employes" ? (
        <>
          <Card className="mb-4 p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Nom">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Salaire de base">
                <Input
                  type="number"
                  value={base || ""}
                  onChange={(e) => setBase(Number(e.target.value) || 0)}
                />
              </Field>
              <div className="flex items-end">
                <Button type="button" onClick={addEmp}>
                  Ajouter
                </Button>
              </div>
            </div>
          </Card>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-3 py-2">Salarié</th>
                  <th className="px-3 py-2 text-right">Brut</th>
                  <th className="px-3 py-2 text-right">{tax.socialOrgName} sal.</th>
                  <th className="px-3 py-2 text-right">{tax.incomeTaxName}</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2 text-right">Coût employeur</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e) => {
                  const pay = computePayroll(e, tax);
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{e.name}</div>
                        <div className="text-[10px] text-muted">
                          {e.matricule || ""} · {e.jobTitle || ""} · Congés {e.leaveTaken || 0}/
                          {e.leaveDays || 0} j
                        </div>
                        <button
                          type="button"
                          className="text-[10px] underline text-muted"
                          onClick={() =>
                            data.updateEmployee(e.id, {
                              leaveTaken: (e.leaveTaken || 0) + 1,
                            })
                          }
                        >
                          +1 jour congé
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={pay.brut} currency={tax.currency} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={pay.cnssSal} currency={tax.currency} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={pay.iuts} currency={tax.currency} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        <Money value={pay.net} currency={tax.currency} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={pay.costEmployer} currency={tax.currency} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.employees.length === 0 ? (
              <p className="p-6 text-sm text-muted">Aucun salarié.</p>
            ) : null}
          </Card>
        </>
      ) : null}

      {tab === "bulletins" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.employees.map((e) => {
            const p = computePayroll(e, tax);
            return (
              <Card key={e.id} className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted">
                      {e.matricule} · Net{" "}
                      <Money value={p.net} currency={tax.currency} />
                    </p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => printBulletin(e)}>
                    Bulletin officiel
                  </Button>
                </div>
                <ul className="space-y-1 text-xs text-muted">
                  <li className="flex justify-between">
                    <span>Brut</span>
                    <Money value={p.brut} currency={tax.currency} />
                  </li>
                  <li className="flex justify-between">
                    <span>{tax.socialOrgName} sal.</span>
                    <Money value={p.cnssSal} currency={tax.currency} />
                  </li>
                  <li className="flex justify-between">
                    <span>{tax.incomeTaxName}</span>
                    <Money value={p.iuts} currency={tax.currency} />
                  </li>
                </ul>
              </Card>
            );
          })}
        </div>
      ) : null}

      {tab === "declarations" ? (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg">
                Déclaration {decl.orgName} + {decl.taxName}
              </h2>
              <p className="text-xs text-muted">
                Période {month} · Échéance sociale typique : le {tax.cnssDay} du mois suivant
              </p>
            </div>
            <Button type="button" onClick={printDeclaration}>
              Imprimer l&apos;état déclaratif
            </Button>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[10px] border border-border p-3">
              <p className="text-xs text-muted">Masse salariale brute</p>
              <p className="text-lg font-semibold">
                <Money value={decl.totals.brut} currency={tax.currency} />
              </p>
            </div>
            <div className="rounded-[10px] border border-border p-3">
              <p className="text-xs text-muted">À reverser {decl.orgName}</p>
              <p className="text-lg font-semibold">
                <Money
                  value={
                    decl.totals.cnssSal +
                    decl.totals.cnssPat +
                    decl.totals.cmuSal +
                    decl.totals.cmuPat
                  }
                  currency={tax.currency}
                />
              </p>
            </div>
            <div className="rounded-[10px] border border-border p-3">
              <p className="text-xs text-muted">À reverser {decl.taxName}</p>
              <p className="text-lg font-semibold">
                <Money value={decl.totals.iuts} currency={tax.currency} />
              </p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-2 py-1">Mat.</th>
                <th className="px-2 py-1">Nom</th>
                <th className="px-2 py-1 text-right">Brut</th>
                <th className="px-2 py-1 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {decl.lines.map((l) => (
                <tr key={l.matricule} className="border-t border-border">
                  <td className="px-2 py-1 font-mono text-xs">{l.matricule}</td>
                  <td className="px-2 py-1">{l.name}</td>
                  <td className="px-2 py-1 text-right">
                    <Money value={l.brut} currency={tax.currency} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Money value={l.net} currency={tax.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted">
            Note : la DSN française n&apos;existe pas en zone OHADA. Cet état prépare les
            déclarations mensuelles {decl.orgName} et {decl.taxName} (portails nationaux). Les
            barèmes IUTS de référence sont ceux du Burkina Faso lorsqu&apos;un barème pays n&apos;est
            pas paramétré.
          </p>
        </Card>
      ) : null}

      {tab === "immo" ? <ImmoSection /> : null}
    </div>
  );
}

function ImmoSection() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3 font-display">Immobilisations & amortissements</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="px-4 py-2">Bien</th>
            <th className="px-4 py-2 text-right">Valeur</th>
            <th className="px-4 py-2 text-right">Dotation exercice</th>
          </tr>
        </thead>
        <tbody>
          {data.assets.map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="px-4 py-2">{a.name}</td>
              <td className="px-4 py-2 text-right">
                <Money value={a.value} currency={tax.currency} />
              </td>
              <td className="px-4 py-2 text-right">
                <Money
                  value={assetDotation(a, data.settings.fyStart, data.settings.fyEnd)}
                  currency={tax.currency}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.assets.length === 0 ? <p className="p-6 text-sm text-muted">Aucune immobilisation.</p> : null}
    </Card>
  );
}

// Re-export for routes that expect PaieImmoPage
export { PaiePage as PaieImmoPage };
