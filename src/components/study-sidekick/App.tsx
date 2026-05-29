'use client';

// src/App.tsx
import { useState } from 'react';
import { type ViewType } from './lib/utils';
import SideNav from './components/SideNav';
import DashboardView from './views/DashboardView';
import AssignmentsView from './views/AssignmentsView';
import CoursesView from './views/CoursesView';
import AnnouncementsView from './views/AnnouncementsView';
import FilesView from './views/FilesView';
import StudySessionsView from './views/StudySessionsView';
import AiChatView from './views/AiChatView';

export default function App({ initialView = 'dashboard' }: { initialView?: ViewType }) {
  const [activeView, setActiveView] = useState<ViewType>(initialView);

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex w-full selection:bg-primary/20">
      <SideNav activeView={activeView} onNavigate={setActiveView} />
      
      {/* Mobile nav indicator - very simple placeholder for small screens */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-surface-container border-t-2 border-surface-variant z-50 p-sm flex justify-around">
        {(['dashboard', 'assignments', 'courses', 'chat'] as ViewType[]).map(view => (
          <button 
            key={view} 
            onClick={() => setActiveView(view)}
            className={`p-sm rounded-lg flex flex-col items-center ${activeView === view ? 'text-primary bg-primary-container' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {view === 'dashboard' ? 'dashboard' : 
               view === 'assignments' ? 'assignment' : 
               view === 'courses' ? 'school' : 'smart_toy'}
            </span>
          </button>
        ))}
      </div>

      <main className="md:pl-[280px] flex-grow flex flex-col min-h-screen pb-16 md:pb-0 relative w-full">
        <div className="w-full flex-grow flex flex-col">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'assignments' && <AssignmentsView />}
          {activeView === 'courses' && <CoursesView />}
          {activeView === 'announcements' && <AnnouncementsView />}
          {activeView === 'files' && <FilesView />}
          {activeView === 'sessions' && <StudySessionsView />}
          {activeView === 'chat' && <AiChatView />}
        </div>
      </main>
    </div>
  );
}
