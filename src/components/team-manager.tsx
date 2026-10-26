"use client";

import { useCallback, useEffect, useState } from "react";

interface Member { id: string; email: string; name: string; role: "admin" | "member"; status: "invited" | "active" | "blocked"; protected: boolean; inviteExpiresAt?: string; lastSignInAt?: string; }

export function TeamManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [actorId, setActorId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/team", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 403 ? "Only administrators can manage workspace access." : "Team access could not be loaded. Please try again.");
      setMembers(data.members); setActorId(data.actorId);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to load team."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function mutate(path: string, method: string, body: object) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update access.");
      setMessage(data.message); if (method === "POST") setEmail(""); await load();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update access."); }
    finally { setBusy(false); }
  }

  return <div className="orbit-team">
    <div className="mission-header"><div><h1>People behind the workspace.</h1><p>Manage who can access I8IS and what they can do.</p></div><span className="orbit-badge orbit-badge-green">Administrator</span></div>
    <section className="orbit-surface orbit-team-intro"><h2>Company access</h2><p>Verified Google Workspace accounts at <strong>i8is.com</strong> join as members. Members can use the marketing tools; administrators can also manage people. Blocking an account overrides automatic company access.</p></section>
    <section className="orbit-surface orbit-team-invite"><h2>Approve an account</h2><p>Approval expires after 7 days unless the person signs in. Share your app&apos;s login link with them; this action does not send an email.</p>
      <form onSubmit={event => { event.preventDefault(); void mutate("/api/team", "POST", { email, role }); }}>
        <label>Email address<input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="colleague@i8is.com" disabled={busy || loading} /></label>
        <label>Role<select value={role} onChange={event => setRole(event.target.value)} disabled={busy || loading}><option value="member">Member</option><option value="admin">Administrator</option></select></label>
        <button className="orbit-button orbit-button-dark" disabled={busy || loading}>{busy ? "Saving…" : "Approve account"}</button>
      </form>
      <p className="orbit-team-note">External Google accounts also need your Google OAuth app to permit external users.</p>
    </section>
    <div aria-live="polite">{error && <p role="alert" className="orbit-login-alert">{error}</p>}{message && <p className="orbit-team-success">{message}</p>}</div>
    <section className="orbit-surface orbit-team-list"><div className="mission-section-heading"><h2>Workspace members</h2><button className="orbit-text-button" onClick={() => { setError(""); void load(); }} disabled={busy}>Refresh</button></div>
      {loading ? <p className="orbit-team-empty">Loading members…</p> : members.length === 0 ? <p className="orbit-team-empty">No members to display.</p> : <div className="orbit-team-table-wrap"><table><thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Access</th><th scope="col">Actions</th></tr></thead><tbody>{members.map(member => {
        const editable = member.id !== actorId && !member.protected;
        const expired = member.status === "invited" && member.inviteExpiresAt && new Date(member.inviteExpiresAt) < new Date();
        return <tr key={member.id}><td><strong>{member.name || member.email}</strong><span>{member.email}</span>{member.id === actorId && <small>You</small>}{member.protected && <small>Initial administrator</small>}</td><td><label className="sr-only" htmlFor={`role-${member.id}`}>Role for {member.email}</label><select id={`role-${member.id}`} value={member.role} disabled={!editable || busy} onChange={event => void mutate(`/api/team/${member.id}`, "PATCH", { action: "role", role: event.target.value })}><option value="member">Member</option><option value="admin">Administrator</option></select></td><td><span className={`orbit-badge orbit-badge-${member.status === "active" ? "green" : "amber"}`}>{expired ? "Approval expired" : member.status}</span></td><td>{editable ? <button disabled={busy} className="orbit-text-button" onClick={() => { if (member.status !== "blocked" && !window.confirm(`Revoke workspace access for ${member.email}?`)) return; void mutate(`/api/team/${member.id}`, "PATCH", { action: member.status === "blocked" ? "restore" : "block" }); }}>{member.status === "blocked" ? "Restore access" : "Revoke access"}</button> : <span className="orbit-team-note">Protected</span>}</td></tr>;
      })}</tbody></table></div>}
    </section>
  </div>;
}
