"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublishPost } from "./publish-post";
import { AssetLibrary } from "./asset-library";
import { type LibraryAsset, attachableAsset } from "@/lib/asset-types";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { platforms } from "@/lib/content-policy";
import { loadJSON, responseJSON } from "@/lib/client-api";

interface Post { publishingId?: string; _id: string; title: string; body: string; platform: string; status: string; scheduledAt?: string; plannedAt?: string; campaignId?: string; updatedAt: string; sourceFacts?: { text: string; source: string }[]; assetIds?: string[]; attachments?: LibraryAsset[]; }
const calendarDate = (p: Post) => p.scheduledAt ? new Date(p.scheduledAt) : p.plannedAt ? new Date(p.plannedAt + "T12:00:00") : null;
const labels: Record<string, string> = { draft: "Draft", pending_approval: "Awaiting approval", approved: "Approved", scheduled: "Scheduled · simulation", published: "Published", failed: "Failed" };
export function ContentPlanner({ initialItems, initialError, admin }: { initialItems: Post[]; initialError: string; admin: boolean }) {
  const [items, setItems] = useState(initialItems), [error, setError] = useState(initialError), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [cursor, setCursor] = useState(() => new Date()), [view, setView] = useState("month");
  const [channel, setChannel] = useState(""), [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Post | null>(null), [title, setTitle] = useState(""), [body, setBody] = useState(""), [platform, setPlatform] = useState("linkedin"), [scheduledAt, setScheduledAt] = useState("");
  const [plannedAt, setPlannedAt] = useState(""), [calendarMounted, setCalendarMounted] = useState(false);
  useEffect(() => setCalendarMounted(true), []);
  const editor = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLDialogElement>(null);
  const [attachments, setAttachments] = useState<LibraryAsset[]>([]), [picking, setPicking] = useState(false);
  const searchParams = useSearchParams(), initialAsset = searchParams.get("asset");
  const [prompt, setPrompt] = useState("");
  const [knowledge, setKnowledge] = useState<{ companyName: string; marketingGoal: string; facts: { text: string; source: string }[] } | null>(null), [knowledgeError, setKnowledgeError] = useState("");
  const [aiConfigured, setAiConfigured] = useState(false);
  const loadKnowledge = useCallback(async () => { setKnowledgeError(""); try { const d = await loadJSON("/api/workspace"); setKnowledge(d.settings); setAiConfigured(d.capabilities.textGeneration); } catch (e) { setKnowledgeError((e as Error).message); } }, []);
  useEffect(() => { void loadKnowledge(); }, [loadKnowledge]);
  const initialBrief = searchParams.get("brief");
  const initialPost = searchParams.get("post"), campaign = searchParams.get("campaign");
  useEffect(() => {
    if (!initialPost) return; const controller = new AbortController();
    void loadJSON(`/api/content/${encodeURIComponent(initialPost)}`, controller.signal).then((p: Post) => { setSelected(p); setTitle(p.title); setBody(p.body); setPlatform(p.platform); setAttachments(p.attachments || []); setPlannedAt(p.plannedAt || ""); setScheduledAt(p.scheduledAt ? format(new Date(p.scheduledAt), "yyyy-MM-dd'T'HH:mm") : ""); const date = calendarDate(p); if (date) setCursor(date); editor.current?.showModal(); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [initialPost]);
  const compose = searchParams.get("compose");
  useEffect(() => { if (compose === "1") editor.current?.showModal(); }, [compose]);
  useEffect(() => { if (!initialBrief) return; setSelected(null); setPlannedAt(""); setTitle(""); setBody(""); setPlatform("linkedin"); setAttachments([]); setScheduledAt(""); setPrompt(initialBrief.slice(0, 1000)); editor.current?.showModal(); }, [initialBrief]);
  useEffect(() => {
    if (!initialAsset) return;
    const controller = new AbortController();
    fetch(`/api/assets/${encodeURIComponent(initialAsset)}`, { cache: "no-store", signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Asset could not be opened."); return data as LibraryAsset; }).then(asset => {
      if (!attachableAsset(asset)) throw new Error("Import the Drive file or upload a supported image, video, or PDF first.");
      setSelected(null); setPlannedAt(""); setTitle(""); setBody(""); setPlatform("linkedin"); setScheduledAt(""); setAttachments([asset]); editor.current?.showModal();
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [initialAsset]);
  const load = useCallback(async () => {
    setItems(await loadJSON("/api/content"));
  }, []);
  function open(post: Post | null) {
    setSelected(post); setPlannedAt(post?.plannedAt || ""); setTitle(post?.title || ""); setBody(post?.body || ""); setPlatform(post?.platform || "linkedin"); setError(""); setMessage("");
    setScheduledAt(post?.scheduledAt ? format(new Date(post.scheduledAt), "yyyy-MM-dd'T'HH:mm") : "");
    setAttachments(post?.attachments || []); setPrompt("");
    editor.current?.showModal();
  }
  async function mutate(action: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch(selected ? `/api/content/${selected._id}` : "/api/content", { method: action === "delete" ? "DELETE" : selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, title, body, platform, plannedAt, assetIds: attachments.map(a => a.id), updatedAt: selected?.updatedAt, ...(action === "schedule" && scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}) }) });
      const data = await responseJSON(r);
      if (action === "delete") { setItems(current => current.filter(p => p._id !== selected?._id)); editor.current?.close(); }
      else { setSelected(data); setTitle(data.title); setBody(data.body); setPlatform(data.platform); setPlannedAt(data.plannedAt || ""); setAttachments(data.attachments || []); }
      if (action !== "delete") setItems(current => [data, ...current.filter(p => p._id !== data._id)]);
      setMessage(action === "schedule" ? "Schedule saved in simulation mode. No post will be sent to a social account." : action === "save" ? "Draft saved. Edits require a fresh approval." : "Post updated.");
      void load().catch(() => setMessage("Your post was saved. The list could not refresh; use Refresh posts to retry."));
    } catch (e) { setError(e instanceof Error ? e.message : "The post could not be saved."); }
    finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/content/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, platform, assetIds: attachments.map(a => a.id) }) });
      const data = await responseJSON(r);
      setSelected(data); setTitle(data.title); setBody(data.body); setPlatform(data.platform); setPlannedAt(data.plannedAt || ""); setAttachments(data.attachments || []);
      setItems(current => [data, ...current.filter(p => p._id !== data._id)]);
      setMessage("AI draft saved with source references. Review every claim before submitting for approval.");
      void load().catch(() => setMessage("AI draft saved and filled into the editor. The post list could not refresh; retry Refresh posts later."));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const filtered = items.filter(p => (!campaign || p.campaignId === campaign) && (!channel || p.platform === channel) && (!status || p.status === status));
  const start = startOfWeek(view === "month" ? startOfMonth(cursor) : cursor, { weekStartsOn: 1 });
  const end = endOfWeek(view === "month" ? endOfMonth(cursor) : cursor, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  const agendaDays = days.filter(day => filtered.some(p => calendarDate(p) && isSameDay(calendarDate(p)!, day)));
  const editable = !selected || (!selected.publishingId && !["published", "failed"].includes(selected.status));
  const dirty = selected && (title !== selected.title || body !== selected.body || platform !== selected.platform || plannedAt !== (selected.plannedAt || "") || JSON.stringify(attachments.map(a => a.id)) !== JSON.stringify(selected.assetIds || []));
  function card(post: Post) { return <button key={post._id} className={`orbit-post-card post-${post.status}`} onClick={() => open(post)}><small>{post.platform} · {post.status === "scheduled" && !post.publishingId ? "Planned - not submitted" : labels[post.status]}</small>{post.attachments?.find(a => a.previewUrl)?.previewUrl && <Image src={post.attachments.find(a => a.previewUrl)!.previewUrl!} width={160} height={90} unoptimized alt="" className="orbit-post-card-thumb" />}<strong>{post.title}</strong>{!!post.assetIds?.length && <small>{post.assetIds.length} attached asset{post.assetIds.length === 1 ? "" : "s"}</small>}{!post.scheduledAt && post.plannedAt && <small>Proposed date: {post.plannedAt}</small>}{post.scheduledAt && <time dateTime={post.scheduledAt}>{format(new Date(post.scheduledAt), "p")}</time>}</button>; }
  return <div className="orbit-team orbit-planner">
    <div className="mission-header"><div><h1>Your content, from draft to approval.</h1><p>Compose, review, and plan posts across your channels.</p></div><button className="orbit-button orbit-button-dark" onClick={() => open(null)}>+ New post</button></div>
    <p className="orbit-login-alert">Publishing is simulated. Scheduled posts stay in this planner; they will not be sent to Buffer. Times use your browser’s timezone.</p>
    {campaign && <p className="orbit-team-note">Viewing campaign posts. <Link href="/calendar">Show all posts</Link></p>}
    {!editor.current?.open && error && <p role="alert" className="orbit-login-alert">{error}</p>}
    <div className="orbit-toolbar my-5"><select aria-label="Filter channel" value={channel} onChange={e => setChannel(e.target.value)}><option value="">All channels</option>{platforms.map(p => <option key={p} value={p}>{p}</option>)}</select><select aria-label="Filter post status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(labels).map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select><button className="orbit-text-button" disabled={busy} onClick={async () => { try { setError(""); await load(); } catch (e) { setError((e as Error).message); } }}>Refresh posts</button></div>
    {calendarMounted ? <section className="orbit-surface p-4"><div className="orbit-toolbar justify-between mb-4"><div className="orbit-toolbar"><button aria-label={`Previous ${view}`} className="orbit-button" onClick={() => setCursor(view === "month" ? addMonths(cursor, -1) : addWeeks(cursor, -1))}>←</button><h2>{view === "month" ? format(cursor, "MMMM yyyy") : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`}</h2><button aria-label={`Next ${view}`} className="orbit-button" onClick={() => setCursor(view === "month" ? addMonths(cursor, 1) : addWeeks(cursor, 1))}>→</button></div><div className="orbit-toolbar"><button className="orbit-text-button" onClick={() => setCursor(new Date())}>Today</button>{["week", "month"].map(v => <button key={v} aria-pressed={view === v} className={`orbit-button ${view === v ? "orbit-button-dark" : ""}`} onClick={() => setView(v)}>{v}</button>)}</div></div>
      <div className="orbit-calendar-scroll"><div className="orbit-calendar-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div className="orbit-calendar-heading" key={d}>{d}</div>)}{days.map(day => <div key={day.toISOString()} className={`orbit-calendar-day ${isSameMonth(day, cursor) ? "" : "is-outside"} ${isSameDay(day, new Date()) ? "is-today" : ""}`}><span>{format(day, "d")}</span>{filtered.filter(p => calendarDate(p) && isSameDay(calendarDate(p)!, day)).map(card)}</div>)}</div></div>
      <div className="orbit-calendar-agenda" aria-label="Scheduled posts for this period"><p className="orbit-team-note">Agenda · {view === "month" ? "month" : "week"} view</p>{agendaDays.map(day => <section key={day.toISOString()} className="orbit-agenda-day"><h3><time dateTime={format(day, "yyyy-MM-dd")}>{format(day, "EEEE, MMMM d")}</time>{isSameDay(day, new Date()) && <span className="orbit-badge orbit-badge-blue">Today</span>}</h3>{filtered.filter(p => calendarDate(p) && isSameDay(calendarDate(p)!, day)).map(card)}</section>)}{!agendaDays.length && <p className="orbit-team-empty">No scheduled posts in this period. Your unscheduled posts are below.</p>}</div>
    </section> : <section className="orbit-surface p-5" role="status">Loading calendar in your timezone...</section>}
    <section className="orbit-surface p-5 mt-6"><h2>Drafts and review queue</h2><p className="orbit-team-note mt-1">Unscheduled posts appear here. Open a post to edit or review it.</p><div className="orbit-draft-list mt-4">{filtered.filter(p => !p.scheduledAt).map(card)}</div>{!filtered.some(p => !p.scheduledAt) && <p className="orbit-team-empty">No unscheduled posts match this view. Create your first draft above.</p>}</section>
    <p className="orbit-team-note mt-4">Showing up to the 500 most recently updated posts.</p>
    <dialog ref={editor} className="orbit-composer" aria-labelledby="composer-heading" onCancel={e => { if (busy) e.preventDefault(); }}><div className="orbit-toolbar justify-between"><h2 id="composer-heading">{selected ? "Review your post" : "Create a post"}</h2><button disabled={busy} aria-label="Close composer" className="orbit-text-button" onClick={() => editor.current?.close()}>Close ✕</button></div>
      <div aria-live="polite">{error && <p role="alert" className="orbit-login-alert">{error}</p>}{message && <p role="status" className="orbit-team-success">{message}</p>}{busy && <p role="status" className="orbit-team-note">Working on your post. AI generation can take up to a minute; the draft will appear below.</p>}</div>
      <form onSubmit={e => { e.preventDefault(); void mutate("save"); }} className="orbit-composer-form">{!selected && <fieldset className="orbit-fact"><legend>Start with an AI draft, or write your own below</legend>
      {knowledgeError ? <p className="orbit-login-alert">{knowledgeError} <button type="button" className="orbit-text-button" onClick={() => void loadKnowledge()}>Retry company knowledge</button></p> : !knowledge ? <p role="status">Loading company knowledge...</p> : !knowledge.facts.length ? <p className="orbit-login-alert">AI needs at least one reviewed company fact. <Link href="/company-brain">Open Company DNA to review website findings or add a fact</Link> You can save a manual post below now. <button type="button" className="orbit-text-button" onClick={() => void loadKnowledge()}>Check again</button></p> : <><p className="orbit-team-note">{knowledge.facts.length} reviewed company facts available. Choose a suggested brief or write your own.</p><div className="orbit-toolbar">{[...(knowledge.marketingGoal ? [`Create a post toward this goal: ${knowledge.marketingGoal}. Use only reviewed company facts and end with a relevant call to action.`] : []), ...knowledge.facts.slice(0, 3).map(f => `Explain this reviewed company fact for our audience: ${f.text}. Use a clear opening and a relevant call to action.`)].map((brief, i) => <button type="button" key={i} disabled={busy} className="orbit-button" onClick={() => setPrompt(brief.slice(0, 1000))}>{knowledge.marketingGoal && i === 0 ? "Use marketing goal" : `Explain fact ${knowledge.marketingGoal ? i : i + 1}`}</button>)}</div></>}
      <label>What should this post achieve?<textarea maxLength={1000} rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} disabled={busy} placeholder="Choose a suggestion above, or describe the goal and desired call to action" /></label><button type="button" disabled={busy || !prompt.trim() || !knowledge?.facts.length || !aiConfigured} className="orbit-button orbit-button-lime" onClick={() => void generate()}>{busy ? "Working..." : "Generate from verified company facts"}</button>{knowledge && !aiConfigured && <p className="orbit-login-alert">AI generation is not configured. An administrator must configure the provider.</p>}<p className="orbit-team-note">Generation fills the title, post text, preview and references, and saves a draft for review.</p></fieldset>}<label>Title<input required maxLength={200} value={title} disabled={!editable || busy} onChange={e => setTitle(e.target.value)} /></label><label>Channel<select value={platform} disabled={!editable || busy} onChange={e => setPlatform(e.target.value)}>{platforms.map(p => <option value={p} key={p}>{p}</option>)}</select></label><label>Proposed calendar date (optional)<input aria-label="Proposed calendar date" type="date" disabled={!editable || busy} value={plannedAt} onChange={e => setPlannedAt(e.target.value)} /></label><p className="orbit-team-note">A proposed date places a draft on the calendar. Publishing still needs approval and a separate schedule.</p><label>Post text<textarea aria-label="Post text" required rows={7} maxLength={10000} value={body} disabled={!editable || busy} onChange={e => setBody(e.target.value)} /></label><p className="orbit-team-note">{body.length} characters · Check each social channel’s limits before publishing.</p>
      <fieldset className="orbit-fact"><legend>Graphics and attachments · {attachments.length}/10</legend><div className="orbit-toolbar">{editable && <button type="button" className="orbit-button" disabled={busy} onClick={() => { setPicking(true); picker.current?.showModal(); }}>Choose / upload assets</button>}<Link href="/assets" className="orbit-text-button" target="_blank">Open full asset library ↗</Link></div>{attachments.length ? <div className="orbit-attachment-list">{attachments.map((asset, index) => <article key={asset.id}>{asset.previewUrl ? <Image src={asset.previewUrl} width={120} height={90} alt={asset.altText || asset.name} unoptimized /> : <span className="orbit-attachment-type">{asset.kind}</span>}<div><strong>{index + 1}. {asset.name}</strong><small>{asset.approval === "approved" ? "Approved" : "Needs asset approval"}{asset.altText ? " · alt text added" : " · add alt text in Assets"}</small>{editable && <div className="orbit-toolbar"><button type="button" disabled={busy || index === 0} className="orbit-text-button" onClick={() => setAttachments(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>Move earlier</button><button type="button" disabled={busy} className="orbit-text-button" onClick={() => setAttachments(current => current.filter(a => a.id !== asset.id))}>Remove</button></div>}</div></article>)}</div> : <p className="orbit-team-note">Add an image, a set of graphics, a video, or a PDF. Source files and Drive folders stay in Assets.</p>}</fieldset>
      <div className="orbit-post-preview"><small>{platform} preview</small><strong>{knowledge?.companyName || "Your company"}</strong><p>{body || "Your post preview will appear here."}</p>{!!attachments.length && <div className="orbit-post-media">{attachments.map(a => a.previewUrl ? <Image key={a.id} src={a.previewUrl} width={640} height={480} unoptimized alt={a.altText || a.name} /> : a.kind === "video" && a.fileUrl ? <video key={a.id} src={a.fileUrl} controls preload="metadata" /> : <a key={a.id} href={`${a.fileUrl}?download=1`}>{a.name} · download PDF</a>)}</div>}<p className="orbit-team-note mt-3">Layout preview only. Live publishing validates supported text and JPG/PNG attachments; the social network controls the final rendering.</p></div>
      {selected && <Link className="orbit-text-button" href={`/approvals?type=post&id=${selected._id}`}>Open review discussion and approval history</Link>}
      {!!selected?.sourceFacts?.length && <details className="orbit-fact"><summary>Source references used for this AI draft</summary>{selected.sourceFacts.map((f, i) => <p className="orbit-team-note" key={i}>{f.text}<br />Source: {f.source}</p>)}<p className="orbit-team-note">Edits may introduce claims beyond these references. Approval requires a fresh review.</p></details>}
      {error && <p role="alert" className="orbit-login-alert">{error}</p>}{message && <p role="status" className="orbit-team-success">{message}</p>}
      <div className="orbit-toolbar">{editable && <button disabled={busy} className="orbit-button orbit-button-dark" type="submit">{busy ? "Saving…" : "Save draft"}</button>}{selected?.status === "draft" && <button type="button" disabled={busy || Boolean(dirty)} className="orbit-button" onClick={() => void mutate("submit")}>Submit for approval</button>}{admin && selected?.status === "pending_approval" && <><button type="button" disabled={busy || Boolean(dirty)} className="orbit-button orbit-button-lime" onClick={() => void mutate("approve")}>Approve</button><button type="button" disabled={busy || Boolean(dirty)} className="orbit-text-button" onClick={() => void mutate("reject")}>Request changes</button></>}</div>
      {selected?.publishingId ? <p className="orbit-login-alert">This post has a publishing request and is locked for delivery. <Link href={`/publishing?post=${selected._id}`}>Open Publishing Monitor to check status or cancel a queued post</Link></p> : admin && selected && ["approved", "scheduled"].includes(selected.status) && <PublishPost key={selected._id} post={selected} disabled={busy || Boolean(dirty)} onBusyChange={setBusy} onPublished={async () => { const p = await loadJSON(`/api/content/${selected._id}`); setSelected(p); await load(); }} />}
      {dirty && <p className="orbit-team-note">Save your edits before submitting, approving, or scheduling.</p>}
      {selected && !selected.publishingId && (selected.status === "draft" || admin) && <button type="button" disabled={busy} className="orbit-text-button text-red-700" onClick={() => { if (window.confirm("Delete this post permanently?")) void mutate("delete"); }}>Delete post</button>}
      </form>
    </dialog>
    <dialog ref={picker} className="orbit-asset-picker-dialog" aria-label="Choose assets for this post" onClose={() => setPicking(false)}><button className="orbit-text-button orbit-picker-close" onClick={() => picker.current?.close()}>Close asset picker ✕</button>{picking && <AssetLibrary initialSelection={attachments} onChoose={assets => { setAttachments(assets); picker.current?.close(); }} />}</dialog>
  </div>;
}
