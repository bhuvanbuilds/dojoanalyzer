/** Shared by the access request API and UI. */

export const REQUESTABLE_ROLES = ["student", "mentor", "campus_manager", "other"] as const;
export type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

export const REQUEST_ROLE_LABELS: Record<RequestableRole, string> = {
  student: "Student",
  mentor: "Mentor",
  campus_manager: "Campus manager",
  other: "Something else",
};

export type AccessRequest = {
  id: string;
  email: string;
  full_name: string;
  requested_role: RequestableRole;
  other_role: string | null;
  university_id: string | null;
  university_name: string | null;
  squad_number: string | null;
  details: string | null;
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

export function roleLabel(request: Pick<AccessRequest, "requested_role" | "other_role">) {
  return request.requested_role === "other"
    ? (request.other_role ?? "Other")
    : REQUEST_ROLE_LABELS[request.requested_role];
}
