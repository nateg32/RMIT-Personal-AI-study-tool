// src/components/SideNav.tsx
import { type ViewType } from '../lib/utils';
import { cn } from '../lib/utils';

interface SideNavProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  onStartSession: () => void;
  onSupport: () => void;
  onLogout: () => void;
}

const navItems = [
  { id: 'dashboard' as const, icon: 'dashboard', label: 'Dashboard' },
  { id: 'assignments' as const, icon: 'assignment', label: 'Assignments' },
  { id: 'courses' as const, icon: 'school', label: 'Courses' },
  { id: 'announcements' as const, icon: 'campaign', label: 'Announcements' },
  { id: 'files' as const, icon: 'folder', label: 'Files' },
  { id: 'sessions' as const, icon: 'timer', label: 'Study Sessions' },
  { id: 'chat' as const, icon: 'smart_toy', label: 'AI Chat' },
  { id: 'settings' as const, icon: 'settings', label: 'Settings' },
];

export default function SideNav({ activeView, onNavigate, onStartSession, onSupport, onLogout }: SideNavProps) {
  return (
    <aside className="fixed left-0 top-0 h-full w-[280px] bg-background border-r-2 border-surface-variant z-40 hidden md:flex flex-col">
      <div className="p-xl flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center mb-sm shadow-sm ring-4 ring-primary/10">
          <span className="material-symbols-outlined text-primary text-3xl">smart_toy</span>
        </div>
        <h2 className="font-headline-md text-headline-md font-bold text-primary">Study Sidekick</h2>
        <p className="font-body-md text-on-surface-variant opacity-80">Ready to focus?</p>
      </div>

      <div className="px-lg pb-md">
        <button
          type="button"
          className="w-full bg-primary text-on-primary font-bold py-sm rounded-full shadow-md hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-sm"
          onClick={onStartSession}
        >
          <span className="material-symbols-outlined">timer</span>
          Start Session
        </button>
      </div>

      <nav className="flex-1 px-lg overflow-y-auto space-y-xs custom-scrollbar pb-lg">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-sm px-md py-sm rounded-lg transition-transform",
                isActive
                  ? "bg-primary-container text-primary font-bold"
                  : "text-on-surface-variant hover:bg-surface-variant hover:text-on-surface scale-100 active:scale-95"
              )}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-label-md text-label-md">{item.label}</span>
            </button>
          );
        })}
        
        <div className="pt-md mt-md space-y-xs">
          <div className="h-[2px] bg-surface-variant rounded-full mb-md mx-md"></div>
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-sm px-md py-sm text-left rounded-lg transition-all",
              activeView === "support"
                ? "bg-primary-container text-primary font-bold"
                : "text-on-surface-variant hover:bg-surface-variant"
            )}
            onClick={onSupport}
          >
            <span className="material-symbols-outlined">help</span>
            <span className="font-label-md text-label-md">Support</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-sm text-on-surface-variant px-md py-sm hover:bg-error-container hover:text-error text-left rounded-lg transition-all"
            onClick={onLogout}
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-label-md text-label-md">Log Out</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
