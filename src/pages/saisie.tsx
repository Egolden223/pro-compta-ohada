import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AccountPicker } from "@/components/account-picker";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { accountLabel } from "@/lib/accounts";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/utils";
import type { JournalCode, JournalLine } from "@/lib/types";
import { countryByName } from "@/lib/countries";
import { Trash2 } from "lucide-react";

const JOURNALS: JournalCode[] = ["CAI", "BQ", "VTE", "ACH", "OD", "AN", "PAIE", "AMORT"];

const empty = (): Omit<JournalLine, "id"> => ({
  date: todayISO(),
  piece: "",
  journal: "OD",
  debit: "622",
  credit: "571",
  libelle: "",
  amount: 0,
  source: "manual",
        axeAnalytique: axe || undefined,
        axe2: axe2 || undefined,
});

export function SaisiePage() {
  const journal = useAppStore((s) => s.journal);
  const add = useAppStore((s) => s.addJournalLine);
  const remove = useAppStore((s) => s.removeJournalLine);
  const reverse = useAppStore((s) => s.reverseJournalLine);
  const lockLine = useAppStore((s) => s.lockJournalLine);
  const addAtt = useAppStore((s) => s.addAttachment);
  const attachments = useAppStore((s) => s.attachments) || [];
  const axes = useAppStore((s) => s.analyticAxes) || [];
  const [axe, setAxe] = useState("");
  const [axe2, setAxe2] = useState("");
  const canWrite = useAppStore((s) => s.can("write"));
  const peek = useAppStore((s) => s.peekNumber);
  const consume = useAppStore((s) => s.consumeNumber);
  const country = useAppStore((s) => s.settings.country);
  const currency = countryByName(country).currency;
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");

  const filtered = [...journal]
    .reverse()
    .filter((l) => {
      const hay = `${l.piece} ${l.libelle} ${l.debit} ${l.credit}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || form.amount <= 0) {
      toast.error("Indiquez un montant strictement positif.");
      return;
    }
    if (!form.debit || !form.credit) {
      toast.error("Choisissez les deux comptes.");
      return;
    }
    if (form.debit === form.credit) {
      toast.error("Le débit et le crédit doivent être différents.");
      return;
    }
    if (!form.libelle.trim()) {
      toast.error("Saisissez un libellé.");
      return;
    }
    const piece = form.piece.trim() || consume("PIECE_BROUILLARD");
    // Chaque ligne est déjà équilibrée (1 débit = 1 crédit = montant).
    // Contrôle anti-erreur : compte débit/crédit non vides + montant entier XOF
    if (!Number.isFinite(form.amount) || form.amount !== Math.round(form.amount)) {
      toast.error("Le montant doit être un entier (XOF sans décimales).");
      return;
    }
    add({ ...form, piece, amount: Math.round(form.amount), source: "manual" });
    toast.success(`Écriture enregistrée — pièce ${piece} (D ${form.debit} / C ${form.credit}).`);
    setForm({ ...empty(), piece: "", date: form.date, journal: form.journal });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Saisie"
        title="Brouillard"
        description="Une ligne = un mouvement débit/crédit. C’est le seul journal à remplir : tout le reste se calcule."
      />

      <Card className="mb-6">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="N° pièce" hint={`Prochain auto : ${peek("PIECE_BROUILLARD")}`}>
            <Input
              value={form.piece}
              placeholder="laissé vide = n° auto"
              onChange={(e) => setForm({ ...form, piece: e.target.value })}
            />
          </Field>
          <Field label="Journal">
            <NativeSelect
              value={form.journal}
              onChange={(e) => setForm({ ...form, journal: e.target.value as JournalCode })}
            >
              {JOURNALS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Axe 1 (section)">
          <NativeSelect value={axe} onChange={(e) => setAxe(e.target.value)}>
            <option value="">— Aucun —</option>
            {axes.filter((a) => a.active).map((a) => (
              <option key={a.id} value={a.code}>
                {a.code} — {a.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Axe 2 (projet)">
          <NativeSelect value={axe2} onChange={(e) => setAxe2(e.target.value)}>
            <option value="">— Aucun —</option>
            {axes.filter((a) => a.active).map((a) => (
              <option key={a.id} value={a.code}>
                {a.code} — {a.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Compte débité">
            <AccountPicker value={form.debit} onChange={(debit) => setForm({ ...form, debit })} />
          </Field>
          <Field label="Compte crédité">
            <AccountPicker value={form.credit} onChange={(credit) => setForm({ ...form, credit })} />
          </Field>
          <Field label="Montant">
            <Input
              inputMode="decimal"
              value={form.amount || ""}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Libellé">
              <Input value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Écritures ({journal.length})</h2>
        <Input
          className="max-w-xs"
          placeholder="Rechercher…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Pièce</th>
              <th className="px-3 py-2 font-medium">Jnl</th>
              <th className="px-3 py-2 font-medium">Débit</th>
              <th className="px-3 py-2 font-medium">Crédit</th>
              <th className="px-3 py-2 font-medium">Libellé</th>
              <th className="px-3 py-2 font-medium text-right">Montant</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(l.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.piece}</td>
                <td className="px-3 py-2">{l.journal}</td>
                <td className="px-3 py-2 font-mono text-xs" title={accountLabel(l.debit)}>
                  {l.debit}
                </td>
                <td className="px-3 py-2 font-mono text-xs" title={accountLabel(l.credit)}>
                  {l.credit}
                </td>
                <td className="px-3 py-2 max-w-[280px] truncate">{l.libelle}</td>
                <td className="px-3 py-2 text-right">
                  <Money value={l.amount} currency={currency} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    {!l.locked && !l.reversedBy ? (
                      <button
                        className="rounded-[8px] px-1.5 py-1 text-[10px] text-muted hover:bg-elevated"
                        title="Verrouiller"
                        type="button"
                        onClick={() => {
                          lockLine(l.id);
                          toast.success("Écriture verrouillée");
                        }}
                      >
                        🔒
                      </button>
                    ) : null}
                    {!l.reversedBy && !l.reversesId ? (
                      <button
                        className="rounded-[8px] px-1.5 py-1 text-[10px] text-muted hover:bg-elevated"
                        title="Contrepasser"
                        type="button"
                        onClick={() => {
                          const err = reverse(l.id);
                          if (err) toast.error(err);
                          else toast.success("Contrepassation enregistrée");
                        }}
                      >
                        ↺
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted">{l.reversesId ? "CP" : "⇄"}</span>
                    )}
                    <label className="cursor-pointer rounded-[8px] px-1.5 py-1 text-[10px] text-muted hover:bg-elevated" title="Joindre un fichier">
                      📎
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.png,.jpg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 400_000) {
                            toast.error("Fichier trop volumineux (max ~400 Ko en local).");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            addAtt({
                              refType: "journal",
                              refId: l.id,
                              name: file.name,
                              dataUrl: String(reader.result),
                              mime: file.type || "application/octet-stream",
                            });
                            toast.success("Pièce jointe ajoutée");
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {!l.locked && !l.reversedBy ? (
                      <button
                        className="rounded-[8px] p-1.5 text-muted hover:bg-elevated hover:text-danger"
                        onClick={() => {
                          remove(l.id);
                          toast("Ligne supprimée");
                        }}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="p-6 text-sm text-muted">Aucune écriture.</p> : null}
      </div>
    </div>
  );
}
