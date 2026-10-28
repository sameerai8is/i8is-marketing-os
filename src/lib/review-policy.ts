export const reviewTypes = ["post", "asset", "strategy"] as const;
export type ReviewType = typeof reviewTypes[number];
export class ReviewError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function reviewType(value: unknown): ReviewType {
  if (!reviewTypes.includes(value as ReviewType)) throw new ReviewError("Choose posts, assets or strategies.");
  return value as ReviewType;
}
export function reviewNote(value: unknown, required = false) {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.trim().length > 2000 || (required && !value.trim())) throw new ReviewError("Write feedback of 1-2,000 characters.");
  return value.trim();
}
