"use client";
import { useCallback, useEffect, useState } from "react";
import { loadJSON, responseJSON } from "@/lib/client-api";
import type { ReviewType } from "@/lib/review-policy";
interface Thread {
  assignedTo?: string;
  comments: { id: string; actor: string; text: string; version: string; createdAt: string; resolvedAt?: string; resolvedBy?: string }[];
  decisions: { action: string; actor: string; version: string; createdAt: string }[];
}
export function ReviewDiscussion({ type, id, version, disabled = false, onBusyChange }: { type: ReviewType; id: string; version: string; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [thread, setThread] = useState<Thread | null>(null), [reviewers, setReviewers] = useState<{ email: string; name: string }[]>([]);
  const [admin, setAdmin] = useState(false), [actor, setActor] = useState(""), [text, setText] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [stale, setStale] = useState(false);
  useEffect(() => { onBusyChange?.(busy || loading); }, [busy, loading, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const path = `/api/reviews/${type}/${id}`;
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const d = await loadJSON(path); setThread(d.thread); setReviewers(d.reviewers); setAdmin(d.admin); setActor(d.actorEmail); setStale(d.version !== version); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [path, version]);
  useEffect(() => { void load(); }, [load]);
  async function send(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try { const d = await responseJSON(await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, version }) })); setThread(d.thread); if (body.action === "comment") setText(""); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="orbit-fact mt-5" aria-label="Review discussion"><div className="orbit-toolbar justify-between"><h3 className="font-semibold">Review and feedback</h3><button type="button" className="orbit-text-button" disabled={disabled || busy || loading} onClick={() => void load()}>Refresh discussion</button></div>
    {error && <p role="alert" className="orbit-login-alert">{error}</p>}{stale && <p role="alert" className="orbit-login-alert">This item has a newer saved version. Reload the item before leaving feedback or making a decision.</p>}
    {loading ? <p role="status">Loading discussion...</p> : <>
      <label className="orbit-review-assignment">Assigned reviewer<select aria-label="Assigned reviewer" disabled={disabled || !admin || busy || stale} value={thread?.assignedTo || ""} onChange={e => void send({ action: "assign", email: e.target.value })}><option value="">Any administrator</option>{reviewers.map(r => <option key={r.email} value={r.email}>{r.name || r.email} ({r.email})</option>)}</select></label>{!admin && <p className="orbit-team-note">Administrators assign reviewers and make approval decisions.</p>}
      <div className="orbit-review-comments">{thread?.comments.map(c => <article key={c.id} className={`orbit-review-comment ${c.resolvedAt ? "is-resolved" : ""}`}><div className="orbit-toolbar justify-between"><strong>{c.actor}</strong><small>{new Date(c.createdAt).toLocaleString()}</small></div><p className="whitespace-pre-wrap">{c.text}</p><small className="orbit-team-note">{c.resolvedAt ? `Resolved by ${c.resolvedBy}` : "Open feedback"}{c.version !== version ? " | Earlier saved version" : ""}</small>{!c.resolvedAt && (admin || c.actor === actor) && <button type="button" className="orbit-text-button" disabled={disabled || busy || stale} onClick={() => void send({ action: "resolve", commentId: c.id })}>Resolve comment</button>}</article>)}{!thread?.comments.length && <p className="orbit-team-note">No feedback yet. Open comments must be resolved before approval.</p>}</div>
      <form className="orbit-composer-form" onSubmit={e => { e.preventDefault(); void send({ action: "comment", text }); }}><label>Add review feedback<textarea aria-label="Add review feedback" rows={3} maxLength={2000} required disabled={disabled || busy || stale} value={text} onChange={e => setText(e.target.value)} /></label><button className="orbit-button" disabled={disabled || busy || stale || !text.trim()}>{busy ? "Saving..." : "Add comment"}</button></form>
      {!!thread?.decisions.length && <details><summary>Approval history ({thread.decisions.length})</summary><ol className="orbit-review-history">{[...thread.decisions].reverse().map((d, i) => <li key={i}><strong>{d.action}</strong> by {d.actor}<br /><small>{new Date(d.createdAt).toLocaleString()} | Reviewed saved version {new Date(d.version).toLocaleString()}</small></li>)}</ol><p className="orbit-team-note">The latest 100 decisions are shown. Older decision events remain in the workspace audit log.</p></details>}
    </>}
  </section>;
}
