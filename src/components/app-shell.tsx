import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { AmbientBackground } from "@/components/ambient-background";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <AmbientBackground className="opacity-55 dark:opacity-45" />
      <AppNav />
      <div className="relative z-10 pb-20 md:ml-[280px] md:pb-0">
        <header className="sticky top-0 z-20 border-b-2 border-surface-variant bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/dashboard" className="font-semibold">
            Study Sidekick
          </Link>
        </header>
        <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 md:px-8 lg:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
