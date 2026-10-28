export class DeliveryError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function publishingOptions(value: unknown, now = Date.now()) {
  const b = value as Record<string, unknown> | undefined;
  if (!b || typeof b.channelId !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(b.channelId)) throw new DeliveryError("Choose a connected Buffer profile.");
  if (b.mode !== "shareNow" && b.mode !== "customScheduled") throw new DeliveryError("Choose Publish now or a specific publishing time.");
  let dueAt: Date | undefined;
  if (b.mode === "customScheduled") {
    if (typeof b.dueAt !== "string" || !Number.isFinite(Date.parse(b.dueAt)) || Date.parse(b.dueAt) < now + 120000 || Date.parse(b.dueAt) > now + 90 * 86400000) throw new DeliveryError("Schedule between two minutes and 90 days from now.");
    dueAt = new Date(b.dueAt);
  }
  return { channelId: b.channelId, mode: b.mode, dueAt } as { channelId: string; mode: "shareNow" | "customScheduled"; dueAt?: Date };
}
export function validatePublishable(post: { platform: string; body: string; imageUrl?: string }, assets: { kind: string; mime: string; size: number; width?: number; height?: number }[]) {
  const limits: Record<string, number> = { linkedin: 3000, facebook: 63206, instagram: 2200, twitter: 280 };
  if (!limits[post.platform] || [...post.body].length > limits[post.platform]) throw new DeliveryError(`Shorten this post to ${limits[post.platform] || 0} characters for ${post.platform}.`);
  if (post.imageUrl) throw new DeliveryError("Replace the legacy image link with an approved Asset Library attachment before publishing.");
  if (post.platform === "instagram" && !assets.length) throw new DeliveryError("Instagram feed posts need at least one approved image.");
  const max = post.platform === "twitter" ? 4 : post.platform === "linkedin" ? 9 : 10;
  if (assets.length > max) throw new DeliveryError(`This channel supports at most ${max} images in Orbit.`);
  if (assets.some(a => a.kind !== "image" || !["image/jpeg", "image/png"].includes(a.mime) || a.size > 8 * 1024 * 1024)) throw new DeliveryError("Live publishing currently supports JPG and PNG images up to 8 MB each. Videos, PDFs and other formats can remain in drafts.");
  if (post.platform === "instagram" && assets.some(a => !a.width || !a.height || a.width / a.height < 0.8 || a.width / a.height > 1.91)) throw new DeliveryError("Instagram images must have an aspect ratio between 4:5 and 1.91:1. Crop the images before uploading.");
}
export function providerState(status: string) {
  if (status === "sent") return "published";
  if (status === "error") return "failed";
  if (["scheduled", "sending"].includes(status)) return "queued";
  return "attention";
}
