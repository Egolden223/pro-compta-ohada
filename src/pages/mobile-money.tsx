import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/money";
import { useAppStore } from "@/lib/store";
import { buildBalance } from "@/lib/engine";
import { countryByName } from "@/lib/countries";
import { todayISO } from "@/lib/utils";
import type { MobileMoneyAccount } from "@/lib/types";

const PROVIDERS: MobileMoneyAccount["provider"][] = [
  "Orange Money",
  "Wave",
  "Moov",
  "MTN",
  "Autre",
];

export function MobileMoneyPage() {
  const data = useAppStore();
  const currency = countryByName(data.settings.country).currency;
  const list = data.mobileMoneyAccounts || [];
  const balance = buildBalance(data.journal);

  const [provider, setProvider] = useState<MobileMoneyAccount["provider"]>("Orange Money");
  const [phone, setPhone] = useState("");
  const [account, setAccount] = useState("5218");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [mmId, setMmId] = useState(list[0]?.id ?? "");
  const [side, setSide] = useState<"in" | "out">("in");

  function addAccount() {
    if (!phone || !account) {
      toast.error("Téléphone et compte requis.");
      return;
    }
    data.addMobileMoney({
      provider,
      phone,
      account,
      label: label || `${provider} ${phone}`,
    });
    toast.success("Compte Mobile Money ajouté.");
    setPhone("");
    setLabel("");
  }

  function postMove() {
    const mm = list.find((x) => x.id === mmId);
    if (!mm || amount <= 0) {
      toast.error("Compte et montant requis.");
      return;
    }
    const piece = data.consumeNumber("PIECE_BROUILLARD");
    if (side === "in") {
      // Encaissement client via MM
      data.addJournalLine({
        date: todayISO(),
        piece,
        journal: "BQ",
        debit: mm.account,
        credit: "411",
        libelle: `Encaissement ${mm.provider} — ${mm.phone}`,
        amount: Math.round(amount),
        source: "manual",
        remark: "Mobile Money",
      });
    } else {
      data.addJournalLine({
        date: todayISO(),
        piece,
        journal: "BQ",
        debit: "401",
        credit: mm.account,
        libelle: `Paiement ${mm.provider} — ${mm.phone}`,
        amount: Math.round(amount),
        source: "manual",
        remark: "Mobile Money",
      });
    }
    toast.success("Mouvement Mobile Money enregistré.");
    setAmount(0);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Trésorerie"
        title="Mobile Money"
        description="Orange Money, Wave, Moov… — comptes 521x / 571x et mouvements liés."
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg">Comptes configurés</h2>
          <ul className="mb-4 space-y-2 text-sm">
            {list.map((m) => {
              const row = balance.find((r) => r.code === m.account);
              const solde = (row?.soldeD ?? 0) - (row?.soldeC ?? 0);
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border px-3 py-2"
                >
                  <span>
                    <strong>{m.provider}</strong> · {m.label}
                    <br />
                    <span className="font-mono text-xs text-muted">
                      {m.account} · {m.phone}
                    </span>
                  </span>
                  <span className="text-right">
                    <Money value={solde} currency={currency} />
                    <button
                      type="button"
                      className="ml-2 text-xs text-muted hover:text-danger"
                      onClick={() => data.removeMobileMoney(m.id)}
                    >
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
            {list.length === 0 ? <p className="text-muted">Aucun compte.</p> : null}
          </ul>
          <div className="grid gap-2">
            <Field label="Opérateur">
              <NativeSelect
                value={provider}
                onChange={(e) => setProvider(e.target.value as MobileMoneyAccount["provider"])}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Téléphone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Compte SYSCOHADA">
              <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="5218" />
            </Field>
            <Field label="Libellé">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Button type="button" onClick={addAccount}>
              Ajouter le compte
            </Button>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg">Saisir un mouvement</h2>
          <div className="grid gap-3">
            <Field label="Compte MM">
              <NativeSelect value={mmId} onChange={(e) => setMmId(e.target.value)}>
                {list.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.provider} — {m.account}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Sens">
              <NativeSelect value={side} onChange={(e) => setSide(e.target.value as "in" | "out")}>
                <option value="in">Encaissement (client → MM)</option>
                <option value="out">Paiement (MM → fournisseur)</option>
              </NativeSelect>
            </Field>
            <Field label="Montant">
              <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
            </Field>
            <Button type="button" onClick={postMove}>
              Enregistrer
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
