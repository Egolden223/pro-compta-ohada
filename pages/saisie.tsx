import { useMemo, useState } from "react";
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
import { ECRITURES_TYPES } from "@/lib/engine";
import { Trash2, Paperclip } from "lucide-react";

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
});

export function SaisiePage() {
  const journal = useAppStore((s) => s.journal);
  const add = useAppStore((s) => s.addJournalLine);
  const remove = useAppStore((s) => s.removeJournalLine);
  const reverse = useAppStore((s) => s.reverseJournalLine);
  const lockLine = useAppStore((s) => s.lockJournalLine);
  const addAtt = useAppStore((s) => s.addAttachment);
  const removeAtt = useAppStore((s) => s.removeAttachment);
  const attachments = useAppStore((s) => s.attachments) || [];
  const axes = useAppStore((s) => s.analyticAxes) || [];
  const custom = useAppStore((s) => s.customAccounts) || [];
  const journalTemplates = useAppStore((s) => s.journalTemplates) || [];
  const addJournalTemplate = useAppStore((s) => s.addJournalTemplate);
  const removeJournalTemplate = useAppStore((s) => s.removeJournalTemplate);
  const [axe, setAxe] = useState("");
  const [axe2, setAxe2] = useState("");
  const canWrite = useAppStore((s) => s.can("write"));
  const peek = useAppStore((s) => s.peekNumber);
  const consume = useAppStore((s) => s.consumeNumber);
  const country = useAppStore((s) => s.settings.country);
  const currency = countryByName(country).currency;
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");
  const [showModels, setShowModels] = useState(false);
  const [modelQ, setModelQ] = useState("");
  const [pendingFile, setPendingFile] = useState<{ name: string; dataUrl: string; mime: string } | null>(null);

  const filtered = [...journal]
    .reverse()
    .filter((l) => {
      const hay = `${l.piece} ${l.libelle} ${l.debit} ${l.credit}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });

  const models = useMemo(() => {
    const qq = modelQ.toLowerCase();
    const catalog = ECRITURES_TYPES.filter(
      (e) =>
        !qq ||
        e.label.toLowerCase().includes(qq) ||
        e.debit.includes(qq) ||
        e.credit.includes(qq) ||
        e.libelle.toLowerCase().includes(qq),
    );
    return { catalog, user: journalTemplates };
  }, [modelQ, journalTemplates]);

  function applyModelToForm(m: {
    journal: JournalCode;
    debit: string;
    credit: string;
    libelle: string;
    amount?: number;
  }) {
    setForm((f) => ({
      ...f,
      journal: m.journal,
      debit: m.debit,
      credit: m.credit,
      libelle: m.libelle,
      amount: m.amount && m.amount > 0 ? m.amount : f.amount,
    }));
    setShowModels(false);
    toast.message("Modèle chargé dans le formulaire — vérifiez puis Enregistrer.");
  }

  function saveAsTemplate() {
    if (!form.debit || !form.credit) {
      toast.error("Renseignez débit et crédit.");
      return;
    }
    const name = form.libelle.trim() || `${form.debit}/${form.credit}`;
    addJournalTemplate({
      name,
      journal: form.journal,
      debit: form.debit,
      credit: form.credit,
      libelle: form.libelle,
      amount: form.amount > 0 ? form.amount : undefined,
    });
    toast.success("Modèle d'écriture enregistré (réutilisable).");
  }

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
      toast.error("Le montant doit être un entier (sans décimales).");
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
      const lines = useAppStore.getState().journal;
      const last = [...lines].reverse().find((l) => l.piece === piece);
      if (last) {
        addAtt({
          refType: "journal",
          refId: last.id,
          name: pendingFile.name,
          dataUrl: pendingFile.dataUrl,
          mime: pendingFile.mime,
        });
      }
      setPendingFile(null);
    }
    toast.success(`Écriture enregistrée — pièce ${piece} (D ${form.debit} / C ${form.credit}).`);
    setForm({ ...empty(), piece: "", date: form.date, journal: form.journal });
  }

  function onPickFile(file: File | undefined, refId?: string) {
    if (!file) return;
    if (file.size > 500_000) {
      toast.error("Fichier trop volumineux (max ~500 Ko en local).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const payload = { name: file.name, dataUrl, mime: file.type || "application/octet-stream" };
      if (refId) {
        addAtt({ refType: "journal", refId, ...payload });
        toast.success("Pièce justificative jointe");
      } else {
        setPendingFile(payload);
        toast.message("PJ prête — liée à la prochaine écriture enregistrée.");
      }
    };
    reader.readAsDataURL(file);
  }

  function attsFor(lineId: string) {
    return attachments.filter((a) => a.refType === "journal" && a.refId === lineId);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Saisie"
        title="Brouillard"
        description="Une ligne = un mouvement débit/crédit. Tapez le n° de compte ou choisissez-le. Les modèles préremplissent le formulaire sans écrire tout seuls."
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setShowModels((v) => !v)}>
          {showModels ? "Masquer modèles" : "Modèles & récurrents"}
        </Button>
        <Button type="button" variant="secondary" disabled={!canWrite} onClick={saveAsTemplate}>
          Sauver le formulaire comme modèle
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm hover:bg-elevated">
          <Paperclip className="size-4" />
          {pendingFile ? `PJ : ${pendingFile.name}` : "Joindre PJ (prochaine écriture)"}
          <input type="file" className="hidden" accept="image/*,.pdf,.png,.jpg,.jpeg" onChange={(e) => onPickFile(e.target.files?.[0])} />
        </label>
      </div>

      {showModels ? (
        <Card className="mb-4 space-y-3 p-4">
          <Field label="Filtrer les modèles">
            <Input value={modelQ} onChange={(e) => setModelQ(e.target.value)} placeholder="achat, TVA, salaire…" />
          </Field>
          {models.user.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Vos modèles sauvegardés</p>
              <ul className="divide-y divide-border rounded-[10px] border border-border">
                {models.user.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted">{t.debit} → {t.credit} · {t.journal}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" onClick={() => applyModelToForm(t)}>Charger</Button>
                      <Button type="button" variant="secondary" onClick={() => { removeJournalTemplate(t.id); toast("Modèle supprimé"); }}>×</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Catalogue SYSCOHADA (à adapter puis enregistrer)</p>
            <ul className="max-h-64 divide-y divide-border overflow-auto rounded-[10px] border border-border">
              {models.catalog.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{e.label}</p>
                    <p className="text-xs text-muted">{e.debit} → {e.credit} · {e.journal}</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => applyModelToForm(e)}>Charger dans le formulaire</Button>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">Pour apprendre sans toucher au journal : <strong>IA &amp; Dictionnaire → Apprendre les écritures</strong>.</p>
        </Card>
      ) : null}

      <Card className="mb-6">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="N° pièce" hint={`Prochain auto : ${peek("PIECE_BROUILLARD")}`}>
            <Input value={form.piece} placeholder="laissé vide = n° auto" onChange={(e) => setForm({ ...form, piece: e.target.value })} />
          </Field>
          <Field label="Journal">
            <NativeSelect value={form.journal} onChange={(e) => setForm({ ...form, journal: e.target.value as JournalCode })}>
              {JOURNALS.map((j) => (<option key={j} value={j}>{j}</option>))}
            </NativeSelect>
          </Field>
          <Field label="Axe 1 (section)">
            <NativeSelect value={axe} onChange={(e) => setAxe(e.target.value)}>
              <option value="">— Aucun —</option>
              {axes.filter((a) => a.active).map((a) => (<option key={a.id} value={a.code}>{a.code} — {a.label}</option>))}
            </NativeSelect>
          </Field>
          <Field label="Axe 2 (projet)">
            <NativeSelect value={axe2} onChange={(e) => setAxe2(e.target.value)}>
              <option value="">— Aucun —</option>
              {axes.filter((a) => a.active).map((a) => (<option key={a.id} value={a.code}>{a.code} — {a.label}</option>))}
            </NativeSelect>
          </Field>
          <Field label="Compte débité (n° ou liste)">
            <AccountPicker value={form.debit} onChange={(debit) => setForm({ ...form, debit })} />
          </Field>
          <Field label="Compte crédité (n° ou liste)">
            <AccountPicker value={form.credit} onChange={(credit) => setForm({ ...form, credit })} />
          </Field>
          <Field label="Montant">
            <Input inputMode="decimal" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Libellé">
              <Input value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={!canWrite}>Enregistrer</Button>
          </div>
        </form>
      </Card>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Écritures ({journal.length})</h2>
        <Input className="max-w-xs" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
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
            {filtered.map((l) => {
              const atts = attsFor(l.id);
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(l.date)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.piece}</td>
                  <td className="px-3 py-2">{l.journal}</td>
                  <td className="px-3 py-2 font-mono text-xs" title={accountLabel(l.debit, custom)}>{l.debit}</td>
                  <td className="px-3 py-2 font-mono text-xs" title={accountLabel(l.credit, custom)}>{l.credit}</td>
                  <td className="px-3 py-2 max-w-[280px]">
                    <span className="truncate">{l.libelle}</span>
                    {atts.length > 0 ? <span className="ml-1 text-[10px] text-primary">📎{atts.length}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right"><Money value={l.amount} currency={currency} /></td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      {!l.locked && !l.reversedBy ? (
                        <button className="rounded-[8px] px-1.5 py-1 text-[10px] text-muted hover:bg-elevated" title="Verrouiller" type="button" onClick={() => { lockLine(l.id); toast.success("Écriture verrouillée"); }}>🔒</button>
                      ) : null}
                      {!l.reversedBy && !l.reversesId ? (
                        <button className="rounded-[8px] px-1.5 py-1 text-[10px] text-muted hover:bg-elevated" title="Contrepasser" type="button" onClick={() => { const err = reverse(l.id); if (err) toast.error(err); else toast.success("Contrepassation enregistrée"); }}>↺</button>
                      ) : (
                        <span className="text-[10px] text-muted">{l.reversesId ? "CP" : "⇄"}</span>
                      )}
                      <label className="cursor-pointer rounded-[8px] px-1.5 py-1 text-[10px] text-muted hover:bg-elevated" title="Joindre un fichier">
                        📎
                        <input type="file" className="hidden" accept="image/*,.pdf,.png,.jpg,.jpeg" onChange={(e) => onPickFile(e.target.files?.[0], l.id)} />
                      </label>
                      {atts.map((a) => (
                        <a key={a.id} href={a.dataUrl} download={a.name} className="max-w-[72px] truncate text-[10px] text-primary underline" title={a.name}>{a.name}</a>
                      ))}
                      {!l.locked && !l.reversedBy ? (
                        <button className="rounded-[8px] p-1.5 text-muted hover:bg-elevated hover:text-danger" onClick={() => { for (const a of atts) removeAtt(a.id); remove(l.id); toast("Ligne supprimée"); }} aria-label="Supprimer">
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="p-6 text-sm text-muted">Aucune écriture.</p> : null}
      </div>
    </div>
  );
}
