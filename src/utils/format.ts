export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Henüz yok";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Geçersiz tarih";
  }
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function formatLatency(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return `${formatNumber(value)} ms`;
}

export function shortPath(value: string, limit = 54): string {
  if (value.length <= limit) {
    return value;
  }
  return `...${value.slice(Math.max(0, value.length - limit))}`;
}
