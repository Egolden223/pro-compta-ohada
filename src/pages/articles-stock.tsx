import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money, Qty } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { stockOf } from "@/lib/engine";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/utils";
import type { Article } from "@/lib/types";
import { countryByName } from "@/lib/countries";
import { Plus } from "lucide-react";

const emptyArt = (): Omit<Article, "id"> => ({
  ref: "",
  designation: "",
  unit: "U",
  salePrice: 0,
  purchasePrice: 0,
  vatRate: 0.18,
  notes: "",
  stockInitial: 0,
  alertMin: 0,
});

export function ArticlesPage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyArt());
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Articles et services"
        description="Les prix HT alimentent automatiquement devis, factures et commandes."
        actions={
          <Button
            onClick={() => {
              setEditId(null);
              setForm({ ...emptyArt(), vatRate: countryByName(data.settings.country).vat, ref: `ART-${String(data.articles.length + 1).padStart(3, "0")}` });
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Article
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Réf.</th>
              <th className="px-3 py-2 text-left font-medium">Désignation</th>
              <th className="px-3 py-2 text-left font-medium">Unité</th>
              <th className="px-3 py-2 text-right font-medium">PV HT</th>
              <th className="px-3 py-2 text-right font-medium">PA HT</th>
              <th className="px-3 py-2 text-right font-medium">TVA</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.articles.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{a.ref}</td>
                <td className="px-3 py-2">{a.designation}</td>
                <td className="px-3 py-2">{a.unit}</td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.salePrice} currency={currency} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.purchasePrice} currency={currency} />
                </td>
                <td className="px-3 py-2 text-right">{Math.round(a.vatRate * 100)} %</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditId(a.id);
                      setForm(a);
                      setOpen(true);
                    }}
                  >
                    Éditer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editId ? "Modifier l'article" : "Nouvel article"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Référence">
              <Input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
            </Field>
            <Field label="Unité">
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Désignation">
                <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
              </Field>
            </div>
            <Field label="Prix de vente HT">
              <Input
                inputMode="decimal"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Prix d'achat HT">
              <Input
                inputMode="decimal"
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Stock initial">
              <Input
                inputMode="decimal"
                value={form.stockInitial}
                onChange={(e) => setForm({ ...form, stockInitial: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Seuil d'alerte">
              <Input
                inputMode="decimal"
                value={form.alertMin}
                onChange={(e) => setForm({ ...form, alertMin: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            {editId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  data.removeArticle(editId);
                  setOpen(false);
                }}
              >
                Supprimer
              </Button>
            ) : null}
            <Button
              onClick={() => {
                if (!form.designation) return toast.error("Désignation obligatoire.");
                if (editId) data.updateArticle(editId, form);
                else data.addArticle(form);
                toast.success("Article enregistré.");
                setOpen(false);
              }}
            >
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StockPage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const [articleId, setArticleId] = useState(data.articles[0]?.id ?? "");
  const [type, setType] = useState<"ENTREE" | "SORTIE">("ENTREE");
  const [qty, setQty] = useState(0);
  const [piece, setPiece] = useState("");
  const [libelle, setLibelle] = useState("");
  const total = data.articles.reduce((s, a) => s + stockOf(a, data.stockMoves).value, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Inventaire"
        title="Stock"
        description="Soldes calculés : stock initial + entrées − sorties. Les services (PA = 0) n’entrent pas en valeur."
      />
      <Card className="mb-6">
        <h2 className="font-display text-lg">Nouveau mouvement</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            const art = data.articles.find((a) => a.id === articleId);
            if (!art || qty <= 0) return toast.error("Article et quantité requis.");
            data.addStockMove({
              articleId,
              date: todayISO(),
              type,
              qtyIn: type === "ENTREE" ? qty : 0,
              qtyOut: type === "SORTIE" ? qty : 0,
              piece,
              libelle: libelle || (type === "ENTREE" ? "Entrée" : "Sortie"),
              pu: art.purchasePrice,
            });
            toast.success("Mouvement enregistré.");
            setQty(0);
            setLibelle("");
          }}
        >
          <NativeSelect value={articleId} onChange={(e) => setArticleId(e.target.value)}>
            {data.articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ref} — {a.designation}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={type} onChange={(e) => setType(e.target.value as "ENTREE" | "SORTIE")}>
            <option value="ENTREE">Entrée</option>
            <option value="SORTIE">Sortie</option>
          </NativeSelect>
          <Input
            inputMode="decimal"
            placeholder="Qté"
            value={qty || ""}
            onChange={(e) => setQty(Number(e.target.value) || 0)}
          />
          <Input placeholder="N° pièce" value={piece} onChange={(e) => setPiece(e.target.value)} />
          <Button type="submit">Ajouter</Button>
        </form>
      </Card>

      <p className="mb-3 text-sm text-muted">
        Valeur totale du stock : <Money value={total} currency={currency} />
      </p>
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Article</th>
              <th className="px-3 py-2 text-right font-medium">Initial</th>
              <th className="px-3 py-2 text-right font-medium">Entrées</th>
              <th className="px-3 py-2 text-right font-medium">Sorties</th>
              <th className="px-3 py-2 text-right font-medium">Stock</th>
              <th className="px-3 py-2 text-right font-medium">Valeur</th>
              <th className="px-3 py-2 text-left font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {data.articles.map((a) => {
              const st = stockOf(a, data.stockMoves);
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {a.ref} · {a.designation}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Qty value={a.stockInitial} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Qty value={st.entries} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Qty value={st.exits} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Qty value={st.qty} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={st.value} currency={currency} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={st.status === "OK" ? "ok" : st.status === "ALERTE" ? "warn" : "danger"}>
                      {st.status}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg">Journal des mouvements</h2>
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Article</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-right font-medium">Qté</th>
              <th className="px-3 py-2 text-left font-medium">Pièce</th>
              <th className="px-3 py-2 text-left font-medium">Libellé</th>
            </tr>
          </thead>
          <tbody>
            {[...data.stockMoves].reverse().map((m) => {
              const a = data.articles.find((x) => x.id === m.articleId);
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDate(m.date)}</td>
                  <td className="px-3 py-2">{a?.designation}</td>
                  <td className="px-3 py-2">{m.type}</td>
                  <td className="px-3 py-2 text-right">
                    <Qty value={m.qtyIn || m.qtyOut} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{m.piece}</td>
                  <td className="px-3 py-2">{m.libelle}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
