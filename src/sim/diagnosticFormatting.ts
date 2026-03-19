export const formatDiagnosticValue = (value: number): string => {
  const normalized = Math.abs(value) < 0.0005 ? 0 : value;
  const abs = Math.abs(normalized);
  const dp = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(dp)}`;
};
