export const platforms = ["linkedin", "instagram", "facebook", "twitter"] as const;
export class ContentError extends Error {}
export function draftFields(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ContentError("Provide a content object.");
  const b = input as Record<string, unknown>;
  if (typeof b.title !== "string" || !b.title.trim() || b.title.trim().length > 200) throw new ContentError("Add a title of 1–200 characters.");
  if (typeof b.body !== "string" || !b.body.trim() || b.body.trim().length > 10000) throw new ContentError("Add post text of 1–10,000 characters.");
  if (!platforms.includes(b.platform as typeof platforms[number])) throw new ContentError("Choose a supported channel.");
  return { title: b.title.trim(), body: b.body.trim(), platform: b.platform as typeof platforms[number] };
}
export function initialStatus(value: unknown) {
  if (value === undefined || value === "draft") return "draft";
  if (value === "pending_approval") return "pending_approval";
  throw new ContentError("Create a draft first. Approval and scheduling use separate actions; published status is provider-owned.");
}
export function transition(status: string, action: string, admin: boolean, scheduledAt?: unknown, now = Date.now()) {
  if (action === "submit" && status === "draft") return { status: "pending_approval" };
  if (!admin) throw new ContentError("An administrator must approve or schedule content.");
  if (action === "approve" && status === "pending_approval") return { status: "approved" };
  if (action === "reject" && status === "pending_approval") return { status: "draft" };
  if (action === "unschedule" && status === "scheduled") return { status: "approved" };
  if (action === "schedule" && ["approved", "scheduled"].includes(status)) {
    if (typeof scheduledAt !== "string" || !Number.isFinite(Date.parse(scheduledAt)) || Date.parse(scheduledAt) <= now) throw new ContentError("Choose a future date and time.");
    return { status: "scheduled", scheduledAt: new Date(scheduledAt) };
  }
  throw new ContentError("This action is unavailable for the current content status. Refresh and try again.");
}
