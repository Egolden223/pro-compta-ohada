import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { docTotals, lineHt } from "@/lib/engine";
import { countryByName } from "@/lib/countries";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/utils";
import type { DocLine, RecurringTemplate } from "@/lib/types";

export function RecurringPage() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const currency = tax.currency;
  const clients = data.partners.filter((p) => p.kind === "client");
  const list = data.recurring || [];

  const [name, setName] = useState("");
  const [partnerId, setPartnerId] = useState(clients[0]?.id ?? "");
  const [day, setDay] = useState(1);
  const [nextDate, setNextDate] = useState(todayISO());
  const [designation, setDesignation] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [vatRate, setVatRate] = useState(tax.vat);

  function add() {
    if (!name.trim() || !partnerId) {
      toast.error("Nom et client requis.");
      return;
    }
    if (!designation || unitPrice <= 0) {
      toast.error("Ligne de facturation incomplète.");
      return;
    }
    const lines: DocLine[] = [
      { designation, qty, unitPrice, vatRate, articleId: undefined },
    ];
    data.addRecurring({
      name: name.trim(),
      partnerId,
      lines,
      dayOfMonth: Math.min(28, Math.max(1, day)),
      nextDate,
      active: true,
      saleAccount: "701",
      notes: "",
    });
    toast.success("Modèle de facturation récurrente créé.");
    setName("");
    setDesignation("");
    setUnitPrice(0);
  }

  function generate() {
    const n = data.generateRecurringInvoices(todayISO());
    if (n === 0) toast.message("Aucune facture à générer (échéances futures).");
    else toast.success(`${n} facture(s) générée(s) — à poster dans le brouillard.`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Commercial"
        title="Facturation récurrente"
        description="Modèles mensuels (loyers, abonnements, maintenance). Génération automatique des factures dues."
        actions={
          <Button type="button" onClick={generate}>
            Générer les factures dues
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg">Nouveau modèle</h2>
          <div className="grid gap-3">
            <Field label="Nom du modèle">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Abonnement mensuel" />
            </Field>
            <Field label="Client">
              <NativeSelect value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jour du mois">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value) || 1)}
                />
              </Field>
              <Field label="Prochaine échéance">
                <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Désignation">
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Qté">
                <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
              </Field>
              <Field label="PU HT">
                <Input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="TVA">
                <Input
                  type="number"
                  step="0.01"
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                />
              </Field>
            </div>
            <Button type="button" onClick={add}>
              Créer le modèle
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg">Comment ça marche</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>Créez un modèle lié à un client (montant HT + TVA).</li>
            <li>Définissez le jour du mois et la prochaine échéance.</li>
            <li>
              Cliquez sur <strong>Générer les factures dues</strong> : une facture est créée pour chaque
              échéance ≤ aujourd&apos;hui.
            </li>
            <li>Ouvrez Documents → Factures → transférez vers le brouillard.</li>
          </ol>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-lg">Modèles actifs</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Jour</th>
              <th className="px-4 py-2">Prochaine</th>
              <th className="px-4 py-2 text-right">HT</th>
              <th className="px-4 py-2">Actif</th>
              <th className="px-4 py-2">Dernière</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const partner = data.partners.find((p) => p.id === r.partnerId);
              const ht = r.lines.reduce((s, l) => s + lineHt(l), 0);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2">{partner?.name ?? "—"}</td>
                  <td className="px-4 py-2">{r.dayOfMonth}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.nextDate)}</td>
                  <td className="px-4 py-2 text-right">
                    <Money value={ht} currency={currency} />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => data.updateRecurring(r.id, { active: !r.active })}
                    >
                      {r.active ? "Oui" : "Non"}
                    </button>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.lastGenerated || "—"}</td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-danger"
                      onClick={() => {
                        data.removeRecurring(r.id);
                        toast("Modèle supprimé");
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 ? (
          <p className="p-6 text-sm text-muted">Aucun modèle. Créez-en un à gauche.</p>
        ) : null}
      </Card>
    </div>
  );
}
