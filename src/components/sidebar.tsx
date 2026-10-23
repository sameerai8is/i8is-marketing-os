import { Calendar, Brain, LayoutDashboard, Megaphone, Image as ImageIcon, BarChart3, Settings } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/company-brain", label: "Company Brain", icon: Brain },
  { href: "/campaigns", label: "Campaign Studio", icon: Megaphone },
  { href: "/calendar", label: "Content Calendar", icon: Calendar },
  { href: "/creative", label: "Creative Studio", icon: ImageIcon },
  { href: "/performance", label: "Performance", icon: BarChart3 },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-background flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-semibold tracking-tight">I8IS Marketing OS</h1>
        <p className="text-xs text-muted-foreground mt-1">Internal Prototype</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
