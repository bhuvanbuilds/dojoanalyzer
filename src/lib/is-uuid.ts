const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed UUID; IDs in URLs are checked before any query. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
