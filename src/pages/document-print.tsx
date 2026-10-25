import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { docTotals, lineHt } from "@/lib/engine";
import { formatDate, formatPct } from "@/lib/format";
import { countryByName } from "@/lib/countries";
import type { ReactNode } from "react";

const TITLES: Record<string, string> = {
  FACTURE: "FACTURE",
  DEVIS: "DEVIS",
  AVOIR: "AVOIR / NOTE DE CRÉDIT",
  RECU: "REÇU DE PAIEMENT",
  BON_CMD: "BON DE COMMANDE",
  BON_CLIENT: "BON DE COMMANDE CLIENT",
};

export function DocumentPrintPage({ id }: { id: string }) {
  const data = useAppStore();
  const doc = data.documents.find((d) => d.id === id);
  if (!doc) {
    return (
      <div>
        <PageHeader title="Document introuvable" />
        <Link to="/documents" className="text-sm text-accent">
          Retour au registre
        </Link>
      </div>
    );
  }
  const partner = data.partners.find((p) => p.id === doc.partnerId);
  const tot = docTotals(doc);
  const tax = countryByName(data.settings.country);
  const s = data.settings;

  return (
    <div>
      <div className="mb-4 flex gap-2 no-print">
        <Button variant="secondary" onClick={() => window.print()}>
          Imprimer / PDF
        </Button>
        <Link to="/documents" className="inline-flex h-11 items-center px-3 text-sm text-muted hover:text-fg">
          Retour
        </Link>
      </div>

      <article className="mx-auto max-w-3xl rounded-[24px] border border-border bg-paper p-8 text-ink print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-ink/15 pb-6">
          <div>
            <p className="font-display text-2xl font-medium tracking-tight">{s.companyName}</p>
            <p className="text-sm text-ink/70">
              {s.legalForm}
              {s.sigle ? ` · ${s.sigle}` : ""}
            </p>
            <p className="mt-2 text-sm text-ink/70">
              {s.address || "Adresse à compléter"}
              <br />
              {s.rccm ? `RCCM ${s.rccm}` : "RCCM —"}
              {s.nif ? ` · IFU/NIF ${s.nif}` : " · IFU/NIF —"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/50">{TITLES[doc.type]}</p>
            <p className="font-mono text-lg">{doc.number}</p>
            <p className="text-sm">{formatDate(doc.date, s.lang)}</p>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/50">Destinataire</p>
            <p className="mt-1 font-medium">{partner?.name}</p>
            <p className="text-sm text-ink/70">
              {partner?.address}
              <br />
              {partner?.phone} {partner?.email}
            </p>
          </div>
          <div className="text-sm">
            {doc.linkedDoc ? <p>Réf. liée : {doc.linkedDoc}</p> : null}
            {doc.motif ? <p>Motif : {doc.motif}</p> : null}
            {doc.type === "DEVIS" ? <p>Validité : {doc.validityDays} jours</p> : null}
            <p>Compte : {partner?.account}</p>
          </div>
        </section>

        {doc.type === "RECU" ? (
          <p className="mt-8 font-display text-2xl">
            Reçu : <Money value={doc.paid || tot.ttc} currency={doc.currency} />
            <span className="ml-2 text-base font-sans text-ink/70">par {doc.paymentMode || "—"}</span>
          </p>
        ) : (
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-ink/20 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="py-2 font-medium">Désignation</th>
                <th className="py-2 text-right font-medium">Qté</th>
                <th className="py-2 text-right font-medium">P.U. HT</th>
                <th className="py-2 text-right font-medium">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={i} className="border-b border-ink/10">
                  <td className="py-2">{l.designation}</td>
                  <td className="py-2 text-right font-mono">{l.qty}</td>
                  <td className="py-2 text-right">
                    <Money value={l.unitPrice} currency={doc.currency} />
                  </td>
                  <td className="py-2 text-right">
                    <Money value={lineHt(l)} currency={doc.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {doc.type !== "RECU" ? (
          <div className="mt-6 ml-auto max-w-xs text-sm">
            <Row k="Total HT" v={<Money value={tot.ht} currency={doc.currency} />} />
            <Row k={`TVA (${formatPct(tax.vat)})`} v={<Money value={tot.tva} currency={doc.currency} />} />
            <Row k="Total TTC" v={<Money value={tot.ttc} currency={doc.currency} />} bold />
            <Row k="Payé" v={<Money value={doc.paid} currency={doc.currency} />} />
            <Row k="Reste dû" v={<Money value={tot.reste} currency={doc.currency} />} bold />
          </div>
        ) : null}

        {doc.notes ? <p className="mt-8 text-sm text-ink/70">{doc.notes}</p> : null}

        <footer className="mt-10 border-t border-ink/15 pt-4 text-xs text-ink/50">
          Document conforme aux règles fiscales {s.country} · SYSCOHADA · {tax.zone} · {doc.currency}
        </footer>
      </article>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: ReactNode; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-medium" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
