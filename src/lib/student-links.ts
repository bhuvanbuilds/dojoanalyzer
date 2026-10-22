/**
 * Where a click on a student goes. Staff get the full history page; students
 * looking at a classmate get the public profile (belts and growth only).
 */
export function studentHref(id: string, { asStudent = false } = {}) {
  return asStudent ? `/student/${id}` : `/students/${id}/history`;
}
