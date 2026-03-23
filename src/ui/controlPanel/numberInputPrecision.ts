export const MAX_DISPLAY_DECIMALS = 12;

export const decimalPlaces = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  const normalized = Math.abs(value).toString().toLowerCase();
  if (normalized.includes("e")) {
    const [mantissa, exponentText] = normalized.split("e");
    const exponent = Number.parseInt(exponentText ?? "0", 10);
    const mantissaDecimals = (mantissa.split(".")[1] ?? "").length;
    return Math.max(0, Math.min(MAX_DISPLAY_DECIMALS, mantissaDecimals - exponent));
  }
  return Math.min(MAX_DISPLAY_DECIMALS, (normalized.split(".")[1] ?? "").length);
};
