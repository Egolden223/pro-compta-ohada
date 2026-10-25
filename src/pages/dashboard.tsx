import { Link } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { buildDeclarationCalendar, defaultDeclarationObligations, estimateDeclarationAmounts, buildDashboardBi, buildAnalyticPnl, docTotals, fiscalDeadlines, kpis, nextNumber, stockOf } from "@/lib/engine";
import { daysUntil, formatDate } from "@/lib/format";
import { countryByName } from "@/lib/countries";

export function DashboardPage() {
  const data = useAppStore();
  const bi = buildDashboardBi(data);
  const tax = countryByName(data.settings.country);
  const declReminders = buildDeclarationCalendar(
    data.declarationObligations?.length ? data.declarationObligations : defaultDeclarationObligations(tax),
    data.declarationsDone || [],
    new Date().toISOString().slice(0, 10),
    estimateDeclarationAmounts(data.journal, data.employees, tax),
  ).filter((r) => r.status === "en_retard" || r.status === "urgent");
  const currency = countryByName(data.settings.country).currency;
  const k = kpis(data);
  const analytic = buildAnalyticPnl(data.journal);
  const tax = countryByName(data.settings.country);
  const deadlines = fiscalDeadlines(data);
  const alerts = data.articles.filter((a) => stockOf(a, data.stockMoves).status !== "OK" && a.purchasePrice > 0);
  const openInvoices = data.documents
    .filter((d) => d.type === "FACTURE")
    .map((d) => ({ d, ...docTotals(d) }))
    .filter((x) => x.reste > 0);
  const daysSinceBackup = data.lastBackupAt ? -daysUntil(data.lastBackupAt) : null;
  const backupDue = daysSinceBackup === null || daysSinceBackup >= 14;

  const tiles = [
    { label: "Chiffre d'affaires (exercice)", value: k.caYear },
    { label: "Résultat net", value: k.rn },
    { label: "Trésorerie nette", value: k.treso },
    { label: "Créances clients", value: k.clients },
    { label: "Dettes fournisseurs", value: k.fourn },
    { label: "Factures impayées", value: k.unpaid },
    { label: "Valeur du stock", value: k.stockValue },
    { label: "TVA à décaisser", value: k.vatDue },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Pilotage"
        title="Tableau de bord"
        description="Les soldes se recalculent à partir du brouillard, 

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Trésorerie</p>
          <p className="text-lg font-semibold"><Money value={bi.tresorerie} currency={currency} />
      {declReminders.length > 0 ? (
        <Card className="mb-4 border-amber-500/40 p-4">
          <h2 className="mb-2 font-display text-lg">Rappels déclaratifs</h2>
          <ul className="space-y-1 text-sm">
            {declReminders.slice(0, 5).map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span>{r.periodLabel}</span>
                <span className="text-xs text-muted">{r.dueDate} · {r.status}</span>
              </li>
            ))}
          </ul>
          <a href="/echeances" className="mt-2 inline-block text-xs text-primary underline">
            Voir toutes les échéances
          </a>
        </Card>
      ) : null}
</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Créances clients</p>
          <p className="text-lg font-semibold"><Money value={bi.creancesClients} currency={currency} /></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Dettes fournisseurs</p>
          <p className="text-lg font-semibold"><Money value={bi.dettesFournisseurs} currency={currency} /></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Rapprochement banque</p>
          <p className="text-lg font-semibold">{bi.tauxRapprochementBanque} %</p>
        </Card>
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-display text-lg">Top charges</h2>
          <ul className="space-y-1 text-sm">
            {bi.topCharges.map((c) => (
              <li key={c.code} className="flex justify-between">
                <span className="font-mono text-xs">{c.code}</span>
                <Money value={c.amount} currency={currency} />
              </li>
            ))}
            {bi.topCharges.length === 0 ? <li className="text-muted">Aucune charge</li> : null}
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-display text-lg">CA mensuel</h2>
          <ul className="space-y-1 text-sm">
            {bi.caMensuel.map((m) => (
              <li key={m.month} className="flex justify-between">
                <span>{m.month}</span>
                <Money value={m.amount} currency={currency} />
              </li>
            ))}
            {bi.caMensuel.length === 0 ? <li className="text-muted">Pas encore de ventes</li> : null}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Factures impayées : {bi.facturesImpayees} · Devis en cours : {bi.devisEnCours} · Écritures : {bi.nbEcritures}
          </p>
        </Card>
      </div>
du registre commercial et des stocks. Rien à saisir ici."
      />

      {backupDue ? (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-warn/40 bg-warn/5 p-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-warn" />
            <span>
              {data.lastBackupAt
                ? `Dernière sauvegarde exportée le ${formatDate(data.lastBackupAt, data.settings.lang)} — pensez à en refaire une.`
                : "Aucune sauvegarde exportée pour l'instant — vos données ne vivent que dans ce navigateur."}
            </span>
          </div>
          <Link
            to="/parametres"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            Exporter une sauvegarde <ArrowRight className="size-3.5" />
          </Link>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-xs text-muted">{tile.label}</p>
            <p className="mt-2 font-display text-xl tracking-tight sm:text-2xl">
              <Money value={tile.value} currency={tax.currency} />
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-medium">Prochaines échéances</h2>
          <ul className="mt-4 divide-y divide-border">
            {deadlines.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>{d.label}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-muted">{formatDate(d.date, data.settings.lang)}</span>
                  <Badge tone={d.days < 0 ? "danger" : d.days < 10 ? "warn" : "ok"}>
                    {d.days < 0 ? `${-d.days} j. de retard` : `${d.days} j.`}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-medium">Numérotation</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(
              [
                ["Prochaine facture", "FACTURE"],
                ["Prochain devis", "DEVIS"],
                ["Prochain reçu", "RECU"],
                ["Prochain avoir", "AVOIR"],
              ] as const
            ).map(([label, key]) => (
              <li key={key} className="flex justify-between">
                <span className="text-muted">{label}</span>
                <span className="font-mono">{nextNumber(data, key)}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/documents"
            className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            Ouvrir le registre <ArrowRight className="size-3.5" />
          </Link>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warn" />
            <h2 className="font-display text-lg font-medium">Alertes stock</h2>
          </div>
          {alerts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Aucun article en rupture ou sous le seuil.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {alerts.map((a) => {
                const st = stockOf(a, data.stockMoves);
                return (
                  <li key={a.id} className="flex justify-between">
                    <span>{a.designation}</span>
                    <Badge tone={st.status === "RUPTURE" ? "danger" : "warn"}>{st.status}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-lg font-medium">Créances ouvertes</h2>
          {openInvoices.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Toutes les factures sont soldées.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {openInvoices.map(({ d, reste }) => {
                const partner = data.partners.find((p) => p.id === d.partnerId);
                return (
                  <li key={d.id} className="flex justify-between gap-3">
                    <span className="truncate">
                      {d.number} · {partner?.name}
                    </span>
                    <Money value={reste} currency={tax.currency} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
