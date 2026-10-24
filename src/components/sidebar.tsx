"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const workspacePages = [
  { href: "/", label: "Overview" },
  { href: "/calendar", label: "Planner" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/creative", label: "Creative lab" },
  { href: "/performance", label: "Intelligence" },
  { href: "/company-brain", label: "Company DNA" },
  { href: "/settings", label: "Settings" },
];

const navGroups = [
  [
    { glyph: "◫", label: "Overview", href: "/" },
    { glyph: "◉", label: "AI workforce", href: "/#workforce" },
    { glyph: "⌕", label: "Discover", href: null },
    { glyph: "↗", label: "Strategy", href: null },
  ],
  [
    { glyph: "▦", label: "Planner", href: "/calendar" },
    { glyph: "◧", label: "Campaigns", href: "/campaigns" },
    { glyph: "✦", label: "Creative lab", href: "/creative" },
    { glyph: "≡", label: "Editorial", href: null },
    { glyph: "▤", label: "Assets", href: null },
    { glyph: "◎", label: "Approvals", href: null },
  ],
  [
    { glyph: "◷", label: "Intelligence", href: "/performance" },
    { glyph: "▥", label: "Social inbox", href: null },
  ],
  [
    { glyph: "◫", label: "Company DNA", href: "/company-brain" },
    { glyph: "⇄", label: "Connections", href: "/settings#buffer-heading" },
    { glyph: "⚙", label: "Settings", href: "/settings" },
  ],
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="orbit-sidebar" aria-label="Workspace navigation">
      <Link href="/" onClick={onNavigate} className="orbit-brand" aria-label="Orbit by I8IS home">
        <span className="orbit-brand-mark" aria-hidden="true">✳</span>
        <span className="orbit-wordmark">orbit</span><span className="orbit-brand-by">by I8IS</span>
      </Link>
      <p className="orbit-nav-eyebrow">Marketing intelligence</p>
      <nav className="orbit-nav">
        {navGroups.map((group, index) => <div key={index} className="orbit-nav-group">
          {group.map(item => {
            const active = item.href === pathname;
            const contents = <><span className="orbit-nav-glyph" aria-hidden="true">{item.glyph}</span><span>{item.label}</span></>;
            return item.href ? <Link key={item.label} href={item.href} onClick={onNavigate} className={`orbit-nav-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>{contents}</Link>
              : <span key={item.label} className="orbit-nav-item is-planned" aria-disabled="true" title={`${item.label} — coming soon`}>{contents}<span className="sr-only"> (coming soon)</span></span>;
          })}
        </div>)}
      </nav>
      <div className="orbit-workspace"><span className="orbit-workspace-avatar">i8</span><div><p>I8IS workspace</p><span>Internal · Sandbox mode</span></div></div>
    </aside>
  );
}
