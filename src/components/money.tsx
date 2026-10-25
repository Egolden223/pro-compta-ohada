import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({
  value,
  currency = "XOF",
  className,
  signed = false,
}: {
  value: number;
  currency?: string;
  className?: string;
  signed?: boolean;
}) {
  const neg = value < 0;
  return (
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight",
        neg && "text-danger",
        className,
      )}
    >
      {signed && value > 0 ? "+" : ""}
      {formatMoney(value, currency)}
    </span>
  );
}

export function Qty({ value, className }: { value: number; className?: string }) {
  return <span className={cn("font-mono tabular-nums", className)}>{formatNumber(value)}</span>;
}
