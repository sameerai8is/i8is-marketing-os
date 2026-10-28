"use client";
import { useState } from "react";
import Link from "next/link";
import type { PublishingChannel } from "@/lib/publishing/types";
import { loadJSON, responseJSON } from "@/lib/client-api";

export function PublishPost({ post, disabled, onPublished, onBusyChange }: { post: { _id: string; title: string; platform: string; updatedAt: string }; disabled: boolean; onPublished: () => Promise<void>; onBusyChange: (busy: boolean) => void }) {
  const [channels, setChannels] = useState<PublishingChannel[] | null>(null), [channelId, setChannel] = useState("");
  const [mode, setMode] = useState("customScheduled"), [date, setDate] = useState("");
  const [busy, setBusy] = useState(false), [review, setReview] = useState(false), [error, setError] = useState(""), [result, setResult] = useState("");
  const channel = channels?.find(c => c.id === channelId);
  async function connect() {
    setBusy(true); onBusyChange(true); setError(""); setReview(false);
    try { const d = await loadJSON("/api/publishing/connection"); setChannels(d.channels); setChannel(""); } catch (e) { setError((e as Error).message); } finally { setBusy(false); onBusyChange(false); }
  }
  async function publish() {
    setBusy(true); onBusyChange(true); setError(""); setReview(false);
    try {
      const r = await fetch(`/api/content/${post._id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId, mode, updatedAt: post.updatedAt, ...(mode === "customScheduled" && date ? { dueAt: new Date(date).toISOString() } : {}) }) });
      const d = await responseJSON(r);
      setResult(d.state === "published" ? "Buffer confirms this post was published." : d.state === "queued" ? "Buffer accepted the post. Track delivery in Publishing Monitor." : "Your request is recorded. Open Publishing Monitor for its result and next steps.");
      await onPublished();
    } catch (e) { setError((e as Error).message + " Open Publishing Monitor before repeating a request."); } finally { setBusy(false); onBusyChange(false); }
  }
  return <fieldset className="orbit-fact orbit-publish-panel" disabled={busy || disabled}>
    <legend>Publish through Buffer</legend>
    <p className="orbit-team-note">This sends the saved, approved version to a real social account. Times use your browser’s timezone. Text and JPG/PNG image posts are supported.</p>
    <button type="button" className="orbit-button" onClick={() => void connect()}>{busy ? "Checking..." : channels ? "Refresh Buffer profiles" : "Choose connected profile"}</button>
    {channels && !result && <>
      <label>Buffer profile<select aria-label="Buffer profile" value={channelId} disabled={review} onChange={e => setChannel(e.target.value)}><option value="">Choose a {post.platform} profile</option>{channels.filter(c => c.platform === post.platform).map(c => <option key={c.id} value={c.id} disabled={!c.connected || c.locked || c.queuePaused}>{c.name}{!c.connected || c.locked || c.queuePaused ? " (unavailable in Buffer)" : ""}</option>)}</select></label>
      {!channels.some(c => c.platform === post.platform && c.connected && !c.locked && !c.queuePaused) && <p className="orbit-login-alert">No available {post.platform} profiles. Connect or resume one in <a href="https://publish.buffer.com" target="_blank" rel="noreferrer">Buffer</a>, then refresh.</p>}
      <label>Publishing action<select aria-label="Publishing action" value={mode} disabled={review} onChange={e => setMode(e.target.value)}><option value="customScheduled">Schedule at a specific time</option><option value="shareNow">Publish now</option></select></label>
      {mode === "customScheduled" && <label>Publishing time (local)<input aria-label="Publishing time (local)" type="datetime-local" disabled={review} value={date} onChange={e => setDate(e.target.value)} /></label>}
      {!review ? <button type="button" className="orbit-button orbit-button-lime" disabled={!channel || (mode === "customScheduled" && !date)} onClick={() => { setError(""); setReview(true); }}>Review publishing request</button> : <div className="orbit-fact"><strong>{post.title}</strong><p>{mode === "shareNow" ? "Publish now" : `Schedule for ${new Date(date).toLocaleString()}`} on <strong>{channel?.name}</strong> ({post.platform}).</p><p className="orbit-team-note">Approval covers the saved text and attachments shown above. Buffer may take time to finish delivery.</p><div className="orbit-toolbar"><button type="button" className="orbit-button orbit-button-dark" onClick={() => void publish()}>{mode === "shareNow" ? "Confirm publish now" : "Confirm live schedule"}</button><button type="button" className="orbit-text-button" onClick={() => setReview(false)}>Go back</button></div></div>}
    </>}
    {error && <p role="alert" className="orbit-login-alert">{error}</p>}{result && <p role="status" className="orbit-team-success">{result}</p>}
    <Link className="orbit-text-button" href={`/publishing?post=${post._id}`}>Open publishing history for this post</Link>
  </fieldset>;
}
