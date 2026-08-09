export type Money = number | null | undefined;

export function formatMoney(value: Money, symbol = "₹") {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 10000000) return `${symbol}${(n / 10000000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 100000) return `${symbol}${(n / 100000).toFixed(2)} L`;
  return `${symbol}${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatMoneyFull(value: Money, symbol = "₹") {
  return `${symbol}${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeDay(value: string | null | undefined) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  const days = Math.round((then - Date.now()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_executive: "Sales Executive",
  accountant: "Accountant",
};

export const INDUSTRY_OPTIONS = [
  "Interior Design",
  "Architecture",
  "Real Estate",
  "Construction",
  "Hospitality",
  "Retail",
  "Manufacturing",
  "Information Technology",
  "Healthcare",
  "Education",
  "Finance",
  "Logistics",
  "Media & Advertising",
  "Professional Services",
  "Other",
].map((name) => ({ id: name, name }));