"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Bot,
  CalendarClock,
  Files,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
  TimerReset,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assignments", label: "Assignments", icon: CalendarClock },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/announcements", label: "Announcements", icon: Bell },
  { href: "/files", label: "Files", icon: Files },
  { href: "/study-sessions", label: "Study Sessions", icon: TimerReset },
  { href: "/chat", label: "AI Chat", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileNav = [nav[0], nav[1], nav[5], nav[6]];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r-2 border-surface-variant bg-background px-5 py-6 md:flex">
        <Link href="/dashboard" className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-primary shadow-sm ring-4 ring-primary/10">
            <Bot className="h-8 w-8" />
          </div>
          <p className="text-2xl font-bold text-primary">Study Sidekick</p>
          <p className="text-sm text-muted">Ready to focus?</p>
        </Link>

        <Link
          href="/study-sessions"
          className="hover-squish mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md"
        >
          <TimerReset className="h-4 w-4" />
          Start Session
        </Link>

        <nav className="custom-scrollbar mt-6 flex-1 space-y-1 overflow-y-auto pb-4">
          {nav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition active:scale-[0.98]",
                  isActive
                    ? "bg-primary-container text-primary"
                    : "text-muted hover:bg-surface-container hover:text-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

          <div className="mt-4 border-t-2 border-surface-variant pt-4">
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold text-muted transition hover:bg-surface-container hover:text-foreground"
            >
              <HelpCircle className="h-5 w-5" />
              Support
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-bold text-muted transition hover:bg-red-50 hover:text-danger dark:hover:bg-red-950/30"
            >
              <LogOut className="h-5 w-5" />
              Log Out
            </button>
          </div>
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t-2 border-surface-variant bg-surface-container/95 px-3 py-2 backdrop-blur md:hidden">
        {mobileNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold",
                isActive ? "bg-primary-container text-primary" : "text-muted",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
