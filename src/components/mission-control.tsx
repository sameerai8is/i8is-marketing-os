"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import type { PublishingConnection } from "@/lib/publishing/types";

type Snapshot = { pending: number; total: number };
export function MissionControl() {
  const [connection, setConnection] = useState<PublishingConnection | null>(null), [connectionError, setConnectionError] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [contentError, setContentError] = useState(false);
  const [assets, setAssets] = useState<number | null>(null), [assetError, setAssetError] = useState(false);
  const [goal, setGoal] = useState(""), [savedGoal, setSavedGoal] = useState(""), [goalMessage, setGoalMessage] = useState("");
  const [settingsVersion, setSettingsVersion] = useState<string | null>(null), [settingsLoaded, setSettingsLoaded] = useState(false), [saving, setSaving] = useState(false);
  const [capabilities, setCapabilities] = useState<{ research: boolean; textGeneration: boolean } | null>(null);
  const goalInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const controller = new AbortController(), options = { signal: controller.signal, cache: "no-store" as const };
    fetch("/api/publishing/connection", options).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(setConnection).catch(() => { if (!controller.signal.aborted) setConnectionError(true); });
    fetch("/api/content", options).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then((items: { status: string }[]) => {
      if (!Array.isArray(items)) throw new Error(); setSnapshot({ pending: items.filter(i => i.status === "pending_approval").length, total: items.length });
    }).catch(() => { if (!controller.signal.aborted) setContentError(true); });
    fetch("/api/assets", options).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => { if (!Number.isInteger(d.total)) throw new Error(); setAssets(d.total); }).catch(() => { if (!controller.signal.aborted) setAssetError(true); });
    fetch("/api/workspace", options).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(({ settings, capabilities }) => {
      setGoal(settings.marketingGoal); setSavedGoal(settings.marketingGoal); setSettingsVersion(settings.updatedAt || null); setCapabilities(capabilities); setSettingsLoaded(true);
    }).catch(() => { if (!controller.signal.aborted) setGoalMessage("Workspace settings could not be loaded. Refresh before saving."); });
    return () => controller.abort();
  }, []);
  async function saveGoal(event: React.FormEvent) {
    event.preventDefault(); if (!settingsLoaded || saving) return;
    const value = goal.trim(); if (!value) { setGoalMessage("Describe the outcome you want to achieve."); goalInput.current?.focus(); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "goal", marketingGoal: value, updatedAt: settingsVersion }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Goal could not be saved.");
      setSavedGoal(value); setSettingsVersion(data.settings.updatedAt); setGoalMessage("Goal saved. Start research or create a draft when you are ready.");
    } catch (e) { setGoalMessage(e instanceof Error ? e.message : "Your goal could not be saved."); } finally { setSaving(false); }
  }
  const platforms = ["linkedin", "instagram", "facebook"];
  const linked = platforms.filter(p => connection?.channels.some(c => c.platform === p && c.connected)).length;
  const configured = (value: boolean | undefined) => value === undefined ? "Not checked" : value ? "Configured" : "Not configured";
  const workflows = [
    { number: "01", role: "Website and competitor research", description: "Run research and review source-linked company claims and competitor candidates.", href: "/research", status: configured(capabilities?.research) },
    { number: "02", role: "Company knowledge", description: "Review evidence and maintain the facts used for content drafts.", href: "/company-brain", status: "Human review" },
    { number: "03", role: "Content drafts", description: "Write posts or generate text from reviewed company facts in the Planner.", href: "/calendar", status: configured(capabilities?.textGeneration) },
    { number: "04", role: "Asset library", description: "Upload your files and save Drive references for use in post drafts.", href: "/assets", status: "Your files" },
  ];
  return <div className="mission-control">
    <div className="mission-header"><div><h1>Your marketing workspace.</h1><p>Research your business, review company knowledge, and prepare content.</p></div><button className="orbit-button orbit-button-dark mission-goal-button" onClick={() => { goalInput.current?.scrollIntoView({ behavior: "smooth", block: "center" }); goalInput.current?.focus({ preventScroll: true }); }}>Set a marketing goal</button></div>
    <div className="mission-primary-grid">
      <section className="mission-director" aria-labelledby="director-heading"><span className="orbit-badge mission-director-label">Workspace goal</span><h2 id="director-heading">{savedGoal ? "Your saved direction" : "No marketing goal saved yet."}</h2><p>{savedGoal || "Add your business objective below to guide research and draft briefs."}</p><div className="mission-director-footer"><Link href="/research" className="orbit-button orbit-button-lime">Open website research <ArrowUpRight size={15} /></Link><span>Research runs when you start it</span></div></section>
      <section className="mission-health orbit-surface" aria-labelledby="health-heading" aria-busy={!connection && !connectionError}><h2 id="health-heading" className="orbit-eyebrow">Social account connection</h2><p className="mission-health-number">{connection ? `${linked} of 3 channels connected` : connectionError ? "Connection unavailable" : "Checking Buffer profiles…"}</p><p className="mission-health-description">{connection ? "Buffer profile discovery responded. Live publishing is not enabled; Planner schedules are simulations." : connectionError ? "Buffer status could not be checked. Open Settings to retry." : "Connection status has not been confirmed yet."}</p><div className="mission-health-footer"><div className="mission-platforms">{["LinkedIn", "Instagram", "Facebook"].map(p => { const channels = connection?.channels.filter(c => c.platform === p.toLowerCase()) || []; const connected = channels.some(c => c.connected); const blocked = channels.some(c => c.connected && (c.locked || c.queuePaused)); return <span key={p} title={`${p}: ${!connection ? "not checked" : connected ? blocked ? "connected; a profile is locked or paused" : "connected" : "not connected"}`} className={!connected ? "is-unavailable" : ""}>{p}{connected && <Check size={10} aria-label="connected" />}</span>; })}</div><Link className="orbit-badge orbit-badge-amber" href="/settings#buffer-heading">Publishing simulation</Link></div></section>
    </div>
    <section className="mission-metrics" aria-label="Saved workspace records">{[
      { title: "Awaiting approval", value: snapshot ? snapshot.pending : contentError ? "—" : "…", description: "Saved posts awaiting review", href: "/calendar", tone: "amber" },
      { title: "Saved posts", value: snapshot ? snapshot.total : contentError ? "—" : "…", description: "Up to 500 recent records", href: "/calendar", tone: "muted" },
      { title: "Saved assets", value: assets === null ? assetError ? "—" : "…" : assets, description: "Files and Drive references", href: "/assets", tone: "muted" },
    ].map(m => <Link href={m.href} key={m.title} className="mission-metric orbit-surface"><h2>{m.title}</h2><div><strong>{m.value}</strong><p className={`metric-${m.tone}`}>{m.description}</p></div><ArrowUpRight className="mission-metric-arrow" size={16} aria-hidden="true" /></Link>)}</section>
    <div className="mission-secondary-grid"><section id="workforce" className="mission-workforce orbit-surface" aria-labelledby="workforce-heading"><div className="mission-section-heading"><h2 id="workforce-heading">Workspace workflows</h2><span>Started by you</span></div><p className="orbit-team-note mt-3">Configured means server credentials are present, not that an autonomous agent is running.</p><div className="mission-agent-list">{workflows.map(w => <Link href={w.href} key={w.number} className="mission-agent"><span className="mission-agent-avatar badge-blue">{w.number}</span><span className="mission-agent-text"><strong>{w.role}</strong><span>{w.description}</span></span><span className="orbit-badge orbit-badge-blue">{w.status}</span></Link>)}</div></section>
    <section className="mission-prompt orbit-surface" aria-labelledby="prompt-heading"><span className="orbit-badge orbit-badge-blue mission-prompt-label">Shared marketing goal</span><h2 id="prompt-heading">What should your marketing achieve?</h2><p>Enter your actual objective, intended audience, and timeframe.</p><form onSubmit={saveGoal} className="mission-goal-form"><label htmlFor="marketing-goal" className="sr-only">Your marketing goal</label><textarea ref={goalInput} id="marketing-goal" value={goal} disabled={!settingsLoaded || saving} onChange={e => { setGoal(e.target.value); setGoalMessage(""); }} placeholder="Enter your marketing objective" maxLength={1000} rows={3} required /><button type="submit" disabled={!settingsLoaded || saving} aria-label="Save marketing goal">{goal && goal === savedGoal ? <Check size={17} /> : <ArrowUpRight size={17} />}</button></form><p className="mission-goal-message" role="status">{goalMessage || (savedGoal ? "Goal saved to your shared workspace" : settingsLoaded ? "No shared goal has been saved." : "Loading workspace settings…")}</p></section></div>
    <p className="mission-data-note">{contentError || assetError ? "Some workspace records could not be loaded. Unavailable counts are shown as a dash." : "Counts reflect saved workspace records. Social performance metrics are not connected. Autonomous campaign execution and live publishing are not enabled."}</p>
  </div>;
}
