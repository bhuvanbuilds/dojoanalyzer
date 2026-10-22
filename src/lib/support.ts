/** Shared by the support API and UI: ticket kinds, states and limits. */

export const TICKET_TYPES = ["feature", "bug", "other"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const SEVERITIES = ["low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const TYPE_LABELS: Record<TicketType, string> = {
  feature: "Feature idea",
  bug: "Bug report",
  other: "Other issue",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Minor annoyance",
  medium: "Gets in my way",
  high: "Blocks my work",
};

export const LIMITS = {
  titleMin: 3,
  titleMax: 140,
  descriptionMin: 10,
  descriptionMax: 5000,
  messageMax: 5000,
  ticketsPerDay: 15,
} as const;

export type Ticket = {
  id: string;
  number: number;
  type: TicketType;
  title: string;
  description: string;
  severity: Severity | null;
  status: TicketStatus;
  page_url: string | null;
  reporter_email: string;
  reporter_name: string | null;
  reporter_role: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
};

export type TicketMessage = {
  id: string;
  author_name: string | null;
  is_staff: boolean;
  body: string;
  created_at: string;
  mine: boolean;
};

export function isTicketType(value: unknown): value is TicketType {
  return TICKET_TYPES.includes(value as TicketType);
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return TICKET_STATUSES.includes(value as TicketStatus);
}

export function isSeverity(value: unknown): value is Severity {
  return SEVERITIES.includes(value as Severity);
}

/** Collapses runs of spaces in one-line text; keeps newlines in long text. */
export function cleanText(value: unknown, multiline = false) {
  if (typeof value !== "string") return "";
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  return multiline
    ? trimmed.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
    : trimmed.replace(/\s+/g, " ");
}
