import Link from "next/link";
import {
  Bell,
  BookOpen,
  CalendarClock,
  Files,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  TimerReset,
} from "lucide-react";
import { AmbientBackground } from "@/components/ambient-background";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assignments", label: "Assignments", icon: CalendarClock },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/announcements", label: "Announcements", icon: Bell },
  { href: "/files", label: "Files", icon: Files },
  { href: "/study-sessions", label: "Study Sessions", icon: TimerReset },
  { href: "/chat", label: "AI Chat", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <AmbientBackground className="opacity-55 dark:opacity-45" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-card/90 px-5 py-6 shadow-sm backdrop-blur lg:block">
        <Link href="/dashboard" className="block">
          <p className="text-sm font-medium text-muted">RMIT</p>
          <h1 className="text-xl font-semibold">Study Command Centre</h1>
        </Link>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-background hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="relative z-10 lg:ml-72">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="font-semibold">
            RMIT Study Command Centre
          </Link>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
