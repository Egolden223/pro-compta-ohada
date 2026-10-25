import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { docTotals } from "@/lib/engine";
import { Money } from "@/components/money";
import { Plus } from "lucide-react";
import type { Partner } from "@/lib/types";
import { countryByName } from "@/lib/countries";

const empty = (kind: Partner["kind"]): Omit<Partner, "id"> => ({
  kind,
  code: "",
  name: "",
  account: kind === "client" ? "411" : "401",
  contact: "",
  phone: "",
  email: "",
  address: "",
});

export function PartnersPage({ kind }: { kind: "client" | "fournisseur" }) {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const list = data.partners.filter((p) => p.kind === kind);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty(kind));
  const [editId, setEditId] = useState<string | null>(null);

  function save() {
    if (!form.name.trim()) {
      toast.error("Nom obligatoire.");
      return;
    }
    if (editId) data.updatePartner(editId, form);
    else data.addPartner(form);
    toast.success("Enregistré.");
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Tiers"
        title={kind === "client" ? "Clients" : "Fournisseurs"}
        description={
          kind === "client"
            ? "Les trois premiers clients reçoivent classiquement les sous-comptes 4111, 4112, 4113."
            : "Les trois premiers fournisseurs reçoivent classiquement les sous-comptes 4011, 4012, 4013."
        }
        actions={
          <Button
            onClick={() => {
              setEditId(null);
              setForm({
                ...empty(kind),
                code: String(list.length + 1).padStart(3, "0"),
                account: kind === "client" ? `411${Math.min(list.length + 1, 3)}` : `401${Math.min(list.length + 1, 3)}`,
              });
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Ajouter
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => {
          const docs = data.documents.filter((d) => d.partnerId === p.id);
          const facture = docs.filter((d) => d.type === (kind === "client" ? "FACTURE" : "BON_CMD"));
          const ttc = facture.reduce((s, d) => s + docTotals(d).ttc, 0);
          const paid = facture.reduce((s, d) => s + d.paid, 0);
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted">
                    {p.code} · {p.account}
                  </p>
                  <h2 className="font-display text-lg">{p.name}</h2>
                  <p className="text-sm text-muted">
                    {p.contact}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </p>
                  <p className="text-sm text-subtle">{p.address}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditId(p.id);
                    setForm(p);
                    setOpen(true);
                  }}
                >
                  Éditer
                </Button>
              </div>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-muted">Facturé</span>
                <Money value={ttc} currency={currency} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Reste</span>
                <Money value={Math.max(0, ttc - paid)} currency={currency} />
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editId ? "Modifier" : "Nouveau"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Sous-compte">
              <Input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Raison sociale">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <Field label="Contact">
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </Field>
            <Field label="Téléphone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Adresse">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            {editId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  data.removePartner(editId);
                  setOpen(false);
                }}
              >
                Supprimer
              </Button>
            ) : null}
            <Button onClick={save}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
