import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { countryByName } from "@/lib/countries";
import { buildNotesAnnexes, depreciateComponent, purchaseCost, firstApplicationEntries, consolidateD4C } from "@/lib/engine";
import { uid } from "@/lib/utils";
import type { AssetComponent, RetirementProvision } from "@/lib/types";

export function AnnexesPage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const notes = buildNotesAnnexes({
    journal: data.journal,
    settings: data.settings,
    annexNotes: data.annexNotes,
    assetComponents: data.assetComponents,
    retirementProvisions: data.retirementProvisions,
  });

  const [comp, setComp] = useState({
    assetId: "imm-1",
    label: "",
    cost: 0,
    residualValue: 0,
    usefulLifeYears: 5,
  });
  const [ret, setRet] = useState({ label: "Engagements de retraite", amount: 0, method: "simplifiee" as const });
  const [accPrice, setAccPrice] = useState(0);
  const [accFees, setAccFees] = useState(0);

  function addComponent() {
    if (!comp.label || comp.cost <= 0) {
      toast.error("Libellé et coût requis");
      return;
    }
    const item: AssetComponent = {
      id: uid(),
      assetId: comp.assetId,
      label: comp.label,
      cost: comp.cost,
      residualValue: comp.residualValue,
      usefulLifeYears: comp.usefulLifeYears,
      method: "lineaire",
      accumulatedDep: 0,
    };
    data.setAssetComponents([...(data.assetComponents || []), item]);
    toast.success("Composant ajouté");
    setComp({ ...comp, label: "", cost: 0 });
  }

  function runDepAll() {
    const next = (data.assetComponents || []).map((c) => {
      const d = depreciateComponent(c, 1);
      return { ...c, accumulatedDep: c.accumulatedDep + d };
    });
    data.setAssetComponents(next);
    toast.success("Dotations composants calculées (1 an)");
  }

  function addRetirement() {
    if (ret.amount <= 0) {
      toast.error("Montant requis");
      return;
    }
    const item: RetirementProvision = {
      id: uid(),
      label: ret.label,
      amount: ret.amount,
      method: ret.method,
      booked: false,
    };
    data.setRetirementProvisions([...(data.retirementProvisions || []), item]);
    toast.success("Engagement retraite enregistré (note)");
  }

  function bookRetirement(id: string) {
    const next = (data.retirementProvisions || []).map((r) =>
      r.id === id ? { ...r, booked: true } : r,
    );
    data.setRetirementProvisions(next);
    // Écriture : 691 / 196
    const r = next.find((x) => x.id === id);
    if (r) {
      data.addJournalLines([
        {
          id: uid(),
          date: new Date().toISOString().slice(0, 10),
          piece: "RET-PROV",
          libelle: `Provision retraite — ${r.label}`,
          debit: "691",
          credit: "196",
          amount: r.amount,
        },
      ]);
      toast.success("Provision comptabilisée (691 / 196)");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="SYSCOHADA"
        title="Notes annexes & compléments"
        description="Notes auto + manuelles · approche par composants · engagements de retraite · coût d'achat avec frais accessoires."
      />

      <Card className="mb-4 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3 font-display">Notes annexes générées</div>
        <ul className="divide-y divide-border">
          {notes.map((n) => (
            <li key={n.code + n.title} className="px-4 py-3 text-sm">
              <p className="font-medium">
                Note {n.code} — {n.title}
              </p>
              <p className="mt-1 text-xs text-muted whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-display mb-2">Approche par composants</h2>
          <p className="mb-3 text-xs text-muted">
            SYSCOHADA : ventiler une immobilisation en composants si durées d&apos;utilité différentes
            (toiture, structure, équipements…).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Libellé composant">
              <Input
                value={comp.label}
                onChange={(e) => setComp({ ...comp, label: e.target.value })}
              />
            </Field>
            <Field label="Coût">
              <Input
                type="number"
                value={comp.cost || ""}
                onChange={(e) => setComp({ ...comp, cost: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Valeur résiduelle">
              <Input
                type="number"
                value={comp.residualValue || ""}
                onChange={(e) => setComp({ ...comp, residualValue: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Durée (années)">
              <Input
                type="number"
                value={comp.usefulLifeYears || ""}
                onChange={(e) =>
                  setComp({ ...comp, usefulLifeYears: Number(e.target.value) || 1 })
                }
              />
            </Field>
          </div>
          <div className="mt-2 flex gap-2">
            <Button type="button" onClick={addComponent}>
              Ajouter composant
            </Button>
            <Button type="button" variant="secondary" onClick={runDepAll}>
              Dotation 1 an
            </Button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {(data.assetComponents || []).map((c) => (
              <li key={c.id} className="flex justify-between border-t border-border pt-1">
                <span>
                  {c.label} ({c.usefulLifeYears} ans)
                </span>
                <span>
                  <Money value={c.cost - c.accumulatedDep} currency={currency} /> net
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="font-display mb-2">Engagements de retraite</h2>
          <p className="mb-3 text-xs text-muted">
            SYSCOHADA révisé : provision obligatoire si obligation actuelle, sortie probable, montant
            fiable. Méthode actuarielle (appel public à l&apos;épargne) ou simplifiée.
          </p>
          <div className="grid gap-2">
            <Field label="Libellé">
              <Input value={ret.label} onChange={(e) => setRet({ ...ret, label: e.target.value })} />
            </Field>
            <Field label="Montant estimé">
              <Input
                type="number"
                value={ret.amount || ""}
                onChange={(e) => setRet({ ...ret, amount: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <Button type="button" className="mt-2" onClick={addRetirement}>
            Enregistrer l&apos;engagement
          </Button>
          <ul className="mt-3 space-y-2 text-sm">
            {(data.retirementProvisions || []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                <span>
                  {r.label} — <Money value={r.amount} currency={currency} /> ({r.method})
                  {r.booked ? " · comptabilisé" : ""}
                </span>
                {!r.booked ? (
                  <Button type="button" variant="secondary" onClick={() => bookRetirement(r.id)}>
                    Comptabiliser 691/196
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>


      <Card className="mb-4 p-4">
        <h2 className="font-display mb-2">Première application du SYSCOHADA révisé</h2>
        <p className="mb-3 text-xs text-muted">
          Écritures de transition types (Guide apps 123–126) : frais d&apos;établissement, primes de
          remboursement, reclassement composants, provision retraite antérieure (imputation RAN).
        </p>
        <FirstApplicationPanel />
      </Card>

      <Card className="mb-4 p-4">
        <h2 className="font-display mb-2">Consolidation D4C (simplifiée)</h2>
        <p className="mb-3 text-xs text-muted">
          Intégration globale, proportionnelle ou mise en équivalence — base journal de l&apos;entité
          courante + filiales saisies en % de détention.
        </p>
        <ConsolidationPanel />
      </Card>

      <Card className="p-4">
        <h2 className="font-display mb-2">Coût d&apos;achat avec frais accessoires</h2>
        <p className="mb-3 text-xs text-muted">
          SYSCOHADA révisé : les frais accessoires (transport, assurances, droits de douane…) sont
          incorporés au coût d&apos;acquisition des stocks et immobilisations — plus en charges par
          nature.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Prix d'achat">
            <Input
              type="number"
              value={accPrice || ""}
              onChange={(e) => setAccPrice(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Frais accessoires">
            <Input
              type="number"
              value={accFees || ""}
              onChange={(e) => setAccFees(Number(e.target.value) || 0)}
            />
          </Field>
          <div className="rounded-[10px] border border-border px-4 py-2">
            <p className="text-xs text-muted">Coût d&apos;entrée</p>
            <p className="font-semibold">
              <Money value={purchaseCost(accPrice, accFees)} currency={currency} />
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FirstApplicationPanel() {
  const data = useAppStore();
  const [frais, setFrais] = useState(0);
  const [primes, setPrimes] = useState(0);
  const [compAdj, setCompAdj] = useState(0);
  const [retraite, setRetraite] = useState(0);

  function apply() {
    const lines = firstApplicationEntries({
      fraisEtablissementNet: frais,
      primesRemboursementNet: primes,
      composantsAdjustment: compAdj,
      retraiteProvision: retraite,
    });
    if (!lines.length) {
      toast.error("Aucun montant renseigné");
      return;
    }
    data.addJournalLines(lines);
    toast.success(`${lines.length} écriture(s) de première application générée(s)`);
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Frais d'établissement (net)">
          <Input type="number" value={frais || ""} onChange={(e) => setFrais(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Primes de remboursement">
          <Input type="number" value={primes || ""} onChange={(e) => setPrimes(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Ajustement composants">
          <Input type="number" value={compAdj || ""} onChange={(e) => setCompAdj(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Provision retraite antérieure">
          <Input type="number" value={retraite || ""} onChange={(e) => setRetraite(Number(e.target.value) || 0)} />
        </Field>
      </div>
      <Button type="button" className="mt-3" onClick={apply}>
        Générer les écritures de transition
      </Button>
    </div>
  );
}

function ConsolidationPanel() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const [name, setName] = useState("Filiale A");
  const [percent, setPercent] = useState(80);
  const [method, setMethod] = useState<"integration_globale" | "integration_proportionnelle" | "mise_en_equivalence">(
    "integration_globale",
  );
  const [subs, setSubs] = useState<
    { id: string; name: string; percent: number; method: "integration_globale" | "integration_proportionnelle" | "mise_en_equivalence" }[]
  >([]);

  const result = consolidateD4C([
    {
      id: "parent",
      name: data.settings.companyName || "Société mère",
      percent: 100,
      journal: data.journal,
      method: "integration_globale",
    },
    ...subs.map((s) => ({
      ...s,
      journal: data.journal, // simplification : même base ou vide — démo
    })),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Nom filiale">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="% détention">
          <Input
            type="number"
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Méthode">
          <select
            className="rounded border border-border bg-transparent px-2 py-1.5 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            <option value="integration_globale">Intégration globale</option>
            <option value="integration_proportionnelle">Intégration proportionnelle</option>
            <option value="mise_en_equivalence">Mise en équivalence</option>
          </select>
        </Field>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSubs((s) => [
              ...s,
              { id: uid(), name, percent, method },
            ]);
            toast.success("Filiale ajoutée au périmètre");
          }}
        >
          Ajouter au périmètre
        </Button>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {subs.map((s) => (
          <li key={s.id} className="flex justify-between border-t border-border pt-1">
            <span>
              {s.name} — {s.percent}% — {s.method}
            </span>
            <button
              type="button"
              className="text-xs text-danger"
              onClick={() => setSubs((x) => x.filter((y) => y.id !== s.id))}
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-border p-2">
          <p className="text-xs text-muted">Actif combiné</p>
          <p className="font-semibold">
            <Money value={result.combinedActif} currency={currency} />
          </p>
        </div>
        <div className="rounded border border-border p-2">
          <p className="text-xs text-muted">Passif combiné</p>
          <p className="font-semibold">
            <Money value={result.combinedPassif} currency={currency} />
          </p>
        </div>
        <div className="rounded border border-border p-2">
          <p className="text-xs text-muted">Intérêts minoritaires</p>
          <p className="font-semibold">
            <Money value={result.minoritaires} currency={currency} />
          </p>
        </div>
      </div>
      <ul className="mt-2 text-xs text-muted space-y-1">
        {result.notes.map((n, i) => (
          <li key={i}>• {n}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Mode démo : les filiales réutilisent le journal mère (à remplacer par import multi-dossiers en
        production). Éliminations intra-groupe non automatisées.
      </p>
    </div>
  );
}
