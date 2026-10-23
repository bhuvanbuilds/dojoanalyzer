import "server-only";

export const CHANGELOG_COLUMNS =
  "id, kind, title, body, image_url, ticket_id, published, published_at, created_at, support_tickets(number)";

export type ChangelogRow = Record<string, unknown> & {
  support_tickets?: { number: number } | Array<{ number: number }> | null;
};

export function toEntry(row: ChangelogRow) {
  const { support_tickets: ticket, ...entry } = row;
  const linked = Array.isArray(ticket) ? ticket[0] : ticket;
  return { ...entry, ticket_number: linked?.number ?? null };
}
