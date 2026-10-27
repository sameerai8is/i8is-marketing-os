export const UPLOAD_CHUNK_BYTES = 1024 * 1024;
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const WORKSPACE_ASSET_BYTES = 100 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;
export class AssetError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function assetFields(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AssetError("Provide asset details.");
  const b = input as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim() || b.name.trim().length > 160) throw new AssetError("Add an asset name of 1–160 characters.");
  const folder = typeof b.folder === "string" ? b.folder.trim() : "";
  const altText = typeof b.altText === "string" ? b.altText.trim() : "";
  if (folder.length > 80 || altText.length > 500) throw new AssetError("Folder names allow 80 characters and alt text allows 500.");
  if (b.tags !== undefined && (!Array.isArray(b.tags) || b.tags.length > 12 || b.tags.some(t => typeof t !== "string" || !t.trim() || t.trim().length > 30))) throw new AssetError("Use up to 12 tags of 1–30 characters.");
  return { name: b.name.trim(), folder, altText, tags: [...new Set((b.tags as string[] || []).map(t => t.trim().toLowerCase()))] };
}
export function driveLink(input: unknown) {
  if (typeof input !== "string" || input.length > 2000) throw new AssetError("Paste a Google Drive file or folder link.");
  let url;
  try { url = new URL(input); } catch { throw new AssetError("Paste a complete Google Drive link."); }
  if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(url.hostname) || url.port || url.username || url.password) throw new AssetError("Use an HTTPS Google Drive, Docs, Slides, or Sheets link.");
  const native = url.hostname === "docs.google.com";
  const nativeType = url.pathname.match(/^\/(document|presentation|spreadsheets)\//)?.[1];
  if (native && !nativeType) throw new AssetError("Use a Google Docs, Slides, or Sheets document link.");
  const folder = /\/folders\//.test(url.pathname);
  const id = url.pathname.match(/\/(?:d|folders)\/([A-Za-z0-9_-]+)/)?.[1] || url.searchParams.get("id");
  if (!id || !/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new AssetError("This link does not identify a Drive file or folder.");
  const normalized = new URL(native ? `https://docs.google.com/${nativeType}/d/${id}/edit` : `https://drive.google.com/${folder ? "drive/folders" : "file/d"}/${id}${folder ? "" : "/view"}`);
  const resourceKey = url.searchParams.get("resourcekey");
  if (resourceKey && /^[A-Za-z0-9_-]{1,200}$/.test(resourceKey)) normalized.searchParams.set("resourcekey", resourceKey);
  return { url: normalized.toString(), id, folder, native };
}
export function attachmentIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS || value.some(id => typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id))) throw new AssetError(`Choose up to ${MAX_ATTACHMENTS} assets from your library.`);
  if (new Set(value).size !== value.length) throw new AssetError("An asset can only be attached once.");
  return value as string[];
}
export function byteRange(header: string | null, size: number) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2])) throw new AssetError("Unsupported file range.", 416);
  let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new AssetError("File range is outside this asset.", 416);
  start = Math.max(0, start); end = Math.min(end, size - 1);
  return { start, end };
}
