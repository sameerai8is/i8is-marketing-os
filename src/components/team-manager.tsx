"use client";
import { useCallback, useEffect, useState } from "react";

interface Member { id: string; email: string; name: string; role: "admin" | "member"; status: "pending" | "invited" | "active" | "blocked"; protected: boolean; inviteExpiresAt?: string; emailStatus?: string; }
interface Event { actor: string; action: string; target: string; createdAt: string; }
export function TeamManager() {
  const [members, setMembers] = useState<Member[]>([]), [events, setEvents] = useState<Event[]>([]);
  const [actorId, setActorId] = useState(""), [email, setEmail] = useState(""), [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [loginUrl, setLoginUrl] = useState(""), [emailConfigured, setEmailConfigured] = useState(false);
  const [status, setStatus] = useState(""), [query, setQuery] = useState("");
  const [page, setPage] = useState(1), [pages, setPages] = useState(1), [pending, setPending] = useState(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/team?${new URLSearchParams({ page: String(page), q: query, status })}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 403 ? "Only administrators can manage workspace access." : "Team access could not be loaded. Please retry.");
      setMembers(data.members); setActorId(data.actorId); setPages(data.pages); setPending(data.pendingCount); setEvents(data.events); setLoginUrl(data.loginUrl); setEmailConfigured(data.emailConfigured);
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Unable to load team."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [page, query, status]);
  useEffect(() => { const c = new AbortController(); const timer = setTimeout(() => void load(c.signal), 200); return () => { clearTimeout(timer); c.abort(); }; }, [load]);
  async function mutate(path: string, method: string, body: object) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update access.");
      setMessage(data.message); if (method === "POST") setEmail(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update access."); }
    finally { setBusy(false); }
  }
  const update = (m: Member, action: string) => void mutate(`/api/team/${m.id}`, "PATCH", { action });
  return <div className="orbit-team">
    <div className="mission-header"><div><h1>People behind the workspace.</h1><p>Invite teammates and approve people who want to join.</p></div><button className="orbit-button orbit-button-dark" onClick={() => { setStatus("pending"); setPage(1); }}>Pending requests · {pending}</button></div>
    <section className="orbit-surface orbit-team-intro"><h2>Company access</h2><p>Verified <strong>@i8is.com</strong> Google Workspace accounts join as members. Other verified Google users appear as pending requests. Approve or decline them here. Blocking overrides company access.</p></section>
    <section className="orbit-surface orbit-team-invite"><h2>Invite a person</h2><p>Invitations expire after 7 days until accepted. {emailConfigured ? "Invitation emails are enabled." : "Email delivery is not configured. Share the login link after inviting them."}</p>
      <form onSubmit={e => { e.preventDefault(); void mutate("/api/team", "POST", { email, role }); }}><label>Email address<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@example.com" disabled={busy} /></label><label>Role<select value={role} onChange={e => setRole(e.target.value)} disabled={busy}><option value="member">Member</option><option value="admin">Administrator</option></select></label><button className="orbit-button orbit-button-dark" disabled={busy}>{busy ? "Saving…" : "Invite person"}</button></form>
      <div className="orbit-toolbar mt-4"><input aria-label="Shareable login link" readOnly value={loginUrl} /><button className="orbit-text-button" onClick={async () => { try { await navigator.clipboard.writeText(loginUrl); setMessage("Login link copied. Share it with the invited person."); } catch { setMessage("Select and copy the login link above."); } }}>Copy login link</button></div>
      <p className="orbit-team-note mt-3">External users also need your Google OAuth app’s audience to permit external accounts. An invitation cannot override Google’s organization restrictions.</p>
    </section>
    <div aria-live="polite">{error && <p role="alert" className="orbit-login-alert">{error}</p>}{message && <p className="orbit-team-success">{message}</p>}</div>
    <section className="orbit-surface orbit-team-list"><div className="mission-section-heading"><h2>Workspace members</h2><button className="orbit-text-button" onClick={() => { setError(""); void load(); }} disabled={busy}>Refresh</button></div>
      <div className="orbit-toolbar mt-4"><input aria-label="Search members by email" placeholder="Search email" value={query} onChange={e => { setPage(1); setQuery(e.target.value); }} /><select aria-label="Filter access status" value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}><option value="">All accounts</option><option value="pending">Pending requests</option><option value="invited">Invitations</option><option value="active">Active members</option><option value="blocked">Blocked / declined</option></select></div>
      {loading ? <p className="orbit-team-empty" role="status">Loading members…</p> : members.length === 0 ? <p className="orbit-team-empty">No accounts match this view.</p> : <div className="orbit-team-table-wrap"><table><thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Access</th><th scope="col">Actions</th></tr></thead><tbody>{members.map(m => {
        const editable = m.id !== actorId && !m.protected;
        const expired = m.status === "invited" && m.inviteExpiresAt && new Date(m.inviteExpiresAt) < new Date();
        return <tr key={m.id}><td><strong>{m.name || m.email}</strong><span>{m.email}</span>{m.id === actorId && <small>You</small>}{m.protected && <small>Initial administrator</small>}</td><td><select aria-label={`Role for ${m.email}`} value={m.role} disabled={!editable || busy} onChange={e => void mutate(`/api/team/${m.id}`, "PATCH", { action: "role", role: e.target.value })}><option value="member">Member</option><option value="admin">Administrator</option></select></td><td><span className={`orbit-badge orbit-badge-${m.status === "active" ? "green" : "amber"}`}>{expired ? "Invitation expired" : m.status}</span>{m.emailStatus && <small className="block">Email: {m.emailStatus === "accepted" ? "provider accepted" : m.emailStatus.replaceAll("_", " ")}</small>}</td><td>{editable ? <div className="orbit-toolbar">{m.status === "pending" && <button disabled={busy} className="orbit-text-button" onClick={() => update(m, "approve")}>Approve</button>}{m.status === "invited" && <button disabled={busy} className="orbit-text-button" onClick={() => void mutate("/api/team", "POST", { email: m.email, role: m.role })}>Renew / resend</button>}<button disabled={busy} className="orbit-text-button" onClick={() => { if (m.status !== "blocked" && !window.confirm(`Revoke or decline access for ${m.email}?`)) return; update(m, m.status === "blocked" ? "restore" : "block"); }}>{m.status === "blocked" ? "Restore access" : m.status === "pending" ? "Decline" : "Revoke access"}</button></div> : <span className="orbit-team-note">Protected</span>}</td></tr>;
      })}</tbody></table></div>}
      <div className="orbit-toolbar mt-4"><button className="orbit-text-button" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><span className="orbit-team-note">Page {page} of {pages}</span><button className="orbit-text-button" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next</button></div>
    </section>
    <section className="orbit-surface orbit-team-list"><h2>Recent access changes</h2>{events.length ? <ul className="orbit-activity-list">{events.map((e, i) => <li key={i}><strong>{e.action.replaceAll(".", " ")}</strong><span>{e.target} · by {e.actor}</span><time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time></li>)}</ul> : <p className="orbit-team-empty">New invitations and access changes will appear here.</p>}</section>
  </div>;
}
