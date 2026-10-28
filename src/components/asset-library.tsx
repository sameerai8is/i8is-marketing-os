"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { DrivePanel } from "./drive-panel";
import { loadJSON, responseJSON } from "@/lib/client-api";
import { FileText, Film, FolderOpen, Link2, UploadCloud, X, Check } from "lucide-react";
import { MAX_ASSET_BYTES } from "@/lib/asset-policy";
import { type LibraryAsset, attachableAsset, formatBytes } from "@/lib/asset-types";

interface Props { onChoose?: (assets: LibraryAsset[]) => void; initialSelection?: LibraryAsset[]; }
interface LibraryData { items: LibraryAsset[]; total: number; pages: number; folders: string[]; usedBytes: number; quotaBytes: number; actorEmail: string; admin: boolean; }
interface UploadProgress { filename: string; current: number; total: number; percent: number; }
const empty: LibraryData = { items: [], total: 0, pages: 1, folders: [], usedBytes: 0, quotaBytes: 100 * 1024 * 1024, actorEmail: "", admin: false };
const tagsFromText = (text: string) => text.split(",").map(s => s.trim()).filter(Boolean);

export function AssetLibrary({ onChoose, initialSelection = [] }: Props) {
  const requestedAsset = useSearchParams().get("asset");
  const [data, setData] = useState<LibraryData>(empty), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [query, setQuery] = useState(""), [folder, setFolder] = useState("*"), [kind, setKind] = useState(""), [source, setSource] = useState(""), [approval, setApproval] = useState(""), [page, setPage] = useState(1);
  const [selection, setSelection] = useState(initialSelection);
  const [uploadFolder, setUploadFolder] = useState(""), [uploadTags, setUploadTags] = useState(""), [progress, setProgress] = useState<UploadProgress | null>(null);
  const [linkName, setLinkName] = useState(""), [driveUrl, setDriveUrl] = useState("");
  const [detail, setDetail] = useState<LibraryAsset | null>(null), [name, setName] = useState(""), [detailFolder, setDetailFolder] = useState(""), [tags, setTags] = useState(""), [altText, setAltText] = useState("");
  const [driveConnected, setDriveConnected] = useState(false), [saveToDrive, setSaveToDrive] = useState(false);
  const uploads = useRef<HTMLDialogElement>(null), links = useRef<HTMLDialogElement>(null), details = useRef<HTMLDialogElement>(null), fileInput = useRef<HTMLInputElement>(null), cancelUpload = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), q: query, kind, source, approval });
      if (folder !== "*") params.set("folder", folder);
      const result = await loadJSON(`/api/assets?${params}`, signal);
      setData(result);
    } catch (e) { if (!signal?.aborted) setError((e as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [page, query, folder, kind, source, approval]);
  useEffect(() => { const c = new AbortController(), timer = setTimeout(() => void load(c.signal), 180); return () => { clearTimeout(timer); c.abort(); }; }, [load]);
  useEffect(() => {
    if (!requestedAsset || onChoose) return; const c = new AbortController();
    void loadJSON(`/api/assets/${encodeURIComponent(requestedAsset)}`, c.signal).then((a: LibraryAsset) => { setDetail(a); setName(a.name); setDetailFolder(a.folder); setTags(a.tags.join(", ")); setAltText(a.altText); details.current?.showModal(); }).catch(e => { if (!c.signal.aborted) setError(e.message); });
    return () => c.abort();
  }, [requestedAsset, onChoose]);
  async function api(path: string, method: string, body?: object) {
    const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return responseJSON(r);
  }
  function openDetail(asset: LibraryAsset) {
    setDetail(asset); setName(asset.name); setDetailFolder(asset.folder); setTags(asset.tags.join(", ")); setAltText(asset.altText); setError(""); setMessage(""); details.current?.showModal();
  }
  function select(asset: LibraryAsset) {
    if (!attachableAsset(asset)) return;
    if (selection.some(a => a.id === asset.id)) setSelection(selection.filter(a => a.id !== asset.id));
    else if (selection.length >= 10) setError("You can attach up to 10 files to a post.");
    else setSelection([...selection, asset]);
  }
  async function edit(asset: LibraryAsset, action: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const item: LibraryAsset = await api(`/api/assets/${asset.id}`, "PATCH", { action, updatedAt: asset.updatedAt, name, folder: detailFolder, tags: tagsFromText(tags), altText });
      setSelection(previous => previous.map(a => a.id === item.id ? item : a));
      if (detail?.id === item.id) setDetail(item);
      await load(); setMessage(action === "approve" ? "Asset approved for posts." : action === "unapprove" ? "Approval removed." : "Asset details saved.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(asset: LibraryAsset) {
    if (!window.confirm(`Delete “${asset.name}” from Orbit? Linked Drive originals are never deleted.`)) return;
    setBusy(true); setError("");
    try { await api(`/api/assets/${asset.id}`, "DELETE", { updatedAt: asset.updatedAt }); setSelection(previous => previous.filter(a => a.id !== asset.id)); details.current?.close(); await load(); setMessage("Asset removed from Orbit."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function importFile(asset: LibraryAsset) {
    setBusy(true); setError(""); setMessage("");
    try { const item: LibraryAsset = await api(`/api/assets/${asset.id}/import`, "POST"); setDetail(item); await load(); setMessage("Drive file imported. Review and approve it before submitting a post."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function addDrive() {
    setBusy(true); setError(""); setMessage("");
    try { await api("/api/assets", "POST", { action: "drive", name: linkName, url: driveUrl, folder: uploadFolder, tags: tagsFromText(uploadTags) }); links.current?.close(); setLinkName(""); setDriveUrl(""); await load(); setMessage("Drive reference saved. Open its details and import the file, or use Choose from Google Drive to import private files."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function uploadFiles(files: FileList | File[] | null) {
    if (!files?.length || busy) return;
    const queue = Array.from(files); if (queue.length > 10) { setError("Upload up to 10 files at a time."); return; }
    setBusy(true); setError(""); setMessage(""); cancelUpload.current = false;
    let completed = 0; const failures: string[] = [];
    for (let i = 0; i < queue.length; i++) {
      if (cancelUpload.current) break;
      const file = queue[i]; let pending: LibraryAsset | undefined;
      try {
        if (!file.size || file.size > MAX_ASSET_BYTES) throw new Error("Choose a non-empty file up to 25 MB.");
        setProgress({ filename: file.name, current: i + 1, total: queue.length, percent: 0 });
        const session = await api("/api/assets", "POST", { action: "upload", name: file.name.slice(0, 160), filename: file.name, size: file.size, folder: uploadFolder, tags: tagsFromText(uploadTags) }); pending = session;
        for (let part = 0; part < session.chunks; part++) {
          if (cancelUpload.current) throw new Error("Upload cancelled.");
          const chunk = file.slice(part * session.chunkSize, Math.min(file.size, (part + 1) * session.chunkSize));
          let ok = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const r = await fetch(`/api/assets/${session.id}/upload?part=${part}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: chunk });
              if (r.ok) { ok = true; break; }
              if (![409, 502, 503, 504].includes(r.status) || attempt === 2) await responseJSON(r);
            } catch (e) { if (!(e instanceof TypeError) || attempt === 2) throw e; }
            await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
          }
          if (!ok) throw new Error("File chunk failed.");
          setProgress({ filename: file.name, current: i + 1, total: queue.length, percent: Math.min(99, Math.round((part + 1) / session.chunks * 100)) });
        }
        let item: LibraryAsset | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          try { item = await api(`/api/assets/${session.id}/upload`, "POST"); break; }
          catch (e) { if (attempt === 2) throw e; await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); }
        }
        if (!item) throw new Error("Upload could not be finalized. Retry the file.");
        pending = undefined; completed++;
        if (saveToDrive && driveConnected) {
          try { await api(`/api/assets/${item.id}/drive`, "POST"); }
          catch (e) { failures.push(`${file.name} was uploaded to Orbit, but its Drive copy failed: ${(e as Error).message}. Open asset details to retry the copy.`); }
        }
        if (onChoose && attachableAsset(item)) { const uploaded = item; setSelection(previous => previous.length < 10 ? [...previous.filter(a => a.id !== uploaded.id), uploaded] : previous); }
      } catch (e) {
        failures.push(`${file.name}: ${(e as Error).message}`);
        if (pending) await api(`/api/assets/${pending.id}`, "DELETE", { updatedAt: pending.updatedAt }).catch(() => {});
      }
    }
    setBusy(false); setProgress(null); if (fileInput.current) fileInput.current.value = "";
    await load(); if (completed) setMessage(`${completed} file${completed === 1 ? "" : "s"} uploaded. Review approval and add alt text before use.`);
    if (failures.length) setError(failures.join(" · "));
    if (!failures.length && completed) uploads.current?.close();
  }
  const notices = <div aria-live="polite">{error && <p className="orbit-login-alert" role="alert">{error}</p>}{message && <p className="orbit-team-success" role="status">{message}</p>}</div>;
  return <div className={onChoose ? "orbit-asset-picker" : "orbit-team orbit-assets"}>
    <div className="mission-header"><div><h1>{onChoose ? "Choose post assets" : "Your brand, in one library."}</h1><p>{onChoose ? "Select images, clips, or PDFs. Pending assets must be approved before review submission." : "Upload graphics and files, save Drive references, and bring approved assets into your posts."}</p></div><div className="orbit-toolbar"><button className="orbit-button" disabled={busy} onClick={() => { setError(""); links.current?.showModal(); }}>+ Add Drive link</button><button className="orbit-button orbit-button-dark" disabled={busy} onClick={() => { setError(""); uploads.current?.showModal(); }}><UploadCloud size={15} /> Upload files</button></div></div>
    <DrivePanel onConnection={setDriveConnected} onImported={asset => { void load(); if (onChoose && attachableAsset(asset)) setSelection(previous => previous.length < 10 ? [...previous.filter(a => a.id !== asset.id), asset] : previous); }} />
    <div className="orbit-asset-usage"><span>{formatBytes(data.usedBytes)} of {formatBytes(data.quotaBytes)} file allowance</span><progress value={data.usedBytes} max={data.quotaBytes} /><span>25 MB per file · private workspace access</span></div>
    <div className="orbit-toolbar my-5"><input type="search" aria-label="Search asset names or tags" placeholder="Search names or tags" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /><select aria-label="Filter asset folder" value={folder} onChange={e => { setFolder(e.target.value); setPage(1); }}><option value="*">All folders</option><option value="">Unfiled</option>{data.folders.map(f => <option key={f} value={f}>{f}</option>)}</select><select aria-label="Filter asset type" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}><option value="">All types</option><option value="image">Images</option><option value="video">Videos</option><option value="document">PDF documents</option><option value="source">Source files / fonts</option><option value="link">Drive references</option></select><select aria-label="Filter source" value={source} onChange={e => { setSource(e.target.value); setPage(1); }}><option value="">All sources</option><option value="upload">Uploads</option><option value="google_drive">Google Drive</option></select><select aria-label="Filter asset approval" value={approval} onChange={e => { setApproval(e.target.value); setPage(1); }}><option value="">All approvals</option><option value="approved">Approved</option><option value="pending">Needs review</option></select><button className="orbit-text-button" disabled={busy || loading} onClick={() => { setError(""); void load(); }}>Refresh</button></div>
    {notices}
    {loading ? <p className="orbit-team-empty" role="status">Loading your asset library…</p> : data.items.length ? <div className="orbit-asset-grid">{data.items.map(asset => <article className={`orbit-asset-card ${selection.some(a => a.id === asset.id) ? "is-selected" : ""}`} key={asset.id}>
      <button className="orbit-asset-visual" aria-label={`View ${asset.name}`} onClick={() => openDetail(asset)}>{asset.previewUrl ? <Image src={asset.previewUrl} alt={asset.altText || asset.name} loading="lazy" width={640} height={640} unoptimized /> : asset.kind === "link" ? <FolderOpen size={42} /> : asset.kind === "video" ? <Film size={42} /> : <FileText size={42} />}</button>
      <div className="orbit-asset-card-body"><div className="orbit-toolbar justify-between"><span className={`orbit-badge orbit-badge-${asset.approval === "approved" ? "green" : "amber"}`}>{asset.approval === "approved" ? "Approved" : "Needs review"}</span><small>{asset.kind === "link" ? asset.driveFolder ? "Drive folder" : "Drive file" : formatBytes(asset.size)}</small></div><h2><button onClick={() => openDetail(asset)}>{asset.name}</button></h2><p>{asset.folder || "Unfiled"}{asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}</p><div className="orbit-asset-tags">{asset.tags.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div>
      <div className="orbit-toolbar mt-3">{onChoose && attachableAsset(asset) ? <button disabled={busy} className="orbit-text-button" onClick={() => select(asset)}>{selection.some(a => a.id === asset.id) ? <><Check size={13} /> Selected</> : "Select for post"}</button> : !onChoose && attachableAsset(asset) ? <Link className="orbit-text-button" href={`/calendar?asset=${asset.id}`}>Use in a post →</Link> : asset.sourceUrl ? <a className="orbit-text-button" href={asset.sourceUrl} target="_blank" rel="noopener noreferrer">Open in Drive ↗</a> : <button className="orbit-text-button" onClick={() => openDetail(asset)}>View details</button>}{data.admin && asset.approval === "pending" && asset.kind !== "link" && <button disabled={busy} className="orbit-text-button" onClick={() => void edit(asset, "approve")}>Approve</button>}</div></div>
    </article>)}</div> : <section className="orbit-surface orbit-asset-empty"><UploadCloud size={42} /><h2>{query || kind || source || approval || folder !== "*" ? "No assets match this view." : "Give your marketing a visual home."}</h2><p>Upload logos, photos, graphics, clips, PDFs, or brand source files. You can also save Google Drive file and folder links.</p><button className="orbit-button orbit-button-dark" onClick={() => uploads.current?.showModal()}>Upload your first assets</button></section>}
    <div className="orbit-toolbar justify-between mt-5"><span className="orbit-team-note">{data.total} assets · page {page} of {data.pages}</span><div className="orbit-toolbar"><button disabled={page <= 1 || loading} className="orbit-text-button" onClick={() => setPage(page - 1)}>Previous</button><button disabled={page >= data.pages || loading} className="orbit-text-button" onClick={() => setPage(page + 1)}>Next</button></div></div>
    {onChoose && <div className="orbit-asset-picker-footer"><p>{selection.length} of 10 selected</p><button className="orbit-button orbit-button-dark" disabled={busy} onClick={() => onChoose(selection)}>Use selected assets</button></div>}
    <dialog ref={uploads} className="orbit-composer" aria-labelledby="upload-heading" onCancel={e => { if (busy) e.preventDefault(); }}><div className="orbit-toolbar justify-between"><h2 id="upload-heading">Upload to Orbit</h2><button disabled={busy} className="orbit-text-button" aria-label="Close upload" onClick={() => uploads.current?.close()}><X size={18} /></button></div><p className="orbit-team-note mt-3">Images, PDF, MP4/WebM, SVG source, fonts, and ZIP packs · up to 25 MB each. Source files are download-only; images, videos and PDFs can be attached to posts.</p><div className="orbit-composer-form">{driveConnected && <label className="orbit-toolbar"><input type="checkbox" disabled={busy} checked={saveToDrive} onChange={e => setSaveToDrive(e.target.checked)} />Also save a copy of each upload to my Google Drive</label>}<label>Folder<input value={uploadFolder} maxLength={80} disabled={busy} placeholder="e.g. Brand / Product / Campaigns" onChange={e => setUploadFolder(e.target.value)} /></label><label>Tags, separated by commas<input value={uploadTags} disabled={busy} maxLength={370} placeholder="logo, recruitment, launch" onChange={e => setUploadTags(e.target.value)} /></label><div className="orbit-upload-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void uploadFiles(e.dataTransfer.files); }}><UploadCloud size={34} /><p>Drop files here or choose from your computer</p><input ref={fileInput} type="file" multiple disabled={busy} aria-label="Choose assets to upload" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml,application/pdf,video/mp4,video/webm,.zip,.woff,.woff2,.ttf,.otf" onChange={e => void uploadFiles(e.target.files)} /></div>{progress && <div role="status"><p className="orbit-team-note">File {progress.current} of {progress.total}: {progress.filename} · {progress.percent >= 99 ? "Processing and saving file..." : `${progress.percent}%`}</p><progress className="orbit-upload-progress" max={100} value={progress.percent} /><button className="orbit-text-button" onClick={() => { cancelUpload.current = true; }}>Cancel upload</button></div>}{notices}</div></dialog>
    <dialog ref={links} className="orbit-composer" aria-labelledby="drive-heading" onCancel={e => { if (busy) e.preventDefault(); }}><div className="orbit-toolbar justify-between"><h2 id="drive-heading">Add a Google Drive reference</h2><button disabled={busy} className="orbit-text-button" aria-label="Close Drive link form" onClick={() => links.current?.close()}><X size={18} /></button></div><p className="orbit-team-note mt-3">Save a reference with its existing Google permissions. For a private file, connect your Drive above and choose Import in asset details, or use Choose from Google Drive.</p><form className="orbit-composer-form" onSubmit={e => { e.preventDefault(); void addDrive(); }}><label>Name<input required maxLength={160} value={linkName} disabled={busy} onChange={e => setLinkName(e.target.value)} /></label><label>Drive file or folder URL<input type="url" required maxLength={2000} placeholder="https://drive.google.com/…" value={driveUrl} disabled={busy} onChange={e => setDriveUrl(e.target.value)} /></label><label>Folder<input maxLength={80} value={uploadFolder} disabled={busy} onChange={e => setUploadFolder(e.target.value)} /></label><label>Tags, separated by commas<input value={uploadTags} disabled={busy} onChange={e => setUploadTags(e.target.value)} /></label>{notices}<button disabled={busy} className="orbit-button orbit-button-dark"><Link2 size={15} />{busy ? "Saving…" : "Save Drive reference"}</button></form></dialog>
    <dialog ref={details} className="orbit-composer" aria-labelledby="asset-detail-heading" onCancel={e => { if (busy) e.preventDefault(); }}><div className="orbit-toolbar justify-between"><h2 id="asset-detail-heading">Asset details</h2><button disabled={busy} className="orbit-text-button" aria-label="Close asset details" onClick={() => details.current?.close()}><X size={18} /></button></div>{detail && <>
      {detail.previewUrl ? <div className="orbit-asset-detail-preview"><Image src={detail.previewUrl} alt={detail.altText || detail.name} width={640} height={640} unoptimized /></div> : detail.kind === "video" && detail.fileUrl ? <video className="orbit-asset-detail-preview" controls preload="metadata" src={detail.fileUrl} /> : <div className="orbit-asset-detail-placeholder">{detail.kind === "link" ? <FolderOpen size={40} /> : <FileText size={40} />}<p>{detail.driveFolder ? "Google Drive folder" : detail.kind === "source" ? "Source file · download to use" : detail.kind}</p></div>}
      <p className="orbit-team-note">{detail.mime} · {formatBytes(detail.size)} · added by {detail.createdBy}</p>
      <div className="orbit-toolbar mt-4">{driveConnected && detail.fileUrl && (data.admin || detail.createdBy === data.actorEmail) && <button disabled={busy} className="orbit-button" onClick={async () => { setBusy(true); setError(""); try { await api(`/api/assets/${detail.id}/drive`, "POST"); setMessage("Copy saved to your Google Drive."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Save copy to my Google Drive</button>}{detail.fileUrl && <a className="orbit-button" href={`${detail.fileUrl}?download=1`}>Download original</a>}{detail.sourceUrl && <a className="orbit-button" href={detail.sourceUrl} target="_blank" rel="noopener noreferrer">Open in Google Drive ↗</a>}{detail.kind === "link" && !detail.driveFolder && (!detail.driveNative || driveConnected) && <button disabled={busy} className="orbit-button orbit-button-lime" onClick={() => void importFile(detail)}>{busy ? "Importing…" : "Import file into Orbit"}</button>}</div>
      {detail.kind === "link" && <p className="orbit-team-note mt-3">Connect your own Drive above to import files you can download, browse folders and export Google Docs, Slides or Sheets as PDF. Imported copies are shared with the workspace. A saved reference alone cannot be attached to a post.</p>}
      <form className="orbit-composer-form" onSubmit={e => { e.preventDefault(); void edit(detail, "metadata"); }}><label>Name<input required maxLength={160} value={name} disabled={busy || !data.admin && detail.createdBy !== data.actorEmail} onChange={e => setName(e.target.value)} /></label><label>Folder<input maxLength={80} value={detailFolder} disabled={busy || !data.admin && detail.createdBy !== data.actorEmail} onChange={e => setDetailFolder(e.target.value)} /></label><label>Tags<input value={tags} disabled={busy || !data.admin && detail.createdBy !== data.actorEmail} onChange={e => setTags(e.target.value)} /></label><label>Alt text / description<textarea maxLength={500} rows={3} value={altText} disabled={busy || !data.admin && detail.createdBy !== data.actorEmail} onChange={e => setAltText(e.target.value)} /></label>{notices}<div className="orbit-toolbar">{(data.admin || detail.createdBy === data.actorEmail) && <button className="orbit-button orbit-button-dark" disabled={busy}>Save details</button>}{data.admin && <button type="button" disabled={busy} className="orbit-button" onClick={() => void edit(detail, detail.approval === "approved" ? "unapprove" : "approve")}>{detail.approval === "approved" ? "Remove approval" : "Approve asset"}</button>}{onChoose && attachableAsset(detail) && <button type="button" disabled={busy} className="orbit-button" onClick={() => { select(detail); details.current?.close(); }}>Toggle selection</button>}</div>{(data.admin || detail.createdBy === data.actorEmail) && <button type="button" className="orbit-text-button text-red-700" disabled={busy} onClick={() => void remove(detail)}>Delete from Orbit</button>}</form>
    </>}</dialog>
  </div>;
}
