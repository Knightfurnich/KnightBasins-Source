const tokenFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const millionTokenFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function safeTokenCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function formatExactTokenCount(value: number): string {
  return `${tokenFormatter.format(safeTokenCount(value))} โทเคน`;
}

export function formatTokenCount(value: number): string {
  const count = safeTokenCount(value);
  if (count >= 1_000_000) {
    return `${millionTokenFormatter.format(count / 1_000_000)} ล้านโทเคน`;
  }
  return formatExactTokenCount(count);
}

export function formatTokenCountWithExact(value: number): string {
  const display = formatTokenCount(value);
  const exact = formatExactTokenCount(value);
  return display === exact ? display : `${display} (${exact})`;
}