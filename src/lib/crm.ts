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

export function getMeetLink(
  item: { meeting_link?: string | null; notes?: string | null; subject?: string | null } | null | undefined,
): string | null {
  if (!item) return null;
  if (item.meeting_link?.trim()) return item.meeting_link.trim();
  const text = `${item.notes ?? ""} ${item.subject ?? ""}`;
  const match = text.match(/(https?:\/\/[^\s>]*(?:meet\.google\.com|zoom\.us|teams\.microsoft)[^\s>]*)/i);
  if (match && match[1]) return match[1];
  const genericMatch = text.match(/(https?:\/\/[^\s>]+)/i);
  if (genericMatch && genericMatch[1]) return genericMatch[1];
  return null;
}

export function formatNotesWithMeetLink(
  notes: string | null | undefined,
  meetLink: string | null | undefined,
): string | null {
  const cleanNotes = (notes ?? "").trim();
  const cleanLink = (meetLink ?? "").trim();
  if (!cleanLink) return cleanNotes || null;
  if (cleanNotes.includes(cleanLink)) return cleanNotes;
  return cleanNotes ? `${cleanNotes}\n\nGoogle Meet: ${cleanLink}` : `Google Meet: ${cleanLink}`;
}