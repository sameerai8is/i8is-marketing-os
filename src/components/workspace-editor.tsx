"use client";
import { useEffect, useState } from "react";
interface Fact { text: string; source: string; }
interface Settings { companyName: string; audience: string; tone: string; autonomy: string; marketingGoal: string; facts: Fact[]; updatedAt?: string; }
export function WorkspaceEditor({ mode }: { mode: "knowledge" | "autonomy" }) {
  const [settings, setSettings] = useState<Settings | null>(null), [admin, setAdmin] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [confirmed, setConfirmed] = useState(false);
  useEffect(() => { const c = new AbortController(); fetch("/api/workspace", { cache: "no-store", signal: c.signal }).then(async r => { if (!r.ok) throw new Error("Workspace settings could not be loaded. Refresh to retry."); return r.json(); }).then(d => { setSettings(d.settings); setAdmin(d.admin); }).catch(e => { if (!c.signal.aborted) setError(e.message); }); return () => c.abort(); }, []);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...settings, action: mode, confirmVerified: confirmed }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Settings could not be saved.");
      setSettings(d.settings); setMessage("Workspace settings saved."); setConfirmed(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!settings) return <p role="status" className="orbit-login-alert">{error || "Loading workspace settings…"}</p>;
  return <section className="orbit-surface p-6"><h2>{mode === "knowledge" ? "Verified company knowledge" : "Autonomy mode"}</h2><p className="orbit-team-note mt-2">{mode === "knowledge" ? "Only administrator-reviewed claims with references are used for AI drafts. A reference records your evidence; Orbit does not independently verify it." : "Both modes require human approval. Publishing is simulated; unattended publishing is not enabled."}</p>
    <form className="orbit-composer-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      {mode === "knowledge" ? <><label>Company name<input required maxLength={200} disabled={!admin || busy} value={settings.companyName} onChange={e => setSettings({ ...settings, companyName: e.target.value })} /></label><label>Target audience<textarea maxLength={2000} disabled={!admin || busy} value={settings.audience} onChange={e => setSettings({ ...settings, audience: e.target.value })} /></label><label>Brand tone<input maxLength={1000} disabled={!admin || busy} value={settings.tone} onChange={e => setSettings({ ...settings, tone: e.target.value })} /></label>
      {settings.facts.map((fact, i) => <fieldset key={i} className="orbit-fact"><legend>Verified fact {i + 1}</legend><label>Claim<textarea required maxLength={1000} disabled={!admin || busy} value={fact.text} onChange={e => setSettings({ ...settings, facts: settings.facts.map((f, n) => n === i ? { ...f, text: e.target.value } : f) })} /></label><label>Source URL or reference<input required maxLength={1000} disabled={!admin || busy} value={fact.source} onChange={e => setSettings({ ...settings, facts: settings.facts.map((f, n) => n === i ? { ...f, source: e.target.value } : f) })} /></label>{admin && <button type="button" className="orbit-text-button" disabled={busy} onClick={() => setSettings({ ...settings, facts: settings.facts.filter((_, n) => i !== n) })}>Remove fact</button>}</fieldset>)}
      {!settings.facts.length && <p className="orbit-login-alert">No company claims have been verified yet. Add facts and references before generating AI drafts.</p>}
      {admin && <><button type="button" disabled={busy || settings.facts.length >= 50} className="orbit-text-button" onClick={() => setSettings({ ...settings, facts: [...settings.facts, { text: "", source: "" }] })}>+ Add verified fact</button>{settings.facts.length > 0 && <label className="orbit-toolbar"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />I reviewed these claims and their sources.</label>}</>}
      </> : <label>Approval workflow<select disabled={!admin || busy} value={settings.autonomy} onChange={e => setSettings({ ...settings, autonomy: e.target.value })}><option value="assisted">Assisted — review each post</option><option value="managed">Managed — plan campaigns, review posts before scheduling</option></select></label>}
      {!admin && <p className="orbit-team-note">Only administrators can change these settings.</p>}{error && <p role="alert" className="orbit-login-alert">{error}</p>}{message && <p role="status" className="orbit-team-success">{message}</p>}{admin && <button disabled={busy} className="orbit-button orbit-button-dark">{busy ? "Saving…" : "Save changes"}</button>}
    </form>
  </section>;
}
