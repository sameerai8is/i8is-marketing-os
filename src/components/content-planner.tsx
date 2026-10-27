"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AssetLibrary } from "./asset-library";
import { type LibraryAsset, attachableAsset } from "@/lib/asset-types";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { platforms } from "@/lib/content-policy";

interface Post { _id: string; title: string; body: string; platform: string; status: string; scheduledAt?: string; updatedAt: string; sourceFacts?: { text: string; source: string }[]; assetIds?: string[]; attachments?: LibraryAsset[]; }
const labels: Record<string, string> = { draft: "Draft", pending_approval: "Awaiting approval", approved: "Approved", scheduled: "Scheduled · simulation", published: "Published", failed: "Failed" };
export function ContentPlanner({ initialItems, initialError, admin }: { initialItems: Post[]; initialError: string; admin: boolean }) {
  const [items, setItems] = useState(initialItems), [error, setError] = useState(initialError), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [cursor, setCursor] = useState(() => new Date()), [view, setView] = useState("month");
  const [channel, setChannel] = useState(""), [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Post | null>(null), [title, setTitle] = useState(""), [body, setBody] = useState(""), [platform, setPlatform] = useState("linkedin"), [scheduledAt, setScheduledAt] = useState("");
  const editor = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLDialogElement>(null);
  const [attachments, setAttachments] = useState<LibraryAsset[]>([]), [picking, setPicking] = useState(false);
  const searchParams = useSearchParams(), initialAsset = searchParams.get("asset");
  const [prompt, setPrompt] = useState("");
  const initialBrief = searchParams.get("brief");
  useEffect(() => { if (!initialBrief) return; setSelected(null); setTitle(""); setBody(""); setPlatform("linkedin"); setAttachments([]); setScheduledAt(""); setPrompt(initialBrief.slice(0, 1000)); editor.current?.showModal(); }, [initialBrief]);
  useEffect(() => {
    if (!initialAsset) return;
    const controller = new AbortController();
    fetch(`/api/assets/${encodeURIComponent(initialAsset)}`, { cache: "no-store", signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Asset could not be opened."); return data as LibraryAsset; }).then(asset => {
      if (!attachableAsset(asset)) throw new Error("Import the Drive file or upload a supported image, video, or PDF first.");
      setSelected(null); setTitle(""); setBody(""); setPlatform("linkedin"); setScheduledAt(""); setAttachments([asset]); editor.current?.showModal();
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [initialAsset]);
  const load = useCallback(async () => {
    const r = await fetch("/api/content", { cache: "no-store" });
    if (!r.ok) throw new Error("Posts could not be loaded. Your session may have expired; refresh or sign in again.");
    setItems(await r.json());
  }, []);
  function open(post: Post | null) {
    setSelected(post); setTitle(post?.title || ""); setBody(post?.body || ""); setPlatform(post?.platform || "linkedin"); setError(""); setMessage("");
    setScheduledAt(post?.scheduledAt ? format(new Date(post.scheduledAt), "yyyy-MM-dd'T'HH:mm") : "");
    setAttachments(post?.attachments || []); setPrompt("");
    editor.current?.showModal();
  }
  async function mutate(action: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch(selected ? `/api/content/${selected._id}` : "/api/content", { method: action === "delete" ? "DELETE" : selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, title, body, platform, assetIds: attachments.map(a => a.id), updatedAt: selected?.updatedAt, ...(action === "schedule" && scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "The post could not be saved.");
      await load();
      if (action === "delete") editor.current?.close();
      else { setSelected(data); setTitle(data.title); setBody(data.body); setPlatform(data.platform); setAttachments(data.attachments || []); }
      setMessage(action === "schedule" ? "Schedule saved in simulation mode. No post will be sent to a social account." : action === "save" ? "Draft saved. Edits require a fresh approval." : "Post updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "The post could not be saved."); }
    finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/content/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, platform, assetIds: attachments.map(a => a.id) }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "AI generation failed.");
      await load(); setSelected(data); setTitle(data.title); setBody(data.body); setPlatform(data.platform); setAttachments(data.attachments || []);
      setMessage("AI draft saved with source references. Review every claim before submitting for approval.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const filtered = items.filter(p => (!channel || p.platform === channel) && (!status || p.status === status));
  const start = startOfWeek(view === "month" ? startOfMonth(cursor) : cursor, { weekStartsOn: 1 });
  const end = endOfWeek(view === "month" ? endOfMonth(cursor) : cursor, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  const agendaDays = days.filter(day => filtered.some(p => p.scheduledAt && isSameDay(new Date(p.scheduledAt), day)));
  const editable = !selected || !["published", "failed"].includes(selected.status);
  const dirty = selected && (title !== selected.title || body !== selected.body || platform !== selected.platform || JSON.stringify(attachments.map(a => a.id)) !== JSON.stringify(selected.assetIds || []));
  function card(post: Post) { return <button key={post._id} className={`orbit-post-card post-${post.status}`} onClick={() => open(post)}><small>{post.platform} · {labels[post.status]}</small>{post.attachments?.find(a => a.previewUrl)?.previewUrl && <Image src={post.attachments.find(a => a.previewUrl)!.previewUrl!} width={160} height={90} unoptimized alt="" className="orbit-post-card-thumb" />}<strong>{post.title}</strong>{!!post.assetIds?.length && <small>{post.assetIds.length} attached asset{post.assetIds.length === 1 ? "" : "s"}</small>}{post.scheduledAt && <time dateTime={post.scheduledAt}>{format(new Date(post.scheduledAt), "p")}</time>}</button>; }
  return <div className="orbit-team orbit-planner">
    <div className="mission-header"><div><h1>Your content, from draft to approval.</h1><p>Compose, review, and plan posts across your channels.</p></div><button className="orbit-button orbit-button-dark" onClick={() => open(null)}>+ New post</button></div>
    <p className="orbit-login-alert">Publishing is simulated. Scheduled posts stay in this planner; they will not be sent to Buffer. Times use your browser’s timezone.</p>
    {!editor.current?.open && error && <p role="alert" className="orbit-login-alert">{error}</p>}
    <div className="orbit-toolbar my-5"><select aria-label="Filter channel" value={channel} onChange={e => setChannel(e.target.value)}><option value="">All channels</option>{platforms.map(p => <option key={p} value={p}>{p}</option>)}</select><select aria-label="Filter post status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(labels).map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select><button className="orbit-text-button" disabled={busy} onClick={async () => { try { setError(""); await load(); } catch (e) { setError((e as Error).message); } }}>Refresh posts</button></div>
    <section className="orbit-surface p-4"><div className="orbit-toolbar justify-between mb-4"><div className="orbit-toolbar"><button aria-label={`Previous ${view}`} className="orbit-button" onClick={() => setCursor(view === "month" ? addMonths(cursor, -1) : addWeeks(cursor, -1))}>←</button><h2>{view === "month" ? format(cursor, "MMMM yyyy") : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`}</h2><button aria-label={`Next ${view}`} className="orbit-button" onClick={() => setCursor(view === "month" ? addMonths(cursor, 1) : addWeeks(cursor, 1))}>→</button></div><div className="orbit-toolbar"><button className="orbit-text-button" onClick={() => setCursor(new Date())}>Today</button>{["week", "month"].map(v => <button key={v} aria-pressed={view === v} className={`orbit-button ${view === v ? "orbit-button-dark" : ""}`} onClick={() => setView(v)}>{v}</button>)}</div></div>
      <div className="orbit-calendar-scroll"><div className="orbit-calendar-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div className="orbit-calendar-heading" key={d}>{d}</div>)}{days.map(day => <div key={day.toISOString()} className={`orbit-calendar-day ${isSameMonth(day, cursor) ? "" : "is-outside"} ${isSameDay(day, new Date()) ? "is-today" : ""}`}><span>{format(day, "d")}</span>{filtered.filter(p => p.scheduledAt && isSameDay(new Date(p.scheduledAt), day)).map(card)}</div>)}</div></div>
      <div className="orbit-calendar-agenda" aria-label="Scheduled posts for this period"><p className="orbit-team-note">Agenda · {view === "month" ? "month" : "week"} view</p>{agendaDays.map(day => <section key={day.toISOString()} className="orbit-agenda-day"><h3><time dateTime={format(day, "yyyy-MM-dd")}>{format(day, "EEEE, MMMM d")}</time>{isSameDay(day, new Date()) && <span className="orbit-badge orbit-badge-blue">Today</span>}</h3>{filtered.filter(p => p.scheduledAt && isSameDay(new Date(p.scheduledAt), day)).map(card)}</section>)}{!agendaDays.length && <p className="orbit-team-empty">No scheduled posts in this period. Your unscheduled posts are below.</p>}</div>
    </section>
    <section className="orbit-surface p-5 mt-6"><h2>Drafts and review queue</h2><p className="orbit-team-note mt-1">Unscheduled posts appear here. Open a post to edit or review it.</p><div className="orbit-draft-list mt-4">{filtered.filter(p => !p.scheduledAt).map(card)}</div>{!filtered.some(p => !p.scheduledAt) && <p className="orbit-team-empty">No unscheduled posts match this view. Create your first draft above.</p>}</section>
    <p className="orbit-team-note mt-4">Showing up to the 500 most recently updated posts.</p>
    <dialog ref={editor} className="orbit-composer" aria-labelledby="composer-heading" onCancel={e => { if (busy) e.preventDefault(); }}><div className="orbit-toolbar justify-between"><h2 id="composer-heading">{selected ? "Review your post" : "Create a post"}</h2><button disabled={busy} aria-label="Close composer" className="orbit-text-button" onClick={() => editor.current?.close()}>Close ✕</button></div>
      <form onSubmit={e => { e.preventDefault(); void mutate("save"); }} className="orbit-composer-form">{!selected && <fieldset className="orbit-fact"><legend>Start with an AI draft</legend><label>What should this post achieve?<textarea maxLength={1000} rows={2} value={prompt} onChange={e => setPrompt(e.target.value)} disabled={busy} placeholder="Describe the goal and desired call to action" /></label><button type="button" disabled={busy || !prompt.trim()} className="orbit-button orbit-button-lime" onClick={() => void generate()}>{busy ? "Working…" : "Generate from verified company facts"}</button><p className="orbit-team-note">Add reviewed facts and sources in Company DNA first. You can also write a draft below.</p></fieldset>}<label>Title<input required maxLength={200} value={title} disabled={!editable || busy} onChange={e => setTitle(e.target.value)} /></label><label>Channel<select value={platform} disabled={!editable || busy} onChange={e => setPlatform(e.target.value)}>{platforms.map(p => <option value={p} key={p}>{p}</option>)}</select></label><label>Post text<textarea required rows={7} maxLength={10000} value={body} disabled={!editable || busy} onChange={e => setBody(e.target.value)} /></label><p className="orbit-team-note">{body.length} characters · Check each social channel’s limits before publishing.</p>
      <fieldset className="orbit-fact"><legend>Graphics and attachments · {attachments.length}/10</legend><div className="orbit-toolbar">{editable && <button type="button" className="orbit-button" disabled={busy} onClick={() => { setPicking(true); picker.current?.showModal(); }}>Choose / upload assets</button>}<Link href="/assets" className="orbit-text-button" target="_blank">Open full asset library ↗</Link></div>{attachments.length ? <div className="orbit-attachment-list">{attachments.map((asset, index) => <article key={asset.id}>{asset.previewUrl ? <Image src={asset.previewUrl} width={120} height={90} alt={asset.altText || asset.name} unoptimized /> : <span className="orbit-attachment-type">{asset.kind}</span>}<div><strong>{index + 1}. {asset.name}</strong><small>{asset.approval === "approved" ? "Approved" : "Needs asset approval"}{asset.altText ? " · alt text added" : " · add alt text in Assets"}</small>{editable && <div className="orbit-toolbar"><button type="button" disabled={busy || index === 0} className="orbit-text-button" onClick={() => setAttachments(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>Move earlier</button><button type="button" disabled={busy} className="orbit-text-button" onClick={() => setAttachments(current => current.filter(a => a.id !== asset.id))}>Remove</button></div>}</div></article>)}</div> : <p className="orbit-team-note">Add an image, a set of graphics, a video, or a PDF. Source files and Drive folders stay in Assets.</p>}</fieldset>
      <div className="orbit-post-preview"><small>{platform} preview</small><strong>I8IS</strong><p>{body || "Your post preview will appear here."}</p>{!!attachments.length && <div className="orbit-post-media">{attachments.map(a => a.previewUrl ? <Image key={a.id} src={a.previewUrl} width={640} height={480} unoptimized alt={a.altText || a.name} /> : a.kind === "video" && a.fileUrl ? <video key={a.id} src={a.fileUrl} controls preload="metadata" /> : <a key={a.id} href={`${a.fileUrl}?download=1`}>{a.name} · download PDF</a>)}</div>}<p className="orbit-team-note mt-3">Layout preview only. Channel-specific media checks and live publishing are not enabled.</p></div>
      {!!selected?.sourceFacts?.length && <details className="orbit-fact"><summary>Source references used for this AI draft</summary>{selected.sourceFacts.map((f, i) => <p className="orbit-team-note" key={i}>{f.text}<br />Source: {f.source}</p>)}<p className="orbit-team-note">Edits may introduce claims beyond these references. Approval requires a fresh review.</p></details>}
      {error && <p role="alert" className="orbit-login-alert">{error}</p>}{message && <p role="status" className="orbit-team-success">{message}</p>}
      <div className="orbit-toolbar">{editable && <button disabled={busy} className="orbit-button orbit-button-dark" type="submit">{busy ? "Saving…" : "Save draft"}</button>}{selected?.status === "draft" && <button type="button" disabled={busy || Boolean(dirty)} className="orbit-button" onClick={() => void mutate("submit")}>Submit for approval</button>}{admin && selected?.status === "pending_approval" && <><button type="button" disabled={busy || Boolean(dirty)} className="orbit-button orbit-button-lime" onClick={() => void mutate("approve")}>Approve</button><button type="button" disabled={busy || Boolean(dirty)} className="orbit-text-button" onClick={() => void mutate("reject")}>Request changes</button></>}</div>
      {admin && selected && ["approved", "scheduled"].includes(selected.status) && <div className="orbit-toolbar"><label>Schedule in your local time<input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} /></label><button type="button" disabled={busy || !scheduledAt || Boolean(dirty)} className="orbit-button" onClick={() => void mutate("schedule")}>Save simulated schedule</button>{selected.status === "scheduled" && <button type="button" disabled={busy || Boolean(dirty)} className="orbit-text-button" onClick={() => void mutate("unschedule")}>Unschedule</button>}</div>}
      {dirty && <p className="orbit-team-note">Save your edits before submitting, approving, or scheduling.</p>}
      {selected && (selected.status === "draft" || admin) && <button type="button" disabled={busy} className="orbit-text-button text-red-700" onClick={() => { if (window.confirm("Delete this post permanently?")) void mutate("delete"); }}>Delete post</button>}
      </form>
    </dialog>
    <dialog ref={picker} className="orbit-asset-picker-dialog" aria-label="Choose assets for this post" onClose={() => setPicking(false)}><button className="orbit-text-button orbit-picker-close" onClick={() => picker.current?.close()}>Close asset picker ✕</button>{picking && <AssetLibrary initialSelection={attachments} onChoose={assets => { setAttachments(assets); picker.current?.close(); }} />}</dialog>
  </div>;
}
