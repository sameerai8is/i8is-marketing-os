"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { loadJSON, responseJSON } from "@/lib/client-api";
interface Fact { text: string; source: string; }
interface Settings { companyName: string; audience: string; tone: string; autonomy: string; marketingGoal: string; facts: Fact[]; updatedAt?: string; }
export function WorkspaceEditor({ mode }: { mode: "knowledge" | "autonomy" }) {
  const [settings, setSettings] = useState<Settings | null>(null), [admin, setAdmin] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true), [suggestions, setSuggestions] = useState<Fact[]>([]);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try { const d = await loadJSON("/api/workspace", signal); setSettings(d.settings); setAdmin(d.admin); setSuggestions(d.suggestedFacts || []); setConfirmed(false); }
    catch (e) { if (!signal?.aborted) setError((e as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...settings, action: mode, confirmVerified: confirmed }) });
      const d = await responseJSON(r);
      setSettings(d.settings); setMessage("Workspace settings saved."); setConfirmed(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!settings) return <section className="orbit-surface p-6"><p role={error ? "alert" : "status"} className="orbit-login-alert">{error || "Loading workspace settings…"}</p><button className="orbit-button" disabled={loading} onClick={() => void load()}>{loading ? "Loading…" : "Retry loading Company DNA"}</button></section>;
  return <section className="orbit-surface p-6"><div className="orbit-toolbar justify-between"><h2>{mode === "knowledge" ? "Verified company knowledge" : "Autonomy mode"}</h2><button className="orbit-text-button" disabled={busy || loading} onClick={() => { if (window.confirm("Reload saved settings? Unsaved edits will be discarded.")) void load(); }}>Reload saved settings</button></div><p className="orbit-team-note mt-2">{mode === "knowledge" ? "Only administrator-reviewed claims with references are used for AI drafts. A reference records your evidence; Orbit does not independently verify it." : "Both modes require human approval. Publishing is simulated; unattended publishing is not enabled."}</p>
    {error && <p role="alert" className="orbit-login-alert">{error}</p>}{message && <p role="status" className="orbit-team-success">{message} {mode === "knowledge" && !!settings.facts.length && <Link href="/calendar?compose=1">Create a post →</Link>}</p>}
    {mode === "knowledge" && <><p className="orbit-team-note mt-3">{settings.facts.length} facts in this form. Review changes and save them to make them available to AI. {admin ? "Add your own claim below, or review a website finding." : "An administrator must approve facts before AI drafting becomes available."}</p>{suggestions.some(f => !settings.facts.some(s => s.text === f.text)) && <details className="orbit-fact mt-4" open={!settings.facts.length}><summary>Website findings to review</summary><p className="orbit-team-note">These findings are unreviewed. Open the source, add the claims you accept, then confirm and save below.</p>{suggestions.filter(f => !settings.facts.some(s => s.text === f.text)).map((f, i) => <article className="orbit-fact" key={i}><p>{f.text}</p><a className="orbit-text-button" href={/^https?:\/\//.test(f.source) ? f.source : undefined} target="_blank" rel="noopener noreferrer">{f.source}</a>{admin && <button type="button" disabled={busy || settings.facts.length >= 50} className="orbit-button" onClick={() => { setSettings({ ...settings, facts: [...settings.facts, { text: f.text, source: f.source }] }); setConfirmed(false); }}>Add for review</button>}</article>)}</details>}<Link href="/research" className="orbit-text-button">Research the company website →</Link></>}
    <form className="orbit-composer-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      {mode === "knowledge" ? <><label>Company name<input required maxLength={200} disabled={!admin || busy} value={settings.companyName} onChange={e => setSettings({ ...settings, companyName: e.target.value })} /></label><label>Target audience<textarea maxLength={2000} disabled={!admin || busy} value={settings.audience} onChange={e => setSettings({ ...settings, audience: e.target.value })} /></label><label>Brand tone<input maxLength={1000} disabled={!admin || busy} value={settings.tone} onChange={e => setSettings({ ...settings, tone: e.target.value })} /></label>
      {settings.facts.map((fact, i) => <fieldset key={i} className="orbit-fact"><legend>Company fact {i + 1}</legend><label>Claim<textarea required maxLength={1000} disabled={!admin || busy} value={fact.text} onChange={e => { setConfirmed(false); setSettings({ ...settings, facts: settings.facts.map((f, n) => n === i ? { ...f, text: e.target.value } : f) }); }} /></label><label>Source URL or reference<input required maxLength={1000} disabled={!admin || busy} value={fact.source} onChange={e => { setConfirmed(false); setSettings({ ...settings, facts: settings.facts.map((f, n) => n === i ? { ...f, source: e.target.value } : f) }); }} /></label>{admin && <button type="button" className="orbit-text-button" disabled={busy} onClick={() => { setConfirmed(false); setSettings({ ...settings, facts: settings.facts.filter((_, n) => i !== n) }); }}>Remove fact</button>}</fieldset>)}
      {!settings.facts.length && <p className="orbit-login-alert">No company claims have been verified yet. Add facts and references before generating AI drafts.</p>}
      {admin && <><button type="button" disabled={busy || settings.facts.length >= 50} className="orbit-text-button" onClick={() => setSettings({ ...settings, facts: [...settings.facts, { text: "", source: "" }] })}>+ Add company fact</button>{settings.facts.length > 0 && <label className="orbit-toolbar"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />I reviewed these claims and their sources.</label>}</>}
      </> : <label>Approval workflow<select disabled={!admin || busy} value={settings.autonomy} onChange={e => setSettings({ ...settings, autonomy: e.target.value })}><option value="assisted">Assisted — review each post</option><option value="managed">Managed — plan campaigns, review posts before scheduling</option></select></label>}
      {!admin && <p className="orbit-team-note">Only administrators can change these settings.</p>}{error && <p role="alert" className="orbit-login-alert">{error}</p>}{message && <p role="status" className="orbit-team-success">{message}</p>}{admin && <button disabled={busy} className="orbit-button orbit-button-dark">{busy ? "Saving…" : "Save changes"}</button>}
    </form>
  </section>;
}
