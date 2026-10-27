import "server-only";
import type { Account, Profile } from "next-auth";
import { AssetError, MAX_ASSET_BYTES } from "./asset-policy";
import { DriveConnection } from "./models/DriveConnection";
import { WorkspaceMember } from "./models/WorkspaceMember";
import { WORKSPACE_ID, normalizeEmail } from "./access-policy";
import { DRIVE_FILE_SCOPE, DRIVE_READ_SCOPE, driveFileId, driveQuery, hasDriveScopes } from "./drive-policy";
import { openDriveToken, sealDriveToken } from "./drive-vault";
import dbConnect from "./mongodb";

type Actor = { tenantId: string; email: string };
const identity = (tenant: string, email: string, sub: string) => `${tenant}:${email}:${sub}`;
export async function saveDriveGrant(account: Account, profile: Profile) {
  if (!account.access_token || !hasDriveScopes(account.scope || "")) return;
  const email = normalizeEmail(profile.email), sub = account.providerAccountId;
  if (!email) return;
  await dbConnect();
  if (!await WorkspaceMember.exists({ tenantId: WORKSPACE_ID, email, googleSubject: sub, status: "active" })) return;
  await DriveConnection.init();
  const binding = identity(WORKSPACE_ID, email, sub), secret = process.env.AUTH_SECRET!;
  await DriveConnection.findOneAndUpdate({ tenantId: WORKSPACE_ID, email, googleSubject: sub }, { $set: {
    accessToken: sealDriveToken(account.access_token, secret, binding),
    ...(account.refresh_token ? { refreshToken: sealDriveToken(account.refresh_token, secret, binding) } : {}),
    expiresAt: new Date((account.expires_at || Math.floor(Date.now() / 1000) + 3500) * 1000), scope: account.scope,
  } }, { upsert: true, runValidators: true });
}
async function connection(actor: Actor) {
  // A connection belongs to the live Google identity, not just a reusable email.
  const filter = { tenantId: actor.tenantId, email: actor.email };
  const member = await WorkspaceMember.findOne({ ...filter, status: "active" }).select("+googleSubject");
  if (!member?.googleSubject) return null;
  return DriveConnection.findOne({ ...filter, googleSubject: member.googleSubject }).select("+accessToken +refreshToken");
}
export async function driveStatus(actor: Actor) {
  const c = await connection(actor);
  return { connected: Boolean(c && hasDriveScopes(c.scope) && (c.refreshToken || c.expiresAt > new Date())), email: actor.email, requiredScopes: [DRIVE_READ_SCOPE, DRIVE_FILE_SCOPE] };
}
async function accessToken(actor: Actor) {
  const c = await connection(actor);
  if (!c || !hasDriveScopes(c.scope)) throw new AssetError("Connect your Google Drive in Assets first.", 409);
  const secret = process.env.AUTH_SECRET!, binding = identity(c.tenantId, c.email, c.googleSubject);
  try {
    if (c.expiresAt.getTime() > Date.now() + 60000) return openDriveToken(c.accessToken, secret, binding);
    if (!c.refreshToken) throw new AssetError("Google Drive permission expired. Reconnect Google Drive.", 409);
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.AUTH_GOOGLE_ID!, client_secret: process.env.AUTH_GOOGLE_SECRET!, refresh_token: openDriveToken(c.refreshToken, secret, binding), grant_type: "refresh_token" }), signal: AbortSignal.timeout(15000), redirect: "error" });
    const d = await r.json();
    if (!r.ok || !d.access_token) throw new AssetError("Google Drive permission expired or was revoked. Reconnect Google Drive.", 409);
    if (d.scope && !hasDriveScopes(d.scope)) throw new AssetError("Google Drive permissions are incomplete. Reconnect and allow both permissions.", 409);
    const result = await DriveConnection.updateOne({ _id: c._id, updatedAt: c.updatedAt }, { $set: { accessToken: sealDriveToken(d.access_token, secret, binding), expiresAt: new Date(Date.now() + (d.expires_in || 3500) * 1000) } });
    if (!result.matchedCount && !await DriveConnection.exists({ _id: c._id })) throw new AssetError("Google Drive was disconnected. Connect again.", 409);
    return d.access_token as string;
  } catch (e) { if (e instanceof AssetError) throw e; throw new AssetError("Google Drive could not refresh its connection. Reconnect or retry.", 502); }
}
async function driveFetch(actor: Actor, path: string, init: RequestInit = {}) {
  const token = await accessToken(actor);
  // No caller-supplied host, redirect or authorization header can receive tokens.
  const r = await fetch(`https://www.googleapis.com/${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(45000) }).catch(() => { throw new AssetError("Google Drive could not be reached. Please retry.", 502); });
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    if (d?.error?.errors?.some((e: { reason?: string }) => ["accessNotConfigured", "serviceDisabled"].includes(e.reason || "")) || d?.error?.details?.some((e: { reason?: string }) => e.reason === "SERVICE_DISABLED")) throw new AssetError("Enable Google Drive API in the Orbit Google Cloud project, then retry.", 503);
    if (r.status === 401) throw new AssetError("Google Drive permission expired. Reconnect Google Drive.", 409);
    if (r.status === 404) throw new AssetError("This file is unavailable to your connected Google account.", 404);
    if (r.status === 403) throw new AssetError("Google denied this Drive action. Check your file permissions, Drive storage and granted scopes.", 403);
    throw new AssetError("Google Drive could not complete this action. Please retry.", 502);
  }
  return r;
}
export async function listDriveFiles(actor: Actor, parent: string, search: string, pageToken: string) {
  if (parent !== "root") driveFileId(parent);
  const params = new URLSearchParams({ q: driveQuery(parent, search), pageSize: "30", fields: "nextPageToken,files(id,name,mimeType,size,capabilities(canDownload))", orderBy: "folder,name", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
  if (pageToken) { if (pageToken.length > 2000) throw new AssetError("Invalid Drive page."); params.set("pageToken", pageToken); }
  return (await driveFetch(actor, `drive/v3/files?${params}`)).json();
}
async function readFile(r: Response) {
  if (Number(r.headers.get("content-length")) > MAX_ASSET_BYTES) { await r.body?.cancel(); throw new AssetError("Drive files must be up to 25 MB.", 413); }
  if (!r.body) throw new AssetError("Google returned an empty file.");
  const reader = r.body.getReader(), chunks: Buffer[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_ASSET_BYTES) throw new AssetError("Drive files must be up to 25 MB.", 413); chunks.push(Buffer.from(value)); } }
  finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}
export async function downloadConnectedDriveFile(actor: Actor, fileId: string) {
  driveFileId(fileId);
  const meta = await (await driveFetch(actor, `drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,size,capabilities(canDownload)`)).json();
  if (!meta.capabilities?.canDownload || meta.mimeType === "application/vnd.google-apps.folder") throw new AssetError("Choose a file that your Google account is allowed to download.");
  if (Number(meta.size) > MAX_ASSET_BYTES) throw new AssetError("Drive files must be up to 25 MB.", 413);
  const native = ["application/vnd.google-apps.document", "application/vnd.google-apps.presentation", "application/vnd.google-apps.spreadsheet"].includes(meta.mimeType);
  const path = native ? `drive/v3/files/${fileId}/export?mimeType=application%2Fpdf` : `drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const data = await readFile(await driveFetch(actor, path));
  const filename = (meta.name + (native ? ".pdf" : "")).replace(/[\x00-\x1f/\\]/g, "_").slice(0, 240);
  return { data, filename, name: meta.name.slice(0, 160), sourceUrl: `https://drive.google.com/file/d/${fileId}/view` };
}
export async function copyFileToDrive(actor: Actor, file: { name: string; mime: string; data: Buffer; assetId: string }) {
  // Only app-created files are written. Never change an existing Drive original.
  const metadata = JSON.stringify({ name: file.name, appProperties: { orbitAssetId: file.assetId, orbitWorkspace: actor.tenantId } });
  const session = await driveFetch(actor, "upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink", { method: "POST", headers: { "Content-Type": "application/json", "X-Upload-Content-Type": file.mime, "X-Upload-Content-Length": String(file.data.length) }, body: metadata });
  const location = session.headers.get("location");
  if (!location) throw new AssetError("Google did not start the upload. Retry saving the copy.", 502);
  const url = new URL(location);
  if (url.origin !== "https://www.googleapis.com" || url.pathname !== "/upload/drive/v3/files" || url.username || url.password) throw new AssetError("Google returned an unsupported upload endpoint.", 502);
  return (await driveFetch(actor, url.pathname.slice(1) + url.search, { method: "PUT", headers: { "Content-Type": file.mime }, body: new Uint8Array(file.data) })).json() as Promise<{ id: string; webViewLink?: string }>;
}
