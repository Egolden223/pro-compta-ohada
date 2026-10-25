export function formatNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatMoney(n: number, currency = "XOF"): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "XOF" || currency === "XAF" ? 0 : 2,
    }).format(n);
  } catch {
    return `${formatNumber(n)} ${currency}`;
  }
}
