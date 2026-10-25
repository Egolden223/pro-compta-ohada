import { useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import {
  buildBilanOfficial,
  buildPnlOfficial,
  buildTftOfficial,
  buildEss,
  buildSmtRecettesDepenses,
  buildNotesAnnexes,
  liasseToHtml,
  kpis,
  computeIs,
} from "@/lib/engine";
import { countryByName } from "@/lib/countries";
import { cn } from "@/lib/utils";

export function LiassePage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const sys = data.settings.accountingSystem === "ALLEGE" ? "NORMAL" : data.settings.accountingSystem || "NORMAL";
  const profile = data.settings.entityProfile || "SYSCOHADA";

  const bil = useMemo(
    () => buildBilanOfficial(data.journal, data.journalPrevious || []),
    [data.journal, data.journalPrevious],
  );
  const pnl = useMemo(
    () => buildPnlOfficial(data.journal, data.journalPrevious || []),
    [data.journal, data.journalPrevious],
  );
  const tft = useMemo(
    () => buildTftOfficial(data.journal, data.journalPrevious || []),
    [data.journal, data.journalPrevious],
  );
  const ess = useMemo(() => buildEss(data.journal), [data.journal]);
  const smt = useMemo(() => buildSmtRecettesDepenses(data.journal), [data.journal]);
  const notes = useMemo(
    () =>
      buildNotesAnnexes({
        journal: data.journal,
        settings: data.settings,
        annexNotes: data.annexNotes,
        assetComponents: data.assetComponents,
        retirementProvisions: data.retirementProvisions,
        fiscalReintegrations: data.fiscalReintegrations,
        fiscalDeductions: data.fiscalDeductions,
      }),
    [data],
  );
  const isc = useMemo(() => computeIs(data), [data]);
  const k = useMemo(() => kpis(data), [data]);

  function exportPrint(orientation: "portrait" | "landscape" = "portrait") {
    if (sys === "SMT") {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SMT</title></head><body>
        <h1>${data.settings.companyName} — SMT</h1>
        <table border="1" cellpadding="4"><tr><th>Date</th><th>Libellé</th><th>Recette</th><th>Dépense</th></tr>
        ${smt.lines.map((l) => `<tr><td>${l.date}</td><td>${l.libelle}</td><td>${l.recette}</td><td>${l.depense}</td></tr>`).join("")}
        </table></body></html>`;
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); w.print(); }
      return;
    }
    const html = liasseToHtml({
      settings: data.settings,
      bil,
      cr: pnl,
      tft,
      notes,
      currency,
      orientation,
    });
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }


  return (
    <div>
      <PageHeader
        eyebrow="Clôture"
        title="Liasse SYSCOHADA"
        description={
          sys === "SMT"
            ? "Système minimal de trésorerie — bilan, CR, créances/dettes non échues."
            : "Jeu complet : Bilan (codes AD–RZ) · Compte de résultat · TFT · Notes annexes · comparabilité N/N-1."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                data.archiveJournalAsPrevious();
                toast.success("Journal archivé comme exercice N-1");
              }}
            >
              Archiver N → N-1
            </Button>
            <Button type="button" variant="secondary" onClick={() => exportPrint("portrait")}>
              Imprimer portrait
            </Button>
            <Button type="button" onClick={() => exportPrint("landscape")}>
              Imprimer paysage
            </Button>
          </div>
        }
      />

      {data.settings.accountingSystem === "ALLEGE" ? (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          Le système <strong>allégé</strong> a été supprimé par le SYSCOHADA révisé (2017). Affichage en{" "}
          <strong>système normal</strong>. Passez en NORMAL ou SMT dans Paramètres.
        </Card>
      ) : null}

      {sys === "SMT" ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3 font-display">Livre recettes / dépenses (SMT)</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Libellé</th>
                <th className="px-4 py-2 text-right">Recette</th>
                <th className="px-4 py-2 text-right">Dépense</th>
              </tr>
            </thead>
            <tbody>
              {smt.lines.slice(0, 50).map((l, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="px-4 py-1.5">{l.date}</td>
                  <td className="px-4 py-1.5">{l.libelle}</td>
                  <td className="px-4 py-1.5 text-right">
                    <Money value={l.recette} currency={currency} />
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <Money value={l.depense} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <Card className="p-3">
              <p className="text-xs text-muted">Total actif</p>
              <p className="font-semibold">
                <Money value={bil.totalActif} currency={currency} />
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Total passif</p>
              <p className="font-semibold">
                <Money value={bil.totalPassif} currency={currency} />
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Écart (doit être 0)</p>
              <p className={cn("font-semibold", bil.ecart !== 0 && "text-danger")}>
                <Money value={bil.ecart} currency={currency} />
              </p>
            </Card>
          </div>

          <Card className="mb-4 overflow-x-auto p-0">
            <div className="border-b border-border px-4 py-3 font-display">
              Bilan officiel SYSCOHADA — Actif
            </div>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-3 py-2">Réf</th>
                  <th className="px-3 py-2">Poste</th>
                  <th className="px-3 py-2 text-right">Brut</th>
                  <th className="px-3 py-2 text-right">Amort.</th>
                  <th className="px-3 py-2 text-right">Net N</th>
                  <th className="px-3 py-2 text-right">Net N-1</th>
                </tr>
              </thead>
              <tbody>
                {bil.actif.map((p) => (
                  <tr
                    key={p.ref}
                    className={cn("border-b border-border/50", p.total && "bg-muted/30 font-semibold")}
                  >
                    <td className="px-3 py-1.5 font-mono text-xs">{p.ref}</td>
                    <td className="px-3 py-1.5">{p.label}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Money value={p.brut} currency={currency} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Money value={p.amort} currency={currency} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Money value={p.net} currency={currency} />
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted">
                      <Money value={p.netN1} currency={currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="mb-4 overflow-x-auto p-0">
            <div className="border-b border-border px-4 py-3 font-display">
              Bilan officiel SYSCOHADA — Passif
            </div>
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-3 py-2">Réf</th>
                  <th className="px-3 py-2">Poste</th>
                  <th className="px-3 py-2 text-right">Net N</th>
                  <th className="px-3 py-2 text-right">Net N-1</th>
                </tr>
              </thead>
              <tbody>
                {bil.passif.map((p) => (
                  <tr
                    key={p.ref}
                    className={cn("border-b border-border/50", p.total && "bg-muted/30 font-semibold")}
                  >
                    <td className="px-3 py-1.5 font-mono text-xs">{p.ref}</td>
                    <td className="px-3 py-1.5">{p.label}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Money value={p.net} currency={currency} />
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted">
                      <Money value={p.netN1} currency={currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden p-0">
              <div className="border-b border-border px-4 py-3 font-display">
                Compte de résultat (RA–XI)
              </div>
              <ul className="divide-y divide-border text-sm">
                {pnl.map((b) => (
                  <li
                    key={b.ref}
                    className={cn(
                      "flex justify-between gap-2 px-4 py-2",
                      b.total && "font-semibold bg-muted/20",
                    )}
                  >
                    <span>
                      <span className="mr-2 font-mono text-xs text-muted">{b.ref}</span>
                      {b.label}
                    </span>
                    <span className="text-right">
                      <Money value={b.amount} currency={currency} />
                      <span className="ml-2 text-xs text-muted">
                        N-1 <Money value={b.amountN1} currency={currency} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="overflow-hidden p-0">
              <div className="border-b border-border px-4 py-3 font-display">
                Tableau des flux de trésorerie (FA–ZH)
              </div>
              <ul className="divide-y divide-border text-sm">
                {tft.map((l) => (
                  <li
                    key={l.ref}
                    className={cn(
                      "flex justify-between gap-2 px-4 py-2",
                      l.total && "font-semibold bg-muted/20",
                    )}
                  >
                    <span>
                      <span className="mr-2 font-mono text-xs text-muted">{l.ref}</span>
                      {l.label}
                    </span>
                    <span className="text-right">
                      <Money value={l.amount} currency={currency} />
                      <span className="ml-2 text-xs text-muted">
                        N-1 <Money value={l.amountN1} currency={currency} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mb-4 overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 font-display">
              Notes annexes (valeur égale aux autres états)
            </div>
            <ul className="divide-y divide-border">
              {notes.map((n) => (
                <li key={n.code + n.title} className="px-4 py-3 text-sm">
                  <p className="font-medium">
                    Note {n.code} — {n.title}
                  </p>
                  <p className="mt-1 text-xs text-muted whitespace-pre-wrap">{n.body}</p>
                </li>
              ))}
            </ul>
          </Card>

          {profile === "SYCEBNL" ? (
            <Card className="mb-4 p-4">
              <h3 className="font-display mb-2">ESS (SYCEBNL)</h3>
              <ul className="text-sm space-y-1">
                {ess.map((e, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{e.label}</span>
                    <Money value={e.amount} currency={currency} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <p className="text-xs text-muted">
            CA (approx) {k.ca?.toLocaleString("fr-FR")} · IS dû{" "}
            {isc.isDue.toLocaleString("fr-FR")} {currency}. Utilisez « Archiver N → N-1 » en clôture
            pour alimenter la colonne comparative.
          </p>
        </>
      )}
    </div>
  );
}
