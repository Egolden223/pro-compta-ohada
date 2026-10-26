import type { Account } from "@/lib/types";
import { PLAN_COMPTABLE, ACCOUNT_BY_CODE } from "@/lib/accounts";

export function accountLabel(code: string, custom: Account[] = []): string {
  if (ACCOUNT_BY_CODE[code]) return ACCOUNT_BY_CODE[code]!.label;
  const c = custom.find((x) => x.code === code);
  return c?.label ?? code;
}

/** Plan SYSCOHADA + sous-comptes utilisateur */
export function allAccounts(custom: Account[] = []): Account[] {
  const map = new Map<string, Account>();
  for (const a of PLAN_COMPTABLE) map.set(a.code, a);
  for (const a of custom) {
    if (a.code) map.set(a.code, a);
  }
  return [...map.values()].sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }));
}

export function findAccount(code: string, custom: Account[] = []): Account | undefined {
  return ACCOUNT_BY_CODE[code] || custom.find((x) => x.code === code);
}
