import { PLAN_COMPTABLE } from "@/lib/accounts";
import { NativeSelect } from "@/components/ui/input";

export function AccountPicker({
  value,
  onChange,
  allowEmpty,
}: {
  value: string;
  onChange: (code: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty ? <option value="">—</option> : null}
      {PLAN_COMPTABLE.map((a) => (
        <option key={a.code} value={a.code}>
          {a.code} — {a.label}
        </option>
      ))}
    </NativeSelect>
  );
}
