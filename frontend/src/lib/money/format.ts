const DECIMAL_AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/;

export function normalizeAmountInput(value: string): string {
  return value.trim();
}

export function isPositiveAmountInput(value: string): boolean {
  const normalized = normalizeAmountInput(value);
  const match = DECIMAL_AMOUNT.exec(normalized);
  if (!match) {
    return false;
  }
  const digits = `${match[1]}${match[2] ?? ""}`;
  return /[1-9]/.test(digits);
}

export function formatAmount(value: string): string {
  const match = DECIMAL_AMOUNT.exec(value);
  if (!match) {
    throw new Error("Amount must be a decimal string with at most two fractional digits.");
  }
  const major = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return `${major}.${fraction}`;
}
