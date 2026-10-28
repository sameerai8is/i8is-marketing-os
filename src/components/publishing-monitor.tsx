"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadJSON, responseJSON } from "@/lib/client-api";

interface Delivery { id: string; postId: string; title: string; platform: string; channelName: string; state: string; providerId?: string; providerStatus?: string; externalLink?: string; mode: string; dueAt?: string; sentAt?: string; checkedAt?: string; createdAt: string; error?: string; attempts: number; retryAfter?: string; requestedBy: string; history: { at: string; actor: string; action: string }[]; }
const labels: Record<string, string> = { prepared: "Ready to submit", submitting: "Submitting — awaiting confirmation", queued: "Accepted by Buffer", published: "Published", rejected: "Rejected before creation", uncertain: "Send unconfirmed — check Buffer", failed: "Delivery failed in Buffer", attention: "Needs attention in Buffer", cancelling: "Cancelling — awaiting confirmation", cancel_uncertain: "Cancellation unconfirmed", cancelled: "Cancelled / returned to draft" };
export function PublishingMonitor() {
  const post = useSearchParams().get("post"), [page, setPage] = useState(1), [data, setData] = useState<{ items: Delivery[]; count: number; admin: boolean; dailyChecksConfigured: boolean } | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [linked, setLinked] = useState<Record<string, string>>({});
  const load = useCallback(async () => { setData(await loadJSON(`/api/publishing/deliveries?page=${page}${post ? `&post=${encodeURIComponent(post)}` : ""}`)); }, [page, post]);
  useEffect(() => { setError(""); void load().catch(e => setError(e.message)); }, [load]);
  async function action(d: Delivery, action: string) {
    if (action === "cancel" && !window.confirm(d.state === "queued" ? `Cancel “${d.title}” in Buffer?` : "Return this request to draft for a fresh review?")) return;
    if (action === "retry" && !window.confirm(`Retry creating “${d.title}” on ${d.channelName}? Buffer confirmed no post was created on the previous attempt.`)) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/publishing/deliveries/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, providerId: linked[d.id] }) });
      const updated = await responseJSON(r); setData(current => current ? { ...current, items: current.items.map(x => x.id === d.id ? updated : x) } : current);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="orbit-team orbit-publishing"><div className="mission-header"><div><h1>Publishing monitor</h1><p>Track the requests you send to Buffer and confirm their delivery.</p></div><Link className="orbit-button orbit-button-dark" href="/calendar">Open Planner</Link></div>
    <p className="orbit-team-note">Buffer handles scheduled delivery even when Orbit is closed. {data?.dailyChecksConfigured ? "Orbit checks up to 20 due requests each day; administrators can check a request below at any time." : "Daily monitoring is not configured. Administrators can check each request below."} Statuses show the last confirmed response.</p>
    {post && <p className="orbit-team-note">Showing this post’s history. <Link href="/publishing">View all requests</Link></p>}
    <div className="orbit-toolbar my-5"><button className="orbit-button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Refresh saved history</button><a href="https://publish.buffer.com" target="_blank" rel="noreferrer" className="orbit-text-button">Open Buffer ↗</a><span className="orbit-team-note">{data ? `${data.count} request${data.count === 1 ? "" : "s"}` : "Loading..."}</span></div>
    {error && <p role="alert" className="orbit-login-alert">{error}</p>}
    {data?.items.length === 0 && <section className="orbit-surface p-6"><h2>No publishing requests yet</h2><p className="orbit-team-note mt-2">Create a post in Planner, submit it for approval, then an administrator can select a Buffer profile and confirm publishing. Existing planner-only schedules are not sent automatically.</p></section>}
    <div className="orbit-delivery-grid">{data?.items.map(d => <article key={d.id} className="orbit-surface p-5 orbit-delivery-card"><div className="orbit-toolbar justify-between"><span className={`orbit-badge ${d.state === "published" ? "orbit-badge-blue" : "orbit-badge-amber"}`}>{labels[d.state] || "Needs review"}</span><small>{d.platform}</small></div><h2 className="mt-4 font-semibold">{d.title}</h2><p className="orbit-team-note">Profile: {d.channelName}<br />Requested by: {d.requestedBy}<br />Attempts: {d.attempts}/3</p><dl className="orbit-delivery-times"><dt>Requested</dt><dd><time dateTime={d.createdAt}>{new Date(d.createdAt).toLocaleString()}</time></dd>{d.dueAt && <><dt>Buffer due time</dt><dd><time dateTime={d.dueAt}>{new Date(d.dueAt).toLocaleString()}</time></dd></>}{d.sentAt && <><dt>Published</dt><dd><time dateTime={d.sentAt}>{new Date(d.sentAt).toLocaleString()}</time></dd></>}<dt>Last provider check</dt><dd>{d.checkedAt ? new Date(d.checkedAt).toLocaleString() : "Not confirmed yet"}</dd></dl>
      {d.providerId && <p className="orbit-team-note">Buffer post ID: <code>{d.providerId}</code>{d.providerStatus && <> · {d.providerStatus}</>}</p>}{d.error && <p className="orbit-login-alert">{d.error}</p>}
      {d.state === "uncertain" && <p className="orbit-login-alert">A timeout can happen after Buffer creates a post. Another send is blocked to prevent duplicates. Inspect Buffer and link its matching post ID below. If you cannot find it, keep this request locked and investigate with Buffer support.</p>}
      {d.state === "failed" && <p className="orbit-team-note">Buffer accepted this post but could not deliver it. Fix or retry the existing post in Buffer, then check status here. Orbit will not create another copy.</p>}
      {d.state === "attention" && <p className="orbit-team-note">Review the post’s approval or draft state in Buffer. Orbit has not confirmed delivery.</p>}
      <div className="orbit-toolbar mt-4"><Link className="orbit-text-button" href={`/calendar?post=${d.postId}`}>Open post</Link>{d.externalLink && d.state === "published" && <a href={d.externalLink} target="_blank" rel="noreferrer" className="orbit-text-button">View published post ↗</a>}{data.admin && (d.providerId || ["submitting", "cancelling", "published", "cancelled"].includes(d.state)) && <button className="orbit-button" disabled={busy} onClick={() => void action(d, "refresh")}>{["cancelled", "published"].includes(d.state) ? "Sync saved post" : "Check Buffer status"}</button>}
      {data.admin && ["prepared", "rejected"].includes(d.state) && <><button className="orbit-button" disabled={busy || d.attempts >= 3 || (!!d.retryAfter && Date.parse(d.retryAfter) > Date.now())} onClick={() => void action(d, "retry")}>Retry submission</button><button className="orbit-text-button" disabled={busy} onClick={() => void action(d, "cancel")}>Return to draft</button></>}
      {data.admin && d.state === "queued" && <button className="orbit-text-button" disabled={busy} onClick={() => void action(d, "cancel")}>Cancel in Buffer</button>}</div>
      {d.state === "rejected" && d.retryAfter && <p className="orbit-team-note">Retry after {new Date(d.retryAfter).toLocaleString()}. Refresh saved history after the cooldown.</p>}
      {data.admin && d.state === "uncertain" && <div className="orbit-fact"><label>Matching Buffer post ID<input value={linked[d.id] || ""} disabled={busy} onChange={e => setLinked(c => ({ ...c, [d.id]: e.target.value }))} maxLength={200} /></label><button className="orbit-button" disabled={busy || !linked[d.id]} onClick={() => void action(d, "reconcile")}>Verify and link existing post</button></div>}
      <details className="orbit-fact"><summary>Request history</summary>{d.history.map((h, i) => <p key={i} className="orbit-team-note">{h.action}<br />{new Date(h.at).toLocaleString()} · {h.actor}</p>)}</details>
    </article>)}</div>
    {data && data.count > 24 && <div className="orbit-toolbar mt-5"><button className="orbit-button" disabled={busy || page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button className="orbit-button" disabled={busy || page * 24 >= data.count} onClick={() => setPage(p => p + 1)}>Next</button></div>}
  </div>;
}
