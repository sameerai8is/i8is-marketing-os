"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { DRIVE_SCOPES } from "@/lib/drive-policy";
import { loadJSON, responseJSON } from "@/lib/client-api";
import type { LibraryAsset } from "@/lib/asset-types";

interface DriveFile { id: string; name: string; mimeType: string; size?: string; capabilities?: { canDownload?: boolean }; }
export function DrivePanel({ onImported, onConnection }: { onImported: (asset: LibraryAsset) => void; onConnection: (connected: boolean) => void }) {
  const [connected, setConnected] = useState(false), [email, setEmail] = useState(""), [checking, setChecking] = useState(true), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [files, setFiles] = useState<DriveFile[]>([]), [next, setNext] = useState("");
  const [folders, setFolders] = useState([{ id: "root", name: "My Drive" }]), [search, setSearch] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const status = useCallback(async () => {
    setChecking(true); setError("");
    try { const d = await loadJSON("/api/drive"); setConnected(d.connected); setEmail(d.email); onConnection(d.connected); }
    catch (e) { setError((e as Error).message); }
    finally { setChecking(false); }
  }, [onConnection]);
  useEffect(() => { void status(); }, [status]);
  async function connect() {
    setBusy(true); setError("");
    try { await signIn("google", { redirectTo: "/assets?drive=connected" }, { scope: DRIVE_SCOPES, access_type: "offline", prompt: "consent", include_granted_scopes: "true" }); }
    catch { setError("Google Drive connection could not start. Please retry."); setBusy(false); }
  }
  async function browse(parent = folders.at(-1)!.id, q = search, pageToken = "") {
    setLoading(true); setError("");
    try { const d = await loadJSON(`/api/drive?${new URLSearchParams({ list: "1", parent, q, pageToken })}`); setFiles(current => pageToken ? [...current, ...d.files] : d.files); setNext(d.nextPageToken || ""); }
    catch (e) { setError((e as Error).message); setFiles([]); }
    finally { setLoading(false); }
  }
  async function importFile(file: DriveFile) {
    setBusy(true); setError(""); setMessage("");
    try {
      const asset = await responseJSON(await fetch("/api/drive/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: file.id }) }));
      onImported(asset); setMessage(`Imported ${asset.name}. It is now in the shared library and needs asset approval before post submission.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const notices = <div aria-live="polite">{error && <p role="alert" className="orbit-login-alert">{error}</p>}{message && <p role="status" className="orbit-team-success">{message}</p>}</div>;
  return <section className="orbit-surface p-4 my-4"><div className="orbit-toolbar justify-between"><div><h2>Google Drive</h2><p className="orbit-team-note">{checking ? "Checking your connection…" : connected ? `Connected as ${email}` : "Connect your own Google account to import private files and save upload copies."}</p></div><div className="orbit-toolbar"><button disabled={busy || checking} className="orbit-button" onClick={() => void connect()}>{connected ? "Reconnect Drive" : "Connect Google Drive"}</button>{connected && <><button disabled={busy} className="orbit-button orbit-button-dark" onClick={() => { dialog.current?.showModal(); void browse(); }}>Choose from Google Drive</button><button disabled={busy} className="orbit-text-button" onClick={async () => { setBusy(true); try { await responseJSON(await fetch("/api/drive", { method: "DELETE" })); setConnected(false); onConnection(false); setMessage("Disconnected from Orbit. Copies already imported remain in the shared library. You can revoke Google permissions in your Google account."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Disconnect</button></>}</div></div>
    <p className="orbit-team-note mt-2">Google will ask to read your Drive files and manage files created with Orbit. Only files you import are shared with this workspace. Upload copies are saved to your connected My Drive; originals and sharing permissions stay under your control.</p>{notices}{error && <button className="orbit-text-button" disabled={checking || busy} onClick={() => void status()}>Retry Drive connection</button>}
    <dialog ref={dialog} className="orbit-composer" aria-labelledby="drive-browser-heading" onCancel={e => { if (busy) e.preventDefault(); }}><div className="orbit-toolbar justify-between"><h2 id="drive-browser-heading">Choose a Google Drive file</h2><button className="orbit-text-button" disabled={busy} onClick={() => dialog.current?.close()}>Close Drive browser</button></div><p className="orbit-team-note mt-3">Import files up to 25 MB. Google Docs, Slides and Sheets are exported as PDF (Google limits exports to 10 MB). Imported copies become available to all active workspace members.</p>
      <form className="orbit-composer-form" onSubmit={e => { e.preventDefault(); void browse(); }}><label>Search your Drive<input maxLength={100} value={search} disabled={busy || loading} onChange={e => setSearch(e.target.value)} placeholder="Search by file name, including shared files" /></label><button className="orbit-button" disabled={busy || loading}>Search Drive</button></form>
      <div className="orbit-toolbar my-4">{folders.map((folder, i) => <button className="orbit-text-button" key={folder.id} disabled={busy || loading} onClick={() => { setFolders(folders.slice(0, i + 1)); setSearch(""); void browse(folder.id, ""); }}>{folder.name} /</button>)}</div>{notices}
      {loading && <p role="status">Loading Drive files…</p>}<div className="orbit-composer-form">{files.map(file => <article className="orbit-fact" key={file.id}><p className="break-all">{file.name}</p><small className="orbit-team-note">{file.mimeType.replace("application/vnd.google-apps.", "Google ")}{file.size ? ` · ${(Number(file.size) / 1048576).toFixed(1)} MB` : ""}</small><div className="orbit-toolbar mt-2">{file.mimeType === "application/vnd.google-apps.folder" ? <button className="orbit-button" disabled={busy || loading} onClick={() => { setFolders([...folders, { id: file.id, name: file.name }]); setSearch(""); void browse(file.id, ""); }}>Open folder</button> : <button className="orbit-button" disabled={busy || loading || file.capabilities?.canDownload === false || Number(file.size || 0) > 25 * 1048576} onClick={() => void importFile(file)}>{busy ? "Importing…" : "Import into shared library"}</button>}</div></article>)}</div>{!loading && !files.length && !error && <p className="orbit-team-note">No files found. Try a search or another folder.</p>}{next && <button className="orbit-button mt-4" disabled={loading || busy} onClick={() => void browse(undefined, undefined, next)}>Load more files</button>}
    </dialog></section>;
}
