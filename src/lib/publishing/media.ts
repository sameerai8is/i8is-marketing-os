import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { IDelivery } from "../models/Delivery";
import { DeliveryError } from "./policy";

function signature(deliveryId: string, assetId: string, expires: string) {
  const key = process.env.AUTH_SECRET;
  if (!key) throw new DeliveryError("Publishing media signing is not configured.", 503);
  return createHmac("sha256", key).update(`orbit-publishing-media:v1:${deliveryId}:${assetId}:${expires}`).digest("hex");
}
export function mediaUrl(d: Pick<IDelivery, "_id" | "mediaExpiresAt">, assetId: string) {
  const configured = process.env.PUBLISHING_MEDIA_ORIGIN || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.AUTH_URL);
  let origin: URL;
  try { origin = new URL(configured || ""); } catch { throw new DeliveryError("Configure PUBLISHING_MEDIA_ORIGIN with Orbit's public HTTPS URL.", 503); }
  if (origin.protocol !== "https:" || /^(localhost|127\.|\[::1\])/.test(origin.hostname) || origin.username || origin.password) throw new DeliveryError("Image publishing needs PUBLISHING_MEDIA_ORIGIN set to Orbit's public HTTPS deployment.", 503);
  const expires = String(Math.floor(d.mediaExpiresAt.getTime() / 1000));
  return `${origin.origin}/api/publishing/media/${d._id}/${assetId}?expires=${expires}&signature=${signature(String(d._id), assetId, expires)}`;
}
export function verifyMediaSignature(deliveryId: string, assetId: string, expires: string | null, sig: string | null) {
  if (!expires || !/^\d{10}$/.test(expires) || Number(expires) * 1000 <= Date.now() || !sig || !/^[a-f0-9]{64}$/.test(sig)) return false;
  return timingSafeEqual(Buffer.from(signature(deliveryId, assetId, expires), "hex"), Buffer.from(sig, "hex"));
}
