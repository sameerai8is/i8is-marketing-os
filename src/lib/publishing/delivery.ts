import "server-only";
import mongoose from "mongoose";
import { Delivery, type IDelivery } from "../models/Delivery";
import { ContentItem } from "../models/ContentItem";
import { WorkspaceMember } from "../models/WorkspaceMember";
import { Asset } from "../models/Asset";
import { AuditEvent } from "../models/AuditEvent";
import { withAssetLock } from "../asset-lock";
import { validateAssetReferences } from "../asset-storage";
import { getPublishingProvider } from "./gateway";
import { PublishingError } from "./buffer";
import { DeliveryError, providerState, publishingOptions, validatePublishable } from "./policy";
import { mediaUrl } from "./media";
import type { ProviderPost, PublishingProvider } from "./types";

type Actor = { id: string; tenantId: string; email: string; role: string };
const history = (action: string, actor: string) => ({ at: new Date(), action, actor });
export function deliveryDTO(d: IDelivery) {
  return { id: String(d._id), postId: d.postId, title: d.title, platform: d.platform, channelName: d.channelName, mode: d.mode, dueAt: d.dueAt, state: d.state, providerId: d.providerId, providerStatus: d.providerStatus, externalLink: d.externalLink, sentAt: d.sentAt, attempts: d.attempts, error: d.error, retryAfter: d.retryAfter, checkedAt: d.checkedAt, requestedBy: d.requestedBy, history: d.history, createdAt: d.createdAt };
}
async function event(d: IDelivery, action: string, actor: string) {
  await AuditEvent.create({ tenantId: d.tenantId, actor, action: `publishing.${action}`, target: String(d._id) });
}
async function assetsFor(d: Pick<IDelivery, "tenantId" | "assetIds" | "text" | "platform">) {
  await validateAssetReferences(d.tenantId, d.assetIds, true);
  const found = await Asset.find({ tenantId: d.tenantId, _id: { $in: d.assetIds } });
  const assets = d.assetIds.map(id => found.find(a => String(a._id) === id)!);
  if (assets.some(a => !a?.storageId)) throw new DeliveryError("An attached image is unavailable. Import or upload it again.");
  validatePublishable({ platform: d.platform, body: d.text }, assets);
  return assets;
}
async function validChannel(provider: PublishingProvider, channelId: string, platform: string) {
  const channel = (await provider.listChannels()).find(c => c.id === channelId);
  if (!channel || channel.platform !== platform) throw new DeliveryError("Choose a Buffer profile matching this post's channel.");
  if (!channel.connected || channel.locked || channel.queuePaused) throw new DeliveryError("Reconnect, unlock or resume this profile in Buffer before publishing.", 409);
  return channel;
}
export async function createDelivery(actor: Actor, postId: string, input: Record<string, unknown>, provider = getPublishingProvider()) {
  if (actor.role !== "admin") throw new DeliveryError("Only administrators can publish.", 403);
  if (!mongoose.isValidObjectId(postId)) throw new DeliveryError("Post not found.", 404);
  const options = publishingOptions(input);
  await Delivery.init();
  const delivery = await withAssetLock(actor.tenantId, async () => {
    const post = await ContentItem.findOne({ _id: postId, tenantId: actor.tenantId });
    if (!post) throw new DeliveryError("Post not found.", 404);
    if (post.publishingId) throw new DeliveryError("This post already has a publishing request. Open Publishing Monitor.", 409);
    if (input.updatedAt !== post.updatedAt.toISOString()) throw new DeliveryError("This post changed. Refresh and review the saved version.", 409);
    // Legacy simulated schedules have never been delivered; allow explicit submission only.
    if (!["approved", "scheduled"].includes(post.status)) throw new DeliveryError("Approve this post before publishing.", 409);
    const channel = await validChannel(provider, options.channelId, post.platform);
    const ids = post.assetIds || [];
    const assets = await assetsFor({ tenantId: actor.tenantId, assetIds: ids, text: post.body, platform: post.platform });
    validatePublishable(post, assets);
    const id = new mongoose.Types.ObjectId();
    const d = await Delivery.create({ _id: id, tenantId: actor.tenantId, postId, activeKey: `${actor.tenantId}:${postId}`, contentVersion: post.updatedAt.toISOString(), title: post.title, text: post.body, platform: post.platform, assetIds: ids, channelName: channel.name, ...options, state: "prepared", requestedBy: actor.email, requestedById: actor.id, attempts: 0, mediaExpiresAt: new Date((options.dueAt?.getTime() || Date.now()) + 7 * 86400000), history: [history("Requested", actor.email)] });
    const locked = await ContentItem.updateOne({ _id: post._id, tenantId: actor.tenantId, updatedAt: post.updatedAt, publishingId: { $exists: false } }, { $set: { publishingId: String(id) } });
    if (!locked.modifiedCount) { await Delivery.deleteOne({ _id: id, state: "prepared" }); throw new DeliveryError("This post changed. Refresh before publishing.", 409); }
    return d;
  });
  await event(delivery, "requested", actor.email);
  return dispatchDelivery(delivery, actor, provider, true);
}
export async function dispatchDelivery(delivery: IDelivery, actor: Actor, provider = getPublishingProvider(), channelJustChecked = false) {
  if (actor.role !== "admin" || actor.tenantId !== delivery.tenantId) throw new DeliveryError("Only workspace administrators can publish.", 403);
  if (delivery.attempts >= 3) throw new DeliveryError("Three attempts have been used. Return this rejected request to draft and fix it before trying again.", 409);
  if (delivery.retryAfter && delivery.retryAfter.getTime() > Date.now()) throw new DeliveryError("Wait for the retry cooldown shown in the monitor.", 409);
  if (!await WorkspaceMember.exists({ _id: actor.id, tenantId: actor.tenantId, email: actor.email, role: "admin", status: "active" })) throw new DeliveryError("Your publishing access changed. Sign in again.", 403);
  const post = await ContentItem.findOne({ _id: delivery.postId, tenantId: actor.tenantId, publishingId: String(delivery._id) });
  if (!post || post.body !== delivery.text || post.platform !== delivery.platform || !["approved", "scheduled"].includes(post.status)) throw new DeliveryError("The approved post is no longer available for this request.", 409);
  if (!channelJustChecked) await validChannel(provider, delivery.channelId, delivery.platform);
  const assets = await assetsFor(delivery);
  // Validate public media configuration before taking the irreversible send lease.
  const media = assets.map(a => ({ image: { url: mediaUrl(delivery, String(a._id)), ...(a.altText ? { metadata: { altText: a.altText } } : {}) } }));
  if (delivery.dueAt && delivery.dueAt.getTime() < Date.now() + 120000) throw new DeliveryError("The scheduled time is too close or has passed. Return the request to draft and choose another time.", 409);
  const locked = await Delivery.findOneAndUpdate({ _id: delivery._id, tenantId: actor.tenantId, state: { $in: ["prepared", "rejected"] }, attempts: delivery.attempts }, { $set: { state: "submitting", operationAt: new Date(), nextCheckAt: new Date(Date.now() + 120000) }, $unset: { error: 1, code: 1 }, $inc: { attempts: 1 }, $push: { history: { $each: [history("Submitting to Buffer", actor.email)], $slice: -100 } } }, { new: true });
  if (!locked) throw new DeliveryError("A publishing attempt is already in progress. Refresh the monitor.", 409);
  let remote: ProviderPost;
  try {
    remote = await provider.createPost({ channelId: locked.channelId, text: locked.text, mode: locked.mode, dueAt: locked.dueAt?.toISOString(), assets: media, instagram: locked.platform === "instagram" });
  } catch (e) {
    const uncertain = !(e instanceof PublishingError) || e.uncertain;
    await Delivery.updateOne({ _id: locked._id, state: "submitting" }, { $set: { state: uncertain ? "uncertain" : "rejected", error: e instanceof PublishingError ? e.message : "The request was not confirmed. Check Buffer before taking further action.", code: e instanceof PublishingError ? e.code : "UNCONFIRMED", retryAfter: new Date(Date.now() + (e instanceof PublishingError && e.code === "BUFFER_RATE_LIMIT" ? 900000 : 60000)) }, $push: { history: { $each: [history(uncertain ? "Unconfirmed; duplicate retry blocked" : "Rejected; no post created", actor.email)], $slice: -100 } } });
    return (await Delivery.findById(locked._id))!;
  }
  // Save the remote ID before any further reconciliation or local content writes.
  await Delivery.updateOne({ _id: locked._id, state: "submitting" }, { $set: { providerId: remote.id } });
  if (remote.channelId !== locked.channelId || remote.text !== locked.text) {
    await Delivery.updateOne({ _id: locked._id, state: "submitting" }, { $set: { state: "attention", error: "Buffer accepted a post but returned changed content. Inspect the existing Buffer post; a duplicate send is blocked." } });
    return (await Delivery.findById(locked._id))!;
  }
  return applyRemote(locked, remote, actor.email);
}
async function applyRemote(d: IDelivery, remote: ProviderPost, actor: string) {
  if (remote.channelId !== d.channelId || remote.text !== d.text) throw new DeliveryError("Buffer returned a different post or edited content. Review it in Buffer before reconciling.", 409);
  const state = providerState(remote.status);
  // Never regress a confirmed published post on a stale poll response.
  const updated = await Delivery.findOneAndUpdate({ _id: d._id, state: { $nin: ["published", "cancelled", "cancelling", "cancel_uncertain"] } }, { $set: { providerId: remote.id, providerStatus: remote.status, state, checkedAt: new Date(), nextCheckAt: new Date(Math.max(Date.now() + 3600000, remote.dueAt ? Date.parse(remote.dueAt) + 120000 : 0)), ...(remote.dueAt ? { dueAt: new Date(remote.dueAt) } : {}), ...(remote.sentAt ? { sentAt: new Date(remote.sentAt) } : {}), ...(remote.externalLink ? { externalLink: remote.externalLink } : {}) }, $unset: { error: 1, code: 1 }, ...(state !== d.state ? { $push: { history: { $each: [history(`Buffer: ${remote.status}`, actor)], $slice: -100 } } } : {}) }, { new: true });
  const result = updated || (await Delivery.findById(d._id))!;
  await syncContent(result);
  return result;
}
async function syncContent(d: IDelivery) {
  if (d.state === "cancelled") {
    await ContentItem.updateOne({ _id: d.postId, tenantId: d.tenantId, publishingId: String(d._id) }, { $set: { status: d.returnToDraft ? "draft" : "approved" }, $unset: { publishingId: 1, scheduledAt: 1 } });
    return;
  }
  if (!["queued", "published", "failed", "attention"].includes(d.state)) return;
  await ContentItem.updateOne({ _id: d.postId, tenantId: d.tenantId, publishingId: String(d._id) }, { $set: { status: d.state === "published" ? "published" : d.state === "failed" ? "failed" : "scheduled", ...(d.dueAt ? { scheduledAt: d.dueAt } : {}), ...(d.sentAt ? { publishedAt: d.sentAt } : {}) } });
}
export async function refreshDelivery(d: IDelivery, actor: string, linkedId?: string, provider = getPublishingProvider(), scopedChannels?: string[]) {
  if (["submitting", "cancelling"].includes(d.state)) {
    if (Date.now() - (d.operationAt?.getTime() || Date.now()) < 120000) return d;
    await Delivery.updateOne({ _id: d._id, state: d.state }, { $set: { state: d.state === "submitting" ? "uncertain" : "cancel_uncertain", error: "Buffer did not confirm this operation. Check its dashboard; do not create another post." } });
    return (await Delivery.findById(d._id))!;
  }
  if (!linkedId && ["published", "cancelled"].includes(d.state)) { await syncContent(d); return d; }
  const id = linkedId || d.providerId;
  if (!id) return d;
  const channels = scopedChannels || (await provider.listChannels()).map(c => c.id);
  if (!channels.includes(d.channelId)) throw new DeliveryError("This profile is no longer accessible in the bound Buffer organization.", 409);
  const remote = await provider.getPost(id);
  if (remote.id !== id || remote.channelId !== d.channelId || remote.text !== d.text) throw new DeliveryError("That Buffer post does not match this request's profile and exact saved text.", 409);
  if (linkedId && (!remote.createdAt || Math.abs(Date.parse(remote.createdAt) - (d.operationAt?.getTime() || d.createdAt.getTime())) > 300000 || remote.assetCount !== d.assetIds.length)) throw new DeliveryError("That post's creation time or attachment count does not match this publishing attempt.", 409);
  if (d.state === "cancel_uncertain") {
    // A read confirms existence, not the result of a possibly delayed cancellation.
    if (remote.status !== "sent") throw new DeliveryError("Cancellation is unconfirmed. Inspect this post in Buffer; it will stay locked to prevent duplicates.", 409);
    await Delivery.updateOne({ _id: d._id, state: "cancel_uncertain" }, { $set: { state: "attention" } });
    d.state = "attention";
  }
  return applyRemote(d, remote, actor);
}
export async function releaseDelivery(d: IDelivery, actor: Actor, provider = getPublishingProvider()) {
  if (actor.role !== "admin" || actor.tenantId !== d.tenantId) throw new DeliveryError("Only workspace administrators can cancel publishing requests.", 403);
  if (["prepared", "rejected"].includes(d.state)) return releaseLocal(d, actor, true);
  if (d.state !== "queued" || !d.providerId) throw new DeliveryError("Only a confirmed queued post can be cancelled here. Inspect uncertain or failed requests in Buffer.", 409);
  if (!d.dueAt || d.dueAt.getTime() < Date.now() + 300000) throw new DeliveryError("This post is within five minutes of delivery or has no confirmed future time. Manage it directly in Buffer and refresh its status.", 409);
  await validChannel(provider, d.channelId, d.platform);
  const remote = await provider.getPost(d.providerId);
  if (remote.channelId !== d.channelId || remote.text !== d.text || remote.status !== "scheduled") throw new DeliveryError("Buffer is already sending, has published, or has changed this post. Refresh its status.", 409);
  const lock = await Delivery.findOneAndUpdate({ _id: d._id, state: "queued" }, { $set: { state: "cancelling", operationAt: new Date(), nextCheckAt: new Date(Date.now() + 120000) } }, { new: true });
  if (!lock) throw new DeliveryError("Another action is in progress. Refresh.", 409);
  try { await provider.deletePost(d.providerId); }
  catch (e) {
    await Delivery.updateOne({ _id: d._id, state: "cancelling" }, { $set: { state: e instanceof PublishingError && !e.uncertain ? "queued" : "cancel_uncertain", error: e instanceof PublishingError ? e.message : "Cancellation was not confirmed. Check Buffer." } });
    return (await Delivery.findById(d._id))!;
  }
  return releaseLocal(lock, actor, false);
}
async function releaseLocal(d: IDelivery, actor: Actor, draft: boolean) {
  return withAssetLock(actor.tenantId, async () => {
    const result = await Delivery.findOneAndUpdate({ _id: d._id, tenantId: actor.tenantId, state: d.state }, { $set: { state: "cancelled", returnToDraft: draft }, $unset: { activeKey: 1, error: 1 }, $push: { history: { $each: [history(draft ? "Returned to draft" : "Cancelled in Buffer", actor.email)], $slice: -100 } } }, { new: true });
    if (!result) throw new DeliveryError("This request changed. Refresh.", 409);
    await syncContent(result);
    await event(result, "cancelled", actor.email);
    return result;
  });
}
