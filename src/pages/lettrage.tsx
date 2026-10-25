import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { openItemsForAccount, openBalance, canLetter } from "@/lib/engine";
import { countryByName } from "@/lib/countries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LettragePage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const partners = data.partners;
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const partner = partners.find((p) => p.id === partnerId);
  const account = partner?.account || "";

  const items = useMemo(
    () => (account ? openItemsForAccount(data.journal, account) : []),
    [data.journal, account],
  );
  const balance = account ? openBalance(data.journal, account) : 0;

  const selectedItems = items.filter((it) => selected.has(it.lineId));
  const check = canLetter(selectedItems);

  // Groupes déjà lettrés sur ce compte
  const letteredGroups = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number; count: number }>();
    for (const l of data.journal) {
      if (!l.lettering) continue;
      if (l.debit !== account && l.credit !== account) continue;
      const g = map.get(l.lettering) ?? { debit: 0, credit: 0, count: 0 };
      if (l.debit === account) g.debit += l.amount;
      if (l.credit === account) g.credit += l.amount;
      g.count += 1;
      map.set(l.lettering, g);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.journal, account]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function doLetter() {
    if (!check.ok) {
      toast.error(
        `Débits (${check.debit.toLocaleString("fr-FR")}) ≠ crédits (${check.credit.toLocaleString("fr-FR")}).`,
      );
      return;
    }
    const err = data.letterLines([...selected]);
    if (err) toast.error(err);
    else {
      toast.success("Lettrage enregistré.");
      setSelected(new Set());
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Comptabilité"
        title="Lettrage"
        description="Pointez les écritures d'un compte client ou fournisseur (Σ débits = Σ crédits)."
      />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tiers">
            <NativeSelect
              value={partnerId}
              onChange={(e) => {
                setPartnerId(e.target.value);
                setSelected(new Set());
              }}
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kind === "client" ? "C" : "F"} — {p.name} ({p.account})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div>
            <p className="text-xs text-muted">Compte</p>
            <p className="mt-1 font-mono text-lg">{account || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Solde ouvert (non lettré)</p>
            <p className="mt-1 font-display text-lg">
              <Money value={balance} currency={currency} />
            </p>
          </div>
        </div>
      </Card>

      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="font-display text-lg">Écritures ouvertes</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">
              Sélection : D {check.debit.toLocaleString("fr-FR")} / C{" "}
              {check.credit.toLocaleString("fr-FR")}
              {check.ok ? " ✓" : ""}
            </span>
            <Button type="button" disabled={!check.ok} onClick={doLetter}>
              Lettrer
            </Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-3 py-2 w-10" />
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Pièce</th>
              <th className="px-3 py-2">Libellé</th>
              <th className="px-3 py-2 text-right">Débit</th>
              <th className="px-3 py-2 text-right">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.lineId}
                className={cn(
                  "border-t border-border cursor-pointer",
                  selected.has(it.lineId) && "bg-accent/10",
                )}
                onClick={() => toggle(it.lineId)}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(it.lineId)}
                    onChange={() => toggle(it.lineId)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(it.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{it.piece}</td>
                <td className="px-3 py-2 max-w-[240px] truncate">{it.libelle}</td>
                <td className="px-3 py-2 text-right">
                  {it.side === "D" ? <Money value={it.amount} currency={currency} /> : ""}
                </td>
                <td className="px-3 py-2 text-right">
                  {it.side === "C" ? <Money value={it.amount} currency={currency} /> : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="p-6 text-sm text-muted">Aucune écriture ouverte sur ce compte.</p>
        ) : null}
      </Card>

      {letteredGroups.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg">Lettrages existants</h2>
          <ul className="space-y-2 text-sm">
            {letteredGroups.map(([code, g]) => (
              <li
                key={code}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border px-3 py-2"
              >
                <span>
                  <span className="font-mono font-semibold">{code}</span> — {g.count} ligne(s) · D{" "}
                  {g.debit.toLocaleString("fr-FR")} / C {g.credit.toLocaleString("fr-FR")}
                </span>
                <Button type="button" variant="secondary" onClick={() => data.unletter(code)}>
                  Délettrer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
