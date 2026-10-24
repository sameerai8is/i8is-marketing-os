"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, X } from "lucide-react";
import type { PublishingConnection } from "@/lib/publishing/types";

type ContentSnapshot = { pending: number; production: number; published: number };
const agents = [
  { number: "01", name: "Maya", role: "Research", description: "Discover verified market signals", tone: "green", status: "Planned", detail: "Research will gather market signals and attach sources. Company facts must be verified before they enter a campaign." },
  { number: "02", name: "Dev", role: "Strategy", description: "Turn your direction into a campaign brief", tone: "green", status: "Planned", detail: "Strategy will turn an approved goal and verified research into a measurable campaign brief for your review." },
  { number: "03", name: "Owen", role: "Content", description: "Prepare channel-specific content for review", tone: "blue", status: "Review first", detail: "Content will adapt approved briefs for each channel. You will be able to review the copy and its factual claims before approval." },
  { number: "04", name: "Iris", role: "Publishing", description: "Buffer profiles connected · publishing simulated", tone: "amber", status: "Simulation", detail: "Buffer profile discovery is connected. Creating, scheduling, and publishing posts remain disabled in this prototype." },
];

export function MissionControl() {
  const [connection, setConnection] = useState<PublishingConnection | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(null);
  const [contentError, setContentError] = useState(false);
  const [goal, setGoal] = useState("");
  const [savedGoal, setSavedGoal] = useState("");
  const [goalMessage, setGoalMessage] = useState("");
  const [detail, setDetail] = useState<{ title: string; description: string } | null>(null);
  const goalInput = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/publishing/connection", { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(setConnection).catch(() => { if (!controller.signal.aborted) setConnectionError(true); });
    fetch("/api/content", { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then((items: { status: string }[]) => {
        if (!Array.isArray(items)) throw new Error();
        setSnapshot({ pending: items.filter(item => item.status === "pending_approval").length, production: items.filter(item => ["draft", "pending_approval", "scheduled"].includes(item.status)).length, published: items.filter(item => item.status === "published").length });
      }).catch(() => { if (!controller.signal.aborted) setContentError(true); });
    try {
      const stored = localStorage.getItem("orbit:i8is:marketing-goal");
      if (stored) { setSavedGoal(stored); setGoal(stored); }
    } catch { /* A goal can still be edited when browser storage is unavailable. */ }
    return () => controller.abort();
  }, []);

  function openDetail(title: string, description: string) {
    setDetail({ title, description });
    dialog.current?.showModal();
  }

  function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    const value = goal.trim();
    if (!value) { setGoalMessage("Describe the outcome you want to achieve."); goalInput.current?.focus(); return; }
    try {
      localStorage.setItem("orbit:i8is:marketing-goal", value);
      setSavedGoal(value);
      setGoalMessage("Goal saved on this device. Agent execution is not enabled yet.");
    } catch { setGoalMessage("Your browser could not save this goal. Keep a copy before leaving this page."); }
  }

  const supported = ["linkedin", "instagram", "facebook"];
  const ready = supported.filter(platform => connection?.channels.some(channel => channel.platform === platform && channel.connected && !channel.locked && !channel.queuePaused)).length;
  const metricValue = (key: keyof ContentSnapshot) => snapshot ? snapshot[key] : contentError ? "—" : "…";

  return <div className="mission-control">
    <div className="mission-header">
      <div><h1>The whole marketing operation.</h1><p>One place to direct your AI team, review work, and see what actually moves the business.</p></div>
      <button className="orbit-button orbit-button-dark mission-goal-button" onClick={() => { goalInput.current?.scrollIntoView({ behavior: "smooth", block: "center" }); goalInput.current?.focus({ preventScroll: true }); }}>+ Give the brain a goal</button>
    </div>

    <div className="mission-primary-grid">
      <section className="mission-director" aria-labelledby="director-heading">
        <span className="orbit-badge mission-director-label"><span aria-hidden="true">◉</span> AI Director</span>
        <h2 id="director-heading">Your next move starts with a goal.</h2>
        <p>{savedGoal ? `Your direction: ${savedGoal}` : "Set the direction for I8IS. Turn verified research into thoughtful content and campaigns you approve."}</p>
        <div className="mission-director-footer"><button className="orbit-button orbit-button-lime" onClick={() => openDetail("From a goal to a campaign", "Start with your business goal. The planned workflow moves through research, strategy, content, creative, and human approval before publishing. This prototype connects your Buffer profiles and stores a goal on this device; it does not run agents or publish posts.")}>Explore the workflow <ArrowRight size={15} /></button><span>Human approval comes first</span></div>
      </section>

      <section className="mission-health orbit-surface" aria-labelledby="health-heading" aria-busy={!connection && !connectionError}>
        <h2 id="health-heading" className="orbit-eyebrow">Publishing health</h2>
        <p className="mission-health-number">{connection ? `${ready} of 3 channels ready` : connectionError ? "Connection needs attention" : "Checking your channels…"}</p>
        <p className="mission-health-description">{connection ? "Buffer is connected. Publishing stays simulated while your workflow takes shape." : connectionError ? "Review your Buffer connection in Settings to check your social profiles." : "Checking your connected social profiles through Buffer."}</p>
        <div className="mission-health-footer"><div className="mission-platforms">{["LinkedIn", "Instagram", "Facebook"].map(platform => {
          const channel = connection?.channels.find(channel => channel.platform === platform.toLowerCase());
          const connected = channel?.connected && !channel.locked && !channel.queuePaused;
          return <span key={platform} title={connection ? `${platform}: ${connected ? "ready" : "not ready"}` : `${platform}: status unavailable`} className={connection && !connected ? "is-unavailable" : ""}>{platform}{connected && <Check size={10} aria-label="ready" />}</span>;
        })}</div><Link className="orbit-badge orbit-badge-amber" href="/settings#buffer-heading">{connection ? "Simulated" : "Set up"}</Link></div>
      </section>
    </div>

    <section className="mission-metrics" aria-label="Content overview">
      {[
        { title: "Awaiting your decision", value: metricValue("pending"), description: "Content awaiting approval", href: "/calendar", tone: "amber" },
        { title: "Pieces in production", value: metricValue("production"), description: "Draft, review, and scheduled", href: "/calendar", tone: "muted" },
        { title: "Posts published", value: metricValue("published"), description: "From your content records", href: "/performance", tone: "muted" },
      ].map(metric => <Link href={metric.href} key={metric.title} className="mission-metric orbit-surface"><h2>{metric.title}</h2><div><strong>{metric.value}</strong><p className={`metric-${metric.tone}`}>{metric.description}</p></div><ArrowUpRight className="mission-metric-arrow" size={16} aria-hidden="true" /></Link>)}
    </section>

    <div className="mission-secondary-grid">
      <section id="workforce" className="mission-workforce orbit-surface" aria-labelledby="workforce-heading">
        <div className="mission-section-heading"><h2 id="workforce-heading">Meet your marketing team</h2><span>Workflow preview</span></div>
        <div className="mission-agent-list">{agents.map(agent => <button key={agent.number} className="mission-agent" onClick={() => openDetail(`${agent.name} / ${agent.role}`, agent.detail)}>
          <span className={`mission-agent-avatar badge-${agent.tone}`}>{agent.number}</span><span className="mission-agent-text"><strong>{agent.name} / {agent.role}</strong><span>{agent.number === "04" && !connection ? "Publishing will use your Buffer connection" : agent.description}</span></span><span className={`orbit-badge orbit-badge-${agent.tone}`}>{agent.status}</span>
        </button>)}</div>
      </section>

      <section className="mission-prompt orbit-surface" aria-labelledby="prompt-heading">
        <span className="orbit-badge orbit-badge-blue mission-prompt-label"><span aria-hidden="true">✳</span> Your AI marketing director</span>
        <h2 id="prompt-heading">What should we achieve next?</h2>
        <p>Try: Make us visible to manufacturing<br className="mission-example-break" /> leaders across Ontario this November.</p>
        <form onSubmit={saveGoal} className="mission-goal-form"><label htmlFor="marketing-goal" className="sr-only">Your marketing goal</label><textarea ref={goalInput} id="marketing-goal" value={goal} onChange={event => { setGoal(event.target.value); setGoalMessage(""); }} placeholder="Describe a goal for your marketing team…" maxLength={1000} rows={3} required /><button type="submit" aria-label="Save marketing goal">{goal && goal === savedGoal ? <Check size={17} /> : <ArrowUpRight size={17} />}</button></form>
        <p className="mission-goal-message" role="status">{goalMessage || (savedGoal ? "Draft goal saved on this device" : "Save a direction for your next campaign.")}</p>
      </section>
    </div>
    <p className="mission-data-note">{contentError ? "Content overview is unavailable. Check the database connection." : "Content overview reflects the latest 50 records. Agent workflow is a preview; publishing is simulated."}</p>

    <dialog ref={dialog} className="orbit-detail-dialog" aria-labelledby="detail-heading" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <button className="orbit-dialog-close" onClick={() => dialog.current?.close()} aria-label="Close details"><X size={20} /></button><span className="orbit-badge orbit-badge-blue">Workflow preview</span><h2 id="detail-heading">{detail?.title}</h2><p>{detail?.description}</p><Link href="/campaigns" onClick={() => dialog.current?.close()} className="orbit-button orbit-button-dark">Open Campaign Studio <ArrowRight size={15} /></Link>
    </dialog>
  </div>;
}
