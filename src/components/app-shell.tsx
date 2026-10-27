"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { Sidebar, workspacePages } from "./sidebar";
import { signOut } from "next-auth/react";

export function AppShell({ children, member }: { children: React.ReactNode; member: { email: string; name: string; role: string } }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const current = workspacePages.find(page => page.href === pathname)?.label || "Workspace";
  const results = workspacePages.filter(page => (member.role === "admin" || page.href !== "/team") && page.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1025px)");
    const closeMobileMenu = () => { if (desktop.matches) menu.current?.close(); };
    desktop.addEventListener("change", closeMobileMenu);
    function shortcuts(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        search.current?.focus();
      }
      if (event.key === "Escape") setSearching(false);
    }
    window.addEventListener("keydown", shortcuts);
    return () => { window.removeEventListener("keydown", shortcuts); desktop.removeEventListener("change", closeMobileMenu); };
  }, []);

  return <div className="orbit-shell">
    <a className="orbit-skip-link" href="#main-content">Skip to content</a>
    <div className="orbit-desktop-nav"><Sidebar admin={member.role === "admin"} /></div>
    <dialog ref={menu} className="orbit-mobile-menu" aria-label="Workspace menu" onClick={event => { if (event.target === event.currentTarget) menu.current?.close(); }}>
      <button className="orbit-menu-close" onClick={() => menu.current?.close()} aria-label="Close navigation"><X size={20} /></button>
      <Sidebar admin={member.role === "admin"} onNavigate={() => menu.current?.close()} />
    </dialog>
    <div className="orbit-main-shell">
      <header className="orbit-topbar">
        <button className="orbit-menu-toggle" onClick={() => menu.current?.showModal()} aria-label="Open navigation"><Menu size={20} /></button>
        <p className="orbit-breadcrumb" title={`Workspace / ${current}`}>Workspace <span>/</span> {current}</p>
        <div className="orbit-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearching(false); }}>
          <button className="orbit-search-toggle" aria-label="Search workspace" aria-expanded={searching} aria-controls="workspace-search-results" onClick={() => search.current?.focus()}><Search size={14} aria-hidden="true" /></button>
          <input ref={search} type="search" aria-label="Search workspace pages" placeholder="Search everything" value={query} onChange={event => { setQuery(event.target.value); setSearching(true); }} onFocus={() => setSearching(true)} aria-controls="workspace-search-results" />
          <kbd>⌘ K</kbd>
          {searching && <div id="workspace-search-results" className="orbit-search-results">
            <p className="orbit-eyebrow">Workspace pages</p>
            {results.length ? results.map(page => <Link key={page.href} href={page.href} onClick={() => { setSearching(false); setQuery(""); }}>{page.label}<span aria-hidden="true">↗</span></Link>) : <p className="orbit-search-empty">No pages found.</p>}
          </div>}
        </div>
        <span className="orbit-badge orbit-badge-green orbit-sandbox"><span className="orbit-dot" />Sandbox mode</span>
        <button onClick={() => void signOut({ redirectTo: "/login" })} className="orbit-user-avatar" aria-label={`Sign out ${member.email}`} title={`Sign out ${member.email}`}>{(member.name || member.email).slice(0, 2).toUpperCase()}</button>
      </header>
      <main id="main-content" className="orbit-main" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
