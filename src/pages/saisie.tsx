import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AccountPicker } from "@/components/account-picker";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/utils";
import type { JournalCode, JournalLine } from "@/lib/types";
import { countryByName } from "@/lib/countries";
import { Trash2 } from "lucide-react";
import { JOURNAL_OPTIONS, suggestJournal } from "@/lib/journal-utils";

const empty = (): Omit<JournalLine, "id"> => ({
  date: todayISO(),
  piece: "",
  journal: "OD",
  debit: "",
  credit: "",
  amount: 0,
  libelle: "",
  source: "manual",
});

export function SaisiePage() {
  const journal = useAppStore((s) => s.journal);
  const add = useAppStore((s) => s.addJournalLine);
  const remove = useAppStore((s) => s.removeJournalLine);
  const reverse = useAppStore((s) => s.reverseJournalLine);
  const lockLine = useAppStore((s) => s.lockJournalLine);
  const addAtt = useAppStore((s) => s.addAttachment);
  const axes = useAppStore((s) => s.analyticAxes) || [];
  const [axe, setAxe] = useState("");
  const [axe2, setAxe2] = useState("");
  const canWrite = useAppStore((s) => s.can("write"));
  const consume = useAppStore((s) => s.consumeNumber);
  const country = useAppStore((s) => s.settings.country);
  const currency = countryByName(country).currency;
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");
  const journalTemplates =
    useAppStore((s) => (s as { journalTemplates?: { id: string; name: string; journal: string; debit: string; credit: string; libelle: string; amount?: number }[] }).journalTemplates) || [];
  const recurring = useAppStore((s) => s.recurring) || [];
  const addJournalTemplate = useAppStore((s) => (s as { addJournalTemplate?: (t: unknown) => void }).addJournalTemplate);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [tplName, setTplName] = useState("");

  function applyModel(m: { journal?: string; debit: string; credit: string; libelle: string; amount?: number }) {
    setForm((f) => {
      const debit = m.debit;
      const credit = m.credit;
      const jnl = (m.journal as JournalCode) || suggestJournal(debit, credit);
      return { ...f, journal: jnl, debit, credit, libelle: m.libelle, amount: m.amount ?? f.amount };
    });
    toast.message("Modèle chargé — modifiez puis Enregistrer.");
  }

  function saveAsTemplate() {
    if (!addJournalTemplate) {
      toast.error("Fonction modèles non disponible.");
      return;
    }
    if (!form.debit || !form.credit || !form.libelle.trim()) {
      toast.error("Renseignez débit, crédit et libellé.");
      return;
    }
    addJournalTemplate({
      name: tplName.trim() || form.libelle.trim().slice(0, 40),
      journal: form.journal,
      debit: form.debit,
      credit: form.credit,
      libelle: form.libelle,
      amount: form.amount || undefined,
    });
    setTplName("");
    toast.success("Modèle enregistré");
  }

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
    if (!Number.isFinite(form.amount) || form.amount !== Math.round(form.amount)) {
      toast.error("Le montant doit être un entier (XOF sans décimales).");
      return;
    }
    add({
      ...form,
      piece,
      amount: Math.round(form.amount),
      source: "manual",
      axeAnalytique: axe || undefined,
      axe2: axe2 || undefined,
    });
    if (pendingFile) {
      const file = pendingFile;
      if (file.size > 400_000) toast.error("Pièce jointe trop volumineuse (max ~400 Ko).");
      else {
        const reader = new FileReader();
        reader.onload = () => {
          const lines = useAppStore.getState().journal;
          const last = [...lines].reverse().find((l) => l.piece === piece);
          addAtt({
            refType: "journal",
            refId: last?.id || piece,
            name: file.name,
            dataUrl: String(reader.result),
            mime: file.type || "application/octet-stream",
          });
          toast.success("Pièce justificative jointe");
        };
        reader.readAsDataURL(file);
      }
      setPendingFile(null);
    }
    toast.success(`Écriture enregistrée — pièce ${piece}`);
    setForm({ ...empty(), piece: "", date: form.date, journal: form.journal });
    setAxe("");
    setAxe2("");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Saisie"
        title="Brouillard"
        description="Une ligne = un mouvement débit/crédit. C’est le seul journal à remplir : tout le reste se calcule."
      />

      <Card className="mb-4 space-y-3 p-4">
        <p className="text-sm font-medium">Modèles / récurrents → préremplir le brouillard</p>
        <p className="text-xs text-muted">Chargez un modèle, ajustez, puis Enregistrer. Rien n&apos;est écrit tant que vous ne validez pas.</p>
        <div className="flex flex-wrap gap-2">
          {journalTemplates.map((t) => (
            <Button key={t.id} type="button" variant="secondary" size="sm" onClick={() => applyModel(t)}>
              {t.name}
            </Button>
          ))}
          {journalTemplates.length === 0 ? (
            <span className="text-xs text-muted">Aucun modèle perso — saisissez puis « Sauver modèle ».</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
          <Field label="Nom du modèle à sauver">
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Ex. Loyer mensuel siège" />
          </Field>
          <Button type="button" variant="secondary" onClick={saveAsTemplate} disabled={!canWrite}>
            Sauver modèle depuis le formulaire
          </Button>
        </div>
      </Card>

      <Card className="mb-6">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="N° pièce">
            <Input value={form.piece} onChange={(e) => setForm({ ...form, piece: e.target.value })} placeholder="laissé vide = n° auto" />
          </Field>
          <Field label="Journal">
            <NativeSelect value={form.journal} onChange={(e) => setForm({ ...form, journal: e.target.value as JournalCode })}>
              {JOURNAL_OPTIONS.map((j) => (
                <option key={j.code} value={j.code}>{j.label}</option>
              ))}
            </NativeSelect>
            <p className="mt-1 text-[11px] text-muted">Proposé automatiquement selon les comptes (modifiable).</p>
          </Field>
          <Field label="Axe 1 (section)">
            <NativeSelect value={axe} onChange={(e) => setAxe(e.target.value)}>
              <option value="">— Aucun —</option>
              {axes.map((a) => (
                <option key={a.id} value={a.code}>{a.code} — {a.label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Axe 2 (projet)">
            <NativeSelect value={axe2} onChange={(e) => setAxe2(e.target.value)}>
              <option value="">— Aucun —</option>
              {axes.map((a) => (
                <option key={a.id} value={a.code}>{a.code} — {a.label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Compte débité">
            <AccountPicker
              value={form.debit}
              onChange={(debit) => setForm((f) => ({ ...f, debit, journal: suggestJournal(debit, f.credit) }))}
            />
          </Field>
          <Field label="Compte crédité">
            <AccountPicker
              value={form.credit}
              onChange={(credit) => setForm((f) => ({ ...f, credit, journal: suggestJournal(f.debit, credit) }))}
            />
          </Field>
          <Field label="Montant">
            <Input type="number" min={0} step={1} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Libellé">
            <Input value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </Field>
          <Field label="Pièce justificative (optionnel)">
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setPendingFile(e.target.files?.[0] || null)} />
            {pendingFile ? <p className="mt-1 text-xs text-muted">{pendingFile.name}</p> : null}
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={!canWrite}>Enregistrer</Button>
          </div>
        </form>
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg">Écritures ({journal.length})</h2>
        <Input className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" />
      </div>
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-elevated text-left text-xs text-muted">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Pièce</th>
              <th className="px-3 py-2">Jnl</th>
              <th className="px-3 py-2">Débit</th>
              <th className="px-3 py-2">Crédit</th>
              <th className="px-3 py-2">Libellé</th>
              <th className="px-3 py-2 text-right">Montant</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(l.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.piece}</td>
                <td className="px-3 py-2" title={JOURNAL_OPTIONS.find((j) => j.code === l.journal)?.label || l.journal}>
                  <span className="font-mono text-xs">{l.journal}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{l.debit}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.credit}</td>
                <td className="px-3 py-2">{l.libelle}</td>
                <td className="px-3 py-2 text-right"><Money value={l.amount} currency={currency} /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {!l.locked ? (
                      <button type="button" className="rounded-[8px] px-1.5 py-1 text-[10px] text-muted hover:bg-elevated" title="Verrouiller" onClick={() => lockLine(l.id)}>🔒</button>
                    ) : (
                      <span className="text-[10px] text-muted">🔒</span>
                    )}
                    {!l.reversedBy && !l.reversesId ? (
                      <button type="button" className="rounded-[8px] px-1.5 py-1 text-[10px] text-muted hover:bg-elevated" title="Contrepasser" onClick={() => { const r = reverse(l.id); if (!r) toast.error("Impossible"); else toast.success("Contrepassation"); }}>↺</button>
                    ) : (
                      <span className="text-[10px] text-muted">{l.reversesId ? "CP" : "⇄"}</span>
                    )}
                    <label className="cursor-pointer rounded-[8px] px-1.5 py-1 text-[10px] text-muted hover:bg-elevated" title="Joindre">
                      📎
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 400_000) { toast.error("Fichier trop volumineux"); return; }
                        const reader = new FileReader();
                        reader.onload = () => {
                          addAtt({ refType: "journal", refId: l.id, name: file.name, dataUrl: String(reader.result), mime: file.type || "application/octet-stream" });
                          toast.success("Pièce jointe ajoutée");
                        };
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                    {!l.locked && !l.reversedBy ? (
                      <button type="button" className="rounded-[8px] p-1.5 text-muted hover:bg-elevated hover:text-danger" onClick={() => { remove(l.id); toast("Ligne supprimée"); }} aria-label="Supprimer">
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
