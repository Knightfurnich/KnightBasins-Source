const tokenFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const millionTokenFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function safeTokenCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function tokenCountUnit(value: number): string {
  return safeTokenCount(value) >= 1_000_000 ? "ล้านโทเคน" : "โทเคน";
}

export function formatTokenCountValue(value: number): string {
  const count = safeTokenCount(value);
  return count >= 1_000_000
    ? millionTokenFormatter.format(count / 1_000_000)
    : tokenFormatter.format(count);
}

export function formatTokenCountHeading(value: number): string {
  return `โทเคนรวม (${tokenCountUnit(value)})`;
}

export function formatExactTokenCount(value: number): string {
  return `${tokenFormatter.format(safeTokenCount(value))} โทเคน`;
}

export function formatTokenCount(value: number): string {
  return `${formatTokenCountValue(value)} ${tokenCountUnit(value)}`;
}

export function formatTokenCountWithExact(value: number): string {
  const display = formatTokenCount(value);
  const exact = formatExactTokenCount(value);
  return display === exact ? display : `${display} (${exact})`;
}