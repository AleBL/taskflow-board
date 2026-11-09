export const DAY_MS = 24 * 60 * 60 * 1000;

type DateLike = Date | string | number;

/**
 * Due dates are stored as the start of the chosen day in the user's local
 * timezone. A task only becomes overdue once that whole day has passed, which
 * works on the server without knowing the user's timezone.
 */
export function isTaskOverdue(
  task: { dueDate: DateLike | null | undefined; status: string },
  now: number = Date.now()
): boolean {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate).getTime() + DAY_MS <= now;
}

/** Converts a local Date into the `YYYY-MM-DD` value used by `<input type="date">`. */
export function toDateInputValue(value: DateLike | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses `YYYY-MM-DD` as local midnight (not UTC, which shifts the day west of Greenwich). */
export function fromDateInputValue(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
}
