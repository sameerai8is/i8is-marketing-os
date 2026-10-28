"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { loadJSON, responseJSON } from "@/lib/client-api";
import { ReviewDiscussion } from "./review-discussion";
import { StrategyPlanView } from "./strategy-plan";
import type { StrategyBrief, StrategyPlan } from "@/lib/strategy-policy";
import type { ReviewType } from "@/lib/review-policy";
interface Item { id: string; _id?: string; title?: string; name?: string; body?: string; platform?: string; status: string; approval?: string; updatedAt: string; feedback: boolean; assignedTo: string; brief?: StrategyBrief; plan?: StrategyPlan; previewUrl?: string; fileUrl?: string; kind?: string; mime?: string; altText?: string; sourceFacts?: { text: string; source: string }[]; attachments?: { id: string; previewUrl?: string; name: string; kind?: string; altText?: string; fileUrl?: string }[]; }
const names: Record<ReviewType, string> = { post: "Posts", asset: "Assets", strategy: "Strategies" };
export function ApprovalInbox() {
  const params = useSearchParams(), requested = params.get("type"), requestedId = params.get("id");
  const appliedId = useRef("");
  const [type, setType] = useState<ReviewType>(requested === "strategy" || requested === "asset" ? requested : "post");
  const [state, setState] = useState("pending"), [mine, setMine] = useState(false), [page, setPage] = useState(1), [pages, setPages] = useState(1), [total, setTotal] = useState(0);
  const [items, setItems] = useState<Item[]>([]), [selected, setSelected] = useState<Item | null>(null), [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [message, setMessage] = useState(""), [note, setNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => { setLoading(true); try { const d = await loadJSON(`/api/approvals?${new URLSearchParams({ type, state, page: String(page), mine: mine ? "1" : "0" })}`); setItems(d.items); setPages(d.pages); setTotal(d.total); setAdmin(d.admin); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, [type, state, page, mine]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!requestedId || appliedId.current === requestedId) return;
    const path = type === "post" ? `/api/content/${requestedId}` : type === "asset" ? `/api/assets/${requestedId}` : `/api/strategy/${requestedId}`;
    const c = new AbortController(); void loadJSON(path, c.signal).then(d => { appliedId.current = requestedId; setSelected({ ...d, id: requestedId, feedback: false, assignedTo: "" }); dialog.current?.showModal(); }).catch(e => { if (!c.signal.aborted) setError(e.message); });
    return () => c.abort();
  }, [requestedId, type]);
  function open(item: Item) { setSelected(item); setNote(""); setError(""); setMessage(""); dialog.current?.showModal(); }
  async function refreshSelected() {
    if (!selected) return; setBusy(true);
    const path = type === "post" ? `/api/content/${selected.id}` : type === "asset" ? `/api/assets/${selected.id}` : `/api/strategy/${selected.id}`;
    try { const d = await loadJSON(path); setSelected({ ...selected, ...d, id: selected.id }); setError(""); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function decide(approve: boolean) {
    if (!selected) return; setBusy(true); setError(""); setMessage("");
    try {
      if (!approve && !note.trim()) throw new Error("Describe the changes you need before sending feedback.");
      const path = type === "post" ? `/api/content/${selected.id}` : type === "asset" ? `/api/assets/${selected.id}` : `/api/strategy/${selected.id}`;
      const action = approve ? "approve" : type === "asset" ? "request_changes" : "reject";
      const d = await responseJSON(await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, updatedAt: selected.updatedAt, ...(!approve ? { note } : {}) }) }));
      setSelected({ ...selected, ...d, id: selected.id }); setNote(""); setMessage(approve ? "Approved. Approval is recorded for this saved version." : "Changes requested. Feedback is recorded in the discussion.");
      void load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const title = (x: Item) => x.brief?.title || x.title || x.name || "Review item";
  const isPending = selected && (type === "asset" ? selected.approval === "pending" : selected.status === "pending_approval");
  const editLink = selected ? type === "post" ? `/calendar?post=${selected.id}` : type === "strategy" ? `/strategy?id=${selected.id}` : `/assets?asset=${selected.id}` : "#";
  const notices = <div aria-live="polite">{error && <p role="alert" className="orbit-login-alert mt-4">{error}</p>}{message && <p role="status" className="orbit-team-success mt-4">{message}</p>}</div>;
  return <div className="orbit-team"><div className="mission-header"><div><h1>One place for review.</h1><p>Review strategies, post copy and assets before they move forward.</p></div><Link className="orbit-button" href="/calendar">Open Planner</Link></div><p className="orbit-team-note mt-3">Members can leave feedback. Administrators approve or request changes. Resolve open comments before approving; assigned reviews can be reassigned by an administrator.</p>
    <div className="orbit-toolbar my-5">{(Object.keys(names) as ReviewType[]).map(t => <button key={t} disabled={busy || reviewBusy} aria-pressed={type === t} className={`orbit-button ${type === t ? "orbit-button-dark" : ""}`} onClick={() => { setType(t); setPage(1); setError(""); }}>{names[t]}</button>)}<select aria-label="Review status" value={state} onChange={e => { setState(e.target.value); setPage(1); }}><option value="pending">Awaiting review</option><option value="changes">Feedback / changes requested</option><option value="approved">Approved</option></select><label className="orbit-toolbar"><input type="checkbox" checked={mine} onChange={e => { setMine(e.target.checked); setPage(1); }} />Assigned to me</label><button className="orbit-text-button" disabled={loading} onClick={() => { setError(""); void load(); }}>Refresh reviews</button></div>
    {!dialog.current?.open && notices}{loading ? <p role="status">Loading review queue...</p> : items.length ? <div className="orbit-strategy-list">{items.map(item => <button key={item.id} className="orbit-surface orbit-strategy-card" onClick={() => open(item)}><span className={`orbit-badge orbit-badge-${state === "approved" ? "green" : "amber"}`}>{state === "approved" ? "Approved" : item.feedback || item.status === "changes_requested" || item.status === "draft" ? "Feedback / changes" : "Awaiting review"}</span><h2>{title(item)}</h2><p>{item.platform || item.kind || "Strategy plan"}</p><small>{item.assignedTo ? `Reviewer: ${item.assignedTo}` : "Any administrator"}</small></button>)}</div> : <section className="orbit-surface p-6"><h2>No {names[type].toLowerCase()} match this queue.</h2><p className="orbit-team-note mt-2">{type === "post" ? "Submit a saved draft from Planner to request a post review." : type === "strategy" ? "Submit a generated strategy to request approval." : "Uploaded or imported files waiting for approval appear here. Drive references cannot be approved as post media."}</p></section>}
    <div className="orbit-toolbar justify-between my-5"><p className="orbit-team-note">{total} items | Page {page} of {pages}</p><div className="orbit-toolbar"><button className="orbit-text-button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><button className="orbit-text-button" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next</button></div></div>
    <dialog ref={dialog} className="orbit-composer" aria-labelledby="approval-heading" onCancel={e => { if (busy) e.preventDefault(); }}><div className="orbit-toolbar justify-between"><h2 id="approval-heading">Review {type}</h2><button className="orbit-text-button" disabled={busy || reviewBusy} onClick={() => dialog.current?.close()}>Close review</button></div>{selected && <><h3 className="font-semibold mt-5">{title(selected)}</h3>{notices}<div className="orbit-toolbar my-4"><Link className="orbit-button" href={editLink}>Open in {type === "post" ? "Planner" : type === "strategy" ? "Strategy" : "Assets"}</Link><button className="orbit-text-button" disabled={busy || reviewBusy} onClick={() => void refreshSelected()}>Reload saved item</button></div>{selected.body && <div className="orbit-post-preview"><small>{selected.platform} copy preview</small><p>{selected.body}</p></div>}{selected.previewUrl && <Image className="orbit-asset-detail-preview" src={selected.previewUrl} alt={selected.altText || title(selected)} width={640} height={640} unoptimized />}{selected.kind === "video" && selected.fileUrl && <video className="orbit-asset-detail-preview" src={selected.fileUrl} controls preload="metadata" />}{selected.fileUrl && <a href={`${selected.fileUrl}?download=1`} className="orbit-text-button">Download original file</a>}{selected.attachments?.map(a => <article key={a.id} className="orbit-fact mt-3">{a.previewUrl && <Image src={a.previewUrl} alt={a.altText || a.name} width={600} height={400} unoptimized />}<p>{a.name}</p>{a.kind === "video" && a.fileUrl && <video className="orbit-asset-detail-preview" src={a.fileUrl} controls preload="metadata" />}{a.fileUrl && <a className="orbit-text-button" href={`${a.fileUrl}?download=1`}>Download attached file</a>}</article>)}{selected.plan && <><StrategyPlanView plan={selected.plan} /><details className="orbit-fact mt-4"><summary>Campaign ideas to approve ({selected.plan.campaigns.length})</summary>{selected.plan.campaigns.map((c, i) => <article key={i}><strong>{c.name}</strong><p>{c.brief}</p><small>Day {c.day} | {c.platform} | CTA: {c.cta}</small></article>)}</details></>}{!!selected.sourceFacts?.length && <details className="orbit-fact mt-4"><summary>Company sources</summary>{selected.sourceFacts.map((f, i) => <p key={i}>{f.text}<br /><small>{/^https?:\/\//.test(f.source) ? <a href={f.source} target="_blank" rel="noopener noreferrer">{f.source}</a> : f.source}</small></p>)}</details>}
      {admin && isPending && <section className="orbit-composer-form"><button className="orbit-button orbit-button-lime" disabled={busy || reviewBusy} onClick={() => void decide(true)}>Approve {type}</button><label>Changes to request<textarea aria-label="Changes to request" maxLength={2000} rows={3} disabled={busy || reviewBusy} value={note} onChange={e => setNote(e.target.value)} /></label><button className="orbit-button" disabled={busy || reviewBusy || !note.trim()} onClick={() => void decide(false)}>Request changes</button></section>}{!isPending && <p className="orbit-team-note mt-4">This item is {selected.approval || selected.status}. Open it in its editor to make changes or submit a fresh review.</p>}<ReviewDiscussion type={type} id={selected.id} version={selected.updatedAt} disabled={busy} onBusyChange={setReviewBusy} />
    </>}</dialog>
  </div>;
}
