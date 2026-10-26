import { useMemo, useState } from "react";
import { allAccounts } from "@/lib/account-utils";
import { useAppStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import type { Account } from "@/lib/types";

/** Saisie rapide : taper le n° de compte OU liste filtree (plan + sous-comptes). */
export function AccountPicker({
  value,
  onChange,
  allowEmpty,
}: {
  value: string;
  onChange: (code: string) => void;
  allowEmpty?: boolean;
}) {
  const custom =
    useAppStore((s) => ((s as { customAccounts?: Account[] }).customAccounts as Account[] | undefined)) || [];
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || "");
  const accounts = useMemo(() => allAccounts(custom), [custom]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return accounts.slice(0, 80);
    return accounts
      .filter((a) => a.code.toLowerCase().includes(needle) || a.label.toLowerCase().includes(needle))
      .slice(0, 80);
  }, [accounts, q]);
  const label = accounts.find((a) => a.code === value)?.label;
  function commit(code: string) {
    const c = code.trim();
    onChange(c);
    setQ(c);
    setOpen(false);
  }
  return (
    <div className="relative">
      <Input
        value={open ? q : value ? `${value}${label ? ` — ${label}` : ""}` : q}
        placeholder="N° compte ou libelle…"
        autoComplete="off"
        onFocus={() => {
          setQ(value || "");
          setOpen(true);
        }}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          setOpen(true);
          const raw = v.split("—")[0].trim();
          if (/^\d{2,6}$/.test(raw)) onChange(raw);
        }}
        onBlur={() => {
          const raw = q.split("—")[0].trim();
          if (raw) onChange(raw);
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const raw = q.split("—")[0].trim();
            if (filtered[0] && !/^\d+$/.test(raw)) commit(filtered[0].code);
            else if (raw) commit(raw);
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open ? (
        <ul className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-[10px] border border-border bg-surface shadow-lg">
          {allowEmpty ? (
            <li>
              <button type="button" className="w-full px-3 py-2 text-left text-sm text-muted hover:bg-elevated" onMouseDown={(e) => e.preventDefault()} onClick={() => commit("")}>
                — Aucun —
              </button>
            </li>
          ) : null}
          {filtered.map((a) => (
            <li key={a.code}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-elevated" onMouseDown={(e) => e.preventDefault()} onClick={() => commit(a.code)}>
                <span className="font-mono text-xs">{a.code}</span>
                <span className="text-muted"> — {a.label}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted">Aucun compte. Validez un n° libre ou creez le sous-compte dans Plan comptable.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
