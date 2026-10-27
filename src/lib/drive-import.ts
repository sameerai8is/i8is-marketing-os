import "server-only";
import { AssetError, driveLink, MAX_ASSET_BYTES } from "./asset-policy";

function allowedDownload(url: URL) {
  return url.protocol === "https:" && !url.port && !url.username && !url.password && (["drive.google.com", "drive.usercontent.google.com", "docs.google.com"].includes(url.hostname) || /^[a-z0-9.-]+\.googleusercontent\.com$/i.test(url.hostname));
}
// Public download only. Never forward an Orbit/Google token, browser cookie,
// or arbitrary user-supplied URL to the server's HTTP client.
export async function downloadDriveFile(link: string, request: typeof fetch = fetch) {
  const item = driveLink(link);
  if (item.folder) throw new AssetError("Folders stay as Drive references. Choose a single file link to import, or upload files from the folder.");
  if (item.native) throw new AssetError("Export this Google document as a PDF in Drive, then upload it to attach it to a post. The original link stays in your library.");
  let url = new URL("https://drive.usercontent.google.com/download");
  url.searchParams.set("id", item.id); url.searchParams.set("export", "download"); url.searchParams.set("confirm", "t");
  const resourceKey = new URL(item.url).searchParams.get("resourcekey");
  if (resourceKey) url.searchParams.set("resourcekey", resourceKey);
  const signal = AbortSignal.timeout(45000);
  for (let i = 0; i < 5; i++) {
    if (!allowedDownload(url)) throw new AssetError("Google redirected this download to an unsupported location.");
    const response = await request(url.toString(), { redirect: "manual", signal, headers: { Accept: "application/octet-stream" } }).catch(() => { throw new AssetError("Google Drive could not be reached. Your saved link remains available.", 502); });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location"); await response.body?.cancel();
      if (!location) break;
      url = new URL(location, url); continue;
    }
    if (!response.ok || /text\/html|application\/json/.test(response.headers.get("content-type") || "")) { await response.body?.cancel(); throw new AssetError("This Drive file needs Google access or is not directly downloadable. Keep the private link, or download the file in Drive and upload it here. You do not need to make private material public."); }
    if (Number(response.headers.get("content-length")) > MAX_ASSET_BYTES) { await response.body?.cancel(); throw new AssetError("This Drive file exceeds the 25 MB file limit.", 413); }
    if (!response.body) throw new AssetError("Google returned an empty file.");
    const reader = response.body.getReader(), buffers: Buffer[] = [];
    let size = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_ASSET_BYTES) throw new AssetError("This Drive file exceeds the 25 MB file limit.", 413); buffers.push(Buffer.from(value)); }
    } finally { await reader.cancel().catch(() => {}); }
    let filename = response.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || response.headers.get("content-disposition")?.match(/filename="([^"]+)"/i)?.[1] || "";
    try { filename = decodeURIComponent(filename); } catch { filename = ""; }
    return { data: Buffer.concat(buffers), filename: filename.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 240) };
  }
  throw new AssetError("Google Drive returned too many redirects. Your link has been kept.");
}
