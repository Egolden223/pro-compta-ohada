import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { docTotals } from "@/lib/engine";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/utils";
import type { DocLine, DocStatus, DocType, Document } from "@/lib/types";
import { countryByName } from "@/lib/countries";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";


function printNormalizedInvoice(
  doc: import("@/lib/types").Document,
  settings: import("@/lib/types").Settings,
  partnerName: string,
  currency: string,
) {
  const ht = doc.lines.reduce((a, l) => a + l.qty * l.pu * (1 - (l.remise || 0) / 100), 0);
  const tva = doc.lines.reduce(
    (a, l) => a + l.qty * l.pu * (1 - (l.remise || 0) / 100) * ((l.tva || 0) / 100),
    0,
  );
  const ttc = Math.round(ht + tva);
  const payload = [settings.ifu || "IFU-?", doc.number, doc.date, String(ttc), settings.companyName].join("|");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" + encodeURIComponent(payload);
  const rows = doc.lines
    .map((l) => {
      const m = Math.round(l.qty * l.pu * (1 - (l.remise || 0) / 100));
      return `<tr><td>${l.designation}</td><td class="r">${l.qty}</td><td class="r">${l.pu.toLocaleString("fr-FR")}</td><td class="r">${l.tva || 0}</td><td class="r">${m.toLocaleString("fr-FR")}</td></tr>`;
    })
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${doc.number}</title>
<style>body{font-family:system-ui;padding:24px;max-width:720px;margin:auto}h1{font-size:18px}.meta{font-size:12px;color:#444}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border-bottom:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left}.r{text-align:right}.qr{float:right}.footer{clear:both;margin-top:24px;font-size:11px;color:#666}</style></head>
<body>
<img class="qr" src="${qrUrl}" width="120" height="120" alt="QR"/>
<h1>FACTURE NORMALISÉE</h1>
<p class="meta"><strong>${settings.companyName}</strong><br/>${settings.address || ""}<br/>
IFU/NIU : ${settings.ifu || "—"} · RCCM : ${settings.rccm || "—"} · ${settings.country}</p>
<p class="meta">N° <strong>${doc.number}</strong> · Date ${doc.date}<br/>Client : ${partnerName}</p>
<table><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">PU</th><th class="r">TVA%</th><th class="r">Montant</th></tr></thead><tbody>${rows}</tbody></table>
<p class="r"><strong>HT</strong> ${Math.round(ht).toLocaleString("fr-FR")} ${currency}<br/>
<strong>TVA</strong> ${Math.round(tva).toLocaleString("fr-FR")}<br/>
<strong>TTC</strong> ${ttc.toLocaleString("fr-FR")} ${currency}</p>
<p class="footer">PRO COMPTA OHADA — QR = IFU|N°|date|TTC|raison sociale (préparation certification DGI).</p>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.print();
  }
}


const TYPES: { id: DocType | "ALL"; label: string }[] = [
  { id: "ALL", label: "Tous" },
  { id: "DEVIS", label: "Devis" },
  { id: "FACTURE", label: "Factures" },
  { id: "AVOIR", label: "Avoirs" },
  { id: "RECU", label: "Reçus" },
  { id: "BON_CMD", label: "Commandes" },
];

const STATUSES: DocStatus[] = [
  "Brouillon",
  "Envoyée",
  "Payée part.",
  "Payée",
  "Converti en facture",
  "Annulée",
];

function emptyLines(): DocLine[] {
  return [{ designation: "", qty: 1, unitPrice: 0, vatRate: 0.18 }];
}

export function DocumentsPage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const vatDefault = countryByName(data.settings.country).vat;
  const [tab, setTab] = useState<DocType | "ALL">("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);

  const list = useMemo(() => {
    return data.documents
      .filter((d) => tab === "ALL" || d.type === tab)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.documents, tab]);

  function openNew(type: DocType = "FACTURE") {
    const kind = type === "BON_CMD" ? "fournisseur" : "client";
    const partner = data.partners.find((p) => p.kind === kind);
    setEditing({
      id: "",
      type,
      number: "",
      date: todayISO(),
      partnerId: partner?.id ?? "",
      lines: emptyLines().map((l) => ({ ...l, vatRate: vatDefault })),
      paid: 0,
      status: "Brouillon",
      paymentMode: "",
      linkedDoc: "",
      notes: "",
      currency,
      fxRate: 1,
      saleAccount: type === "BON_CMD" ? "601" : "701",
      posted: false,
      validityDays: 30,
      motif: "",
    });
    setOpen(true);
  }

  function save() {
    if (!editing) return;
    if (!editing.partnerId) {
      toast.error("Choisissez un partenaire.");
      return;
    }
    if (editing.id) {
      data.updateDocument(editing.id, editing);
      toast.success("Document mis à jour.");
    } else {
      data.addDocument(editing);
      toast.success("Document créé.");
    }
    setOpen(false);
    setEditing(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Commercial"
        title="Registre des documents"
        description="Devis, factures, avoirs, reçus et bons de commande. Convertissez un devis, imprimez, puis transférez l’écriture au brouillard."
        actions={
          <Button onClick={() => openNew(tab === "ALL" ? "FACTURE" : tab)}>
            <Plus className="size-4" /> Nouveau
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-9 rounded-full px-3 text-sm",
              tab === t.id ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">N°</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Partenaire</th>
              <th className="px-3 py-2 text-right font-medium">TTC</th>
              <th className="px-3 py-2 text-right font-medium">Payé</th>
              <th className="px-3 py-2 text-right font-medium">Reste</th>
              <th className="px-3 py-2 text-left font-medium">Statut</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((d) => {
              const tot = docTotals(d);
              const partner = data.partners.find((p) => p.id === d.partnerId);
              return (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{d.number}</td>
                  <td className="px-3 py-2">{d.type}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(d.date)}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate">{partner?.name}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={tot.ttc} currency={d.currency} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={d.paid} currency={d.currency} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={tot.reste} currency={d.currency} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      tone={
                        d.status === "Payée"
                          ? "ok"
                          : d.status === "Envoyée" || d.status === "Payée part."
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {d.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}>
                        Éditer
                      </Button>
                      <Link
                        to="/documents/$id"
                        params={{ id: d.id }}
                        className="inline-flex h-9 items-center rounded-[8px] px-3 text-sm text-muted hover:bg-elevated hover:text-fg"
                      >
                        Imprimer
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 ? <p className="p-6 text-sm text-muted">Aucun document.</p> : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editing?.id ? `Éditer ${editing.number}` : "Nouveau document"} className="max-w-3xl">
          {editing ? (
            <Editor
              doc={editing}
              setDoc={setEditing}
              onSave={save}
              onDelete={() => {
                if (editing.id) {
                  data.removeDocument(editing.id);
                  toast("Document supprimé");
                }
                setOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Editor({
  doc,
  setDoc,
  onSave,
  onDelete,
}: {
  doc: Document;
  setDoc: (d: Document) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const data = useAppStore();
  const tot = docTotals(doc);
  const partners = data.partners.filter((p) =>
    doc.type === "BON_CMD" ? p.kind === "fournisseur" : p.kind === "client",
  );

  function setLine(i: number, patch: Partial<DocLine>) {
    const lines = doc.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    setDoc({ ...doc, lines });
  }

  function pickArticle(i: number, articleId: string) {
    const a = data.articles.find((x) => x.id === articleId);
    if (!a) return setLine(i, { articleId });
    setLine(i, {
      articleId,
      designation: a.designation,
      unitPrice: doc.type === "BON_CMD" ? a.purchasePrice : a.salePrice,
      vatRate: a.vatRate,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type">
          <NativeSelect
            value={doc.type}
            onChange={(e) => setDoc({ ...doc, type: e.target.value as DocType })}
            disabled={Boolean(doc.id)}
          >
            {TYPES.filter((t) => t.id !== "ALL").map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date">
          <Input type="date" value={doc.date} onChange={(e) => setDoc({ ...doc, date: e.target.value })} />
        </Field>
        <Field label="Statut">
          <NativeSelect
            value={doc.status}
            onChange={(e) => setDoc({ ...doc, status: e.target.value as DocStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Partenaire">
          <NativeSelect
            value={doc.partnerId}
            onChange={(e) => setDoc({ ...doc, partnerId: e.target.value })}
          >
            <option value="">—</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Compte vente / achat">
          <Input value={doc.saleAccount} onChange={(e) => setDoc({ ...doc, saleAccount: e.target.value })} />
        </Field>
        <Field label="Payé">
          <Input
            inputMode="decimal"
            value={doc.paid || ""}
            onChange={(e) => setDoc({ ...doc, paid: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Mode de paiement">
          <Input value={doc.paymentMode} onChange={(e) => setDoc({ ...doc, paymentMode: e.target.value })} />
        </Field>
        {doc.type === "BON_CMD" ? (
          <Field label="Marchandises reçues">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!doc.goodsReceived}
                onChange={(e) => setDoc({ ...doc, goodsReceived: e.target.checked })}
              />
              Oui — autorise l&apos;écriture d&apos;achat (601 / 401)
            </label>
          </Field>
        ) : null}
        {doc.type === "FACTURE" ? (
          <Field label="Date d&apos;échéance">
            <Input
              type="date"
              value={doc.dueDate || ""}
              onChange={(e) => setDoc({ ...doc, dueDate: e.target.value })}
            />
          </Field>
        ) : null}
        {(doc.type === "FACTURE" || doc.type === "BON_CMD") ? (
          <Field label="RAS % (ex. 5 pour 5 %)">
            <Input
              type="number"
              step="0.1"
              value={(doc.rasRate || 0) * 100}
              onChange={(e) =>
                setDoc({ ...doc, rasRate: (Number(e.target.value) || 0) / 100 })
              }
            />
          </Field>
        ) : null}
        <Field label="Document lié">
          <Input value={doc.linkedDoc} onChange={(e) => setDoc({ ...doc, linkedDoc: e.target.value })} />
        </Field>
        <Field label="Motif (avoir)">
          <Input value={doc.motif} onChange={(e) => setDoc({ ...doc, motif: e.target.value })} />
        </Field>
      </div>

      {doc.type !== "RECU" ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Lignes</p>
          <div className="space-y-2">
            {doc.lines.map((l, i) => (
              <div key={i} className="grid gap-2 rounded-[12px] border border-border bg-elevated/40 p-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <NativeSelect value={l.articleId ?? ""} onChange={(e) => pickArticle(i, e.target.value)}>
                    <option value="">Libre…</option>
                    {data.articles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.ref} — {a.designation}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="sm:col-span-3">
                  <Input
                    placeholder="Désignation"
                    value={l.designation}
                    onChange={(e) => setLine(i, { designation: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-1">
                  <Input
                    inputMode="decimal"
                    value={l.qty}
                    onChange={(e) => setLine(i, { qty: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    inputMode="decimal"
                    value={l.unitPrice}
                    onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:col-span-2">
                  <span className="font-mono text-sm">
                    <Money value={Math.round(l.qty * l.unitPrice)} currency={doc.currency} />
                  </span>
                  <button
                    className="rounded-[8px] p-1.5 text-muted hover:text-danger"
                    onClick={() => setDoc({ ...doc, lines: doc.lines.filter((_, j) => j !== i) })}
                    aria-label="Retirer la ligne"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() =>
              setDoc({
                ...doc,
                lines: [...doc.lines, { designation: "", qty: 1, unitPrice: 0, vatRate: countryByName(data.settings.country).vat }],
              })
            }
          >
            <Plus className="size-4" /> Ligne
          </Button>
        </div>
      ) : null}

      <Field label="Notes">
        <Textarea value={doc.notes} onChange={(e) => setDoc({ ...doc, notes: e.target.value })} />
      </Field>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-[16px] bg-elevated px-4 py-3">
        <div className="text-sm">
          <p>
            HT <Money value={tot.ht} currency={doc.currency} />
          </p>
          <p>
            TVA <Money value={tot.tva} currency={doc.currency} />
          </p>
          <p className="font-medium">
            TTC <Money value={tot.ttc} currency={doc.currency} /> · reste{" "}
            <Money value={tot.reste} currency={doc.currency} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {doc.id && doc.type === "DEVIS" && doc.status !== "Converti en facture" ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                const nid = data.convertQuote(doc.id);
                toast.success(nid ? "Devis converti en facture." : "Conversion impossible.");
              }}
            >
              Convertir en facture
            </Button>
          ) : null}
          {doc.id && !doc.posted && doc.type !== "DEVIS" ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                const err = data.postDocument(doc.id);
                if (err) toast.error(err);
                else toast.success("Écriture copiée dans le brouillard.");
              }}
            >
              Vers le brouillard
            </Button>
          ) : null}
          {doc.type === "FACTURE" && doc.id ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const p = data.partners.find((x) => x.id === doc.partnerId);
                printNormalizedInvoice(
                  doc,
                  data.settings,
                  p?.name || "Client",
                  currency,
                );
              }}
            >
              Facture normalisée (QR)
            </Button>
          ) : null}
          {doc.id && doc.posted ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                const err = data.unpostDocument(doc.id);
                if (err) toast.error(err);
                else toast.success("Écritures annulées — document re-modifiable.");
              }}
            >
              Annuler transfert
            </Button>
          ) : null}
          {doc.id && doc.type === "FACTURE" ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                const n = data.stockOutFromInvoice(doc.id);
                toast.success(`${n} sortie(s) de stock.`);
              }}
            >
              Sorties stock
            </Button>
          ) : null}
          {doc.id ? (
            <Button variant="ghost" type="button" onClick={onDelete}>
              Supprimer
            </Button>
          ) : null}
          <Button type="button" onClick={onSave}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
