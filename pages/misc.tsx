import { useState } from "react";
import { useRef } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore, exportBackup } from "@/lib/store";
import { agingBuckets, docTotals, relanceLevel } from "@/lib/engine";
import { daysUntil, formatDate } from "@/lib/format";
import { PLAN_COMPTABLE, allAccounts } from "@/lib/accounts";
import { COUNTRIES, countryByName } from "@/lib/countries";
import type { AppData, Lang } from "@/lib/types";

export function RelancesPage() {
  const data = useAppStore();
  const tax = countryByName(data.settings.country);
  const rows = data.documents
    .filter((d) => d.type === "FACTURE")
    .map((d) => {
      const tot = docTotals(d);
      const late = Math.max(0, -daysUntil(d.date));
      return { d, tot, late, level: relanceLevel(late, data.relanceDelays) };
    })
    .filter((x) => x.tot.reste > 0)
    .sort((a, b) => b.late - a.late);
  const buckets = agingBuckets(data.documents);

  return (
    <div>
      <PageHeader
        eyebrow="Recouvrement"
        title="Relances clients"
        description="Factures non soldées, ancienneté et niveau de relance (7 / 15 / 30 jours)."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([
          ["0-30 j", buckets.d0],
          ["31-60 j", buckets.d30],
          ["61-90 j", buckets.d60],
          ["91-120 j", buckets.d90],
          ["120 j +", buckets.d90p],
        ] as const).map(([label, value]) => (
          <Card key={label} className="p-3">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 font-display text-lg">
              <Money value={value} currency={tax.currency} />
            </p>
          </Card>
        ))}
      </div>
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Facture</th>
              <th className="px-3 py-2 text-left font-medium">Client</th>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-right font-medium">Reste</th>
              <th className="px-3 py-2 text-right font-medium">Jours</th>
              <th className="px-3 py-2 text-left font-medium">Niveau</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, tot, late, level }) => {
              const p = data.partners.find((x) => x.id === d.partnerId);
              return (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{d.number}</td>
                  <td className="px-3 py-2">{p?.name}</td>
                  <td className="px-3 py-2">{formatDate(d.date)}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={tot.reste} currency={tax.currency} />
                  </td>
                  <td className="px-3 py-2 text-right">{late}</td>
                  <td className="px-3 py-2">
                    <Badge tone={level === "Mise en demeure" ? "danger" : level === "À jour" ? "ok" : "warn"}>
                      {level}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-6 text-sm text-muted">Aucune créance ouverte.</p> : null}
      </div>
      {rows[0] ? (
        <Card className="mt-6 max-w-2xl">
          <h2 className="font-display text-lg">Lettre type</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
            {`Objet : Relance — facture ${rows[0].d.number}

Madame, Monsieur,

Sauf erreur ou omission de notre part, la facture ${rows[0].d.number} du ${formatDate(rows[0].d.date)} reste due à hauteur de ${rows[0].tot.reste.toLocaleString("fr-FR")} ${tax.currency}.

Nous vous remercions de bien vouloir régulariser cette situation dans les meilleurs délais.

Cordialement,
${data.settings.companyName}`}
          </p>
        </Card>
      ) : null}
    </div>
  );
}

export function ParametresPage() {
  const data = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const s = data.settings;
  const tax = countryByName(s.country);

  function download() {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pro-compta-ohada.json";
    a.click();
    URL.revokeObjectURL(url);
    data.markBackedUp();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Référentiel"
        title="Paramètres"
        description="Identité, pays (taux auto), exercice. Les données vivent dans cet appareil — exportez une copie de sauvegarde."
      />
      <Card className="max-w-3xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Raison sociale">
            <Input value={s.companyName} onChange={(e) => data.updateSettings({ companyName: e.target.value })} />
          </Field>
          <Field label="Sigle">
            <Input value={s.sigle} onChange={(e) => data.updateSettings({ sigle: e.target.value })} />
          </Field>
          <Field label="Forme juridique">
            <Input value={s.legalForm} onChange={(e) => data.updateSettings({ legalForm: e.target.value })} />
          </Field>
          <Field label="Pays">
            <NativeSelect
              value={s.country}
              onChange={(e) => data.updateSettings({ country: e.target.value })}
            >
              {COUNTRIES.map((c) => (
                <option key={c.country}>{c.country}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="RCCM">
            <Input value={s.rccm} onChange={(e) => data.updateSettings({ rccm: e.target.value })} />
          </Field>
          <Field label="IFU / NIF">
            <Input value={s.nif} onChange={(e) => data.updateSettings({ nif: e.target.value })} />
          </Field>
          <Field label="Adresse">
            <Input value={s.address} onChange={(e) => data.updateSettings({ address: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <Input value={s.phone} onChange={(e) => data.updateSettings({ phone: e.target.value })} />
          </Field>
          <Field label="Début d'exercice">
            <Input type="date" value={s.fyStart} onChange={(e) => data.updateSettings({ fyStart: e.target.value })} />
          </Field>
          <Field label="Fin d'exercice">
            <Input type="date" value={s.fyEnd} onChange={(e) => data.updateSettings({ fyEnd: e.target.value })} />
          </Field>
          <Field label="Langue">
            <NativeSelect
              value={s.lang}
              onChange={(e) => data.updateSettings({ lang: e.target.value as Lang })}
            >
              <option value="FR">Français</option>
              <option value="EN">English</option>
            </NativeSelect>
          </Field>
        </div>
        <p className="mt-4 text-sm text-muted">
          {tax.zone} · {tax.currency} · TVA {Math.round(tax.vat * 100)} % · IS {Math.round(tax.isRate * 1000) / 10} % ·{" "}
          {tax.reliability}
        </p>
      </Card>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={download}>Exporter la sauvegarde</Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Importer une sauvegarde
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm("Réinitialiser les données de démonstration ?")) {
              data.resetDemo();
              toast.success("Jeu d’exemple restauré.");
            }
          }}
        >
          Restaurer l’exemple
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const json = JSON.parse(await f.text()) as AppData;
              if (json.version !== 1 || !json.journal) throw new Error("format");
              data.importData(json);
              toast.success("Sauvegarde importée.");
            } catch {
              toast.error("Fichier invalide.");
            }
          }}
        />
      </div>
    </div>
  );
}

export function PlanPage() {
  const custom = useAppStore((s) => s.customAccounts) || [];
  const addCustom = useAppStore((s) => s.addCustomAccount);
  const removeCustom = useAppStore((s) => s.removeCustomAccount);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [parent, setParent] = useState("521");
  const accounts = allAccounts(custom);
  const classes = [...new Set(accounts.map((a) => a.classe))].sort();

  function createSub() {
    const c = code.trim();
    if (!c || c.length < 3) {
      toast.error("Indiquez un code de sous-compte (ex. 5211, 5712, 3111).");
      return;
    }
    const err = addCustom({
      code: c,
      label: label.trim() || `Sous-compte ${c}`,
      classe: c[0] || "5",
      categorie: "Sous-compte utilisateur",
      parentCode: parent || undefined,
      active: true,
    });
    if (err) toast.error(err);
    else {
      toast.success(`Sous-compte ${c} créé`);
      setCode("");
      setLabel("");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="SYSCOHADA"
        title="Plan comptable"
        description="Plan normal révisé + sous-comptes (banques, caisses, stocks…). Utilisés par le brouillard, la balance et les états."
      />
      <Card className="mb-6 space-y-3 p-4">
        <h2 className="font-display text-lg">Créer un sous-compte</h2>
        <p className="text-xs text-muted">
          Exemples : 5211 Banque BOA, 5212 Banque Ecobank, 5711 Caisse siège, 5712 Caisse annexe, 3111 Stock magasin A…
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="5211" />
          </Field>
          <Field label="Libellé">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Banque BOA" />
          </Field>
          <Field label="Compte parent (indicatif)">
            <Input value={parent} onChange={(e) => setParent(e.target.value)} placeholder="521" />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={createSub}>Ajouter</Button>
          </div>
        </div>
        {custom.length > 0 ? (
          <ul className="mt-2 divide-y divide-border rounded-[10px] border border-border text-sm">
            {custom.map((a) => (
              <li key={a.code} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-mono text-xs">{a.code}</span> — {a.label}
                </span>
                <Button type="button" variant="secondary" onClick={() => { removeCustom(a.code); toast("Sous-compte retiré"); }}>
                  Supprimer
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      {classes.map((cl) => (
        <section key={cl} className="mb-8">
          <h2 className="mb-3 font-display text-xl">Classe {cl}</h2>
          <div className="overflow-hidden rounded-[16px] border border-border">
            <table className="w-full text-sm">
              <tbody>
                {accounts
                  .filter((a) => a.classe === cl)
                  .map((a) => (
                    <tr key={a.code} className="border-t border-border first:border-0">
                      <td className="w-24 px-3 py-2 font-mono text-xs">{a.code}</td>
                      <td className="px-3 py-2">{a.label}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted">{a.categorie}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export function GuidePage() {
  const data = useAppStore();
  return (
    <div>
      <PageHeader
        eyebrow="Aide"
        title="Guide d’utilisation"
        description="PRO COMPTA OHADA reprend le classeur Excel v6 : saisie unique au brouillard, états SYSCOHADA, module commercial, stock, banque, fiscalité des 17 États, paie et amortissements."
      />
      <div className="grid max-w-3xl gap-4">
        {[
          ["1. Paramètres", "Choisissez le pays : TVA, IS et délais se mettent à jour. Renseignez l’identité et l’exercice."],
          ["2. Partenaires et articles", "Créez clients, fournisseurs et le catalogue. Les prix et sous-comptes alimentent les documents."],
          ["3. Documents", "Établissez un devis, convertissez-le en facture, enregistrez un reçu. Imprimez depuis la fiche."],
          ["4. Brouillard", "Saisissez les opérations quotidiennes (débit / crédit). Ou transférez automatiquement depuis une facture."],
          ["5. États", "Journal, grand livre, balance, compte de résultat et bilan se recalculent en permanence."],
          ["6. Hors ligne", "L’application s’installe sur l’écran d’accueil. Toutes les données restent dans cet appareil. Exportez une sauvegarde JSON."],
        ].map(([t, b]) => (
          <Card key={t}>
            <h2 className="font-display text-lg">{t}</h2>
            <p className="mt-2 text-sm text-muted">{b}</p>
          </Card>
        ))}
        <Card>
          <h2 className="font-display text-lg">Principe du débit / crédit</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Loyer en espèces — Débit 622 / Crédit 571</li>
            <li>Vente au comptant — Débit 571 ou 521 / Crédit 701</li>
            <li>Achat à crédit — Débit 601 / Crédit 401, plus TVA 4452</li>
            <li>Règlement fournisseur — Débit 401 / Crédit 521</li>
          </ul>
        </Card>
      </div>
    
      <Card className="mt-4 p-4">
        <h2 className="mb-2 font-display text-lg">Stocks</h2>
        <Field label="Méthode de valorisation">
          <NativeSelect
            value={data.settings.stockMethod || "CUMP"}
            onChange={(e) =>
              data.updateSettings({ stockMethod: e.target.value as "CUMP" | "FIFO" })
            }
          >
            <option value="CUMP">CUMP (coût unitaire moyen pondéré)</option>
            <option value="FIFO">FIFO (premier entré, premier sorti)</option>
          </NativeSelect>
        </Field>
        <p className="mt-2 text-xs text-muted">
          Utilisé pour le calcul du CMV (6031) lors du transfert des factures.
        </p>
      </Card>
      <Card className="mt-4 p-4">
        <h2 className="mb-2 font-display text-lg">Référentiel & identification</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Système comptable">
            <NativeSelect
              value={data.settings.accountingSystem || "NORMAL"}
              onChange={(e) =>
                data.updateSettings({
                  accountingSystem: e.target.value as "SMT" | "ALLEGE" | "NORMAL",
                })
              }
            >
              <option value="SMT">SMT — Minimal de trésorerie</option>
              <option value="ALLEGE">Système allégé</option>
              <option value="NORMAL">Système normal</option>
            </NativeSelect>
          </Field>
          <Field label="Profil d&apos;entité">
            <NativeSelect
              value={data.settings.entityProfile || "SYSCOHADA"}
              onChange={(e) =>
                data.updateSettings({
                  entityProfile: e.target.value as "SYSCOHADA" | "SYCEBNL",
                })
              }
            >
              <option value="SYSCOHADA">SYSCOHADA (entreprise)</option>
              <option value="SYCEBNL">SYCEBNL (association / ONG)</option>
            </NativeSelect>
          </Field>
          <Field label="IFU / NIU">
            <Input
              value={data.settings.ifu || ""}
              onChange={(e) => data.updateSettings({ ifu: e.target.value })}
              placeholder="Identifiant fiscal unique"
            />
          </Field>
          <Field label="RCCM">
            <Input
              value={data.settings.rccm || ""}
              onChange={(e) => data.updateSettings({ rccm: e.target.value })}
            />
          </Field>
        </div>
      </Card>
      <Card className="mt-4 p-4">
        <h2 className="mb-2 font-display text-lg">Utilisateurs & droits (local)</h2>
        <p className="mb-2 text-xs text-muted">
          Profils locaux type Sage : admin, comptable, saisie, lecture. Pas de multi-poste temps réel.
        </p>
        <ul className="mb-3 space-y-1 text-sm">
          {(data.users || []).map((u) => (
            <li key={u.id} className="flex justify-between gap-2">
              <button
                type="button"
                className={data.currentUserId === u.id ? "font-semibold text-primary" : ""}
                onClick={() => data.setCurrentUser(u.id)}
              >
                {u.name} ({u.role})
                {data.currentUserId === u.id ? " ✓" : ""}
              </button>
              {u.id !== "u1" ? (
                <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => data.removeUser(u.id)}>
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            data.addUser({ name: "Nouvel utilisateur", role: "saisie" });
            toast.success("Utilisateur ajouté");
          }}
        >
          Ajouter un utilisateur
        </Button>
      </Card>


</div>
  );
}
