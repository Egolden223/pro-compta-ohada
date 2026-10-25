import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import {
  buildDeclarationCalendar,
  defaultDeclarationObligations,
  estimateDeclarationAmounts,
  buildDashboardBi,
  buildAnalyticPnl,
  docTotals,
  fiscalDeadlines,
  kpis,
  stockOf,
} from "@/lib/engine";
import { daysUntil } from "@/lib/format";
import { countryByName } from "@/lib/countries";

export function DashboardPage() {
  const data = useAppStore();
  const bi = buildDashboardBi(data);
  const tax = countryByName(data.settings.country);
  const currency = tax.currency;
  const k = kpis(data);
  const analytic = buildAnalyticPnl(data.journal);
  const deadlines = fiscalDeadlines(data);
  const declReminders = buildDeclarationCalendar(
    data.declarationObligations?.length
      ? data.declarationObligations
      : defaultDeclarationObligations(tax),
    data.declarationsDone || [],
    new Date().toISOString().slice(0, 10),
    estimateDeclarationAmounts(data.journal, data.employees, tax),
  ).filter((r) => r.status === "en_retard" || r.status === "urgent");

  const alerts = data.articles.filter(
    (a) => stockOf(a, data.stockMoves).status !== "OK" && a.purchasePrice > 0,
  );
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
        description="Les soldes se recalculent à partir du brouillard, du stock et de la trésorerie."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Trésorerie (BI)</p>
          <p className="text-lg font-semibold">
            <Money value={bi.tresorerie} currency={currency} />
          </p>
        </Card>
        {tiles.slice(0, 3).map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className="text-lg font-semibold">
              <Money value={t.value} currency={currency} />
            </p>
          </Card>
        ))}
      </div>

      {declReminders.length > 0 ? (
        <Card className="mb-4 border-amber-500/40 p-4">
          <h2 className="mb-2 font-display text-lg">Rappels déclaratifs</h2>
          <ul className="space-y-1 text-sm">
            {declReminders.slice(0, 5).map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span>{r.periodLabel}</span>
                <span className="text-xs text-muted">
                  {r.dueDate} · {r.status}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/echeances" className="mt-2 inline-block text-sm text-accent">
            Voir le calendrier →
          </Link>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className="text-lg font-semibold">
              <Money value={t.value} currency={currency} />
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-display text-lg">Factures ouvertes</h2>
          {openInvoices.length === 0 ? (
            <p className="text-sm text-muted">Aucune créance ouverte.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {openInvoices.slice(0, 8).map((x) => (
                <li key={x.d.id} className="flex justify-between">
                  <span>
                    {x.d.number} · {x.d.partnerName}
                  </span>
                  <Money value={x.reste} currency={currency} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-display text-lg">Alertes stock</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted">Stock OK.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {alerts.slice(0, 8).map((a) => (
                <li key={a.id}>{a.name}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-display text-lg">Échéances fiscales</h2>
          <ul className="space-y-1 text-sm">
            {deadlines.slice(0, 6).map((d, i) => (
              <li key={i} className="flex justify-between">
                <span>{d.label}</span>
                <span className="text-xs text-muted">{d.date}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-display text-lg">Analytique (top)</h2>
          {analytic.length === 0 ? (
            <p className="text-sm text-muted">Pas encore de ventilation analytique.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {analytic.slice(0, 6).map((a, i) => (
                <li key={i} className="flex justify-between">
                  <span>{a.label}</span>
                  <Money value={a.amount} currency={currency} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {backupDue ? (
        <Card className="mt-4 border-amber-500/40 p-4 text-sm">
          Pensez à exporter une sauvegarde JSON (Paramètres / Gestion).
        </Card>
      ) : null}
    </div>
  );
}
