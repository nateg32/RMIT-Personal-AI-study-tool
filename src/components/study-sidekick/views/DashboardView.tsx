/* eslint-disable react/no-unescaped-entities */
// src/views/DashboardView.tsx

export default function DashboardView() {
  return (
    <div className="p-margin-desktop min-h-screen flex flex-col">
      {/* TopNavBar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md mb-xl -mx-margin-desktop px-margin-desktop py-md">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-md flex-1">
            <span className="font-headline-lg text-headline-lg font-bold text-primary whitespace-nowrap">Study Command Centre</span>
            <div className="hidden lg:flex items-center bg-surface-container rounded-full px-md py-xs border-2 border-surface-variant flex-1 max-w-md">
              <span className="material-symbols-outlined text-on-surface-variant mr-sm">search</span>
              <input
                className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-md w-full placeholder:text-on-surface-variant/50"
                placeholder="Search assignments or files..."
                type="text"
              />
            </div>
          </div>
          <nav className="flex items-center gap-md">
            <div className="flex items-center gap-sm">
              <button className="p-sm rounded-full text-on-surface-variant hover:bg-primary-container/50 transition-all duration-200 active:scale-95">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button className="p-sm rounded-full text-on-surface-variant hover:bg-primary-container/50 transition-all duration-200 active:scale-95">
                <span className="material-symbols-outlined">auto_awesome</span>
              </button>
              <div className="w-10 h-10 rounded-full bg-primary-container border-2 border-primary overflow-hidden hover:scale-105 transition-transform cursor-pointer flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">person</span>
              </div>
            </div>
          </nav>
        </div>
      </header>

      <div className="flex-grow flex flex-col w-full max-w-7xl mx-auto">
        {/* Hero Greeting */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md mb-xl mt-md">
          <div>
            <h1 className="font-display-lg text-display-lg text-primary">Good morning, Nathaniel 👋</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Ready to conquer today's goals? Your sidekick is here to help!</p>
          </div>
          <div className="flex gap-sm">
            <button className="bg-surface-container text-on-surface-variant border-2 border-surface-variant px-md py-sm rounded-full font-bold hover-squish flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Generate brief
            </button>
            <button className="bg-surface-container text-on-surface-variant border-2 border-surface-variant px-md py-sm rounded-full font-bold hover-squish flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">sync</span>
              Sync now
            </button>
            <button className="bg-primary text-on-primary px-lg py-sm rounded-full font-bold hover-squish shadow-md flex items-center gap-sm">
              <span className="material-symbols-outlined">play_arrow</span>
              Start focus session
            </button>
          </div>
        </section>

        {/* Top Row Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-xl">
          {/* Daily Brief Card */}
          <div className="lg:col-span-8 sticky-note-yellow bubbly-shadow p-lg rounded-lg flex flex-col md:flex-row gap-lg items-center relative overflow-hidden">
            <div className="flex-1 z-10">
              <h3 className="font-headline-md text-headline-md mb-sm flex items-center gap-xs text-on-tertiary-fixed-variant">
                Daily Briefing
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              </h3>
              <p className="font-body-md mb-md text-on-tertiary-fixed-variant opacity-80">You've got a busy but manageable day ahead! Here's the snapshot:</p>
              <div className="flex gap-lg">
                <div className="flex flex-col">
                  <span className="font-display-lg text-display-lg text-primary leading-none">2</span>
                  <span className="font-label-md text-label-md uppercase tracking-wider opacity-70">Due Today</span>
                </div>
                <div className="w-[2px] h-12 bg-on-tertiary-fixed-variant/10 rounded-full"></div>
                <div className="flex flex-col">
                  <span className="font-display-lg text-display-lg text-secondary leading-none">5</span>
                  <span className="font-label-md text-label-md uppercase tracking-wider opacity-70">This Week</span>
                </div>
              </div>
            </div>
            <div className="md:w-1/3 z-10 relative">
              <div className="bg-white/40 backdrop-blur-sm p-md rounded-lg border border-white/60">
                <p className="font-label-sm text-label-sm text-primary-fixed-dim uppercase mb-xs">Next Deadline</p>
                <p className="font-bold text-body-md text-primary mb-xs">Organic Chem Lab</p>
                <div className="w-full bg-white/50 h-2 rounded-full overflow-hidden">
                  <div className="bg-primary w-3/4 h-full rounded-full"></div>
                </div>
                <p className="font-label-sm text-label-sm text-right mt-xs">Due in 4h</p>
              </div>
            </div>
          </div>

          {/* Stats Column */}
          <div className="lg:col-span-4 flex flex-col gap-sm">
            <div className="flex-1 bg-surface-container-low border-2 border-surface-variant p-md rounded-lg bubbly-shadow flex items-center justify-between hover-squish cursor-default">
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Risk Level</p>
                <p className="font-headline-md text-headline-md font-bold">Low 😇</p>
              </div>
              <span className="material-symbols-outlined text-primary text-[40px]">check_circle</span>
            </div>
            <div className="flex-1 bg-surface-container-low border-2 border-surface-variant p-md rounded-lg bubbly-shadow flex items-center justify-between hover-squish cursor-default">
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Unsubmitted</p>
                <p className="font-headline-md text-headline-md font-bold">3 Tasks</p>
              </div>
              <span className="material-symbols-outlined text-error text-[40px]">pending_actions</span>
            </div>
            <div className="flex-1 bg-surface-container-low border-2 border-surface-variant p-md rounded-lg bubbly-shadow flex items-center justify-between hover-squish cursor-default">
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Focus Streak</p>
                <p className="font-headline-md text-headline-md font-bold">5 Days 🔥</p>
              </div>
              <span className="material-symbols-outlined text-secondary text-[40px]">local_fire_department</span>
            </div>
          </div>
        </div>

        {/* Today's Mission Section */}
        <section className="mb-xl">
          <div className="flex items-center justify-between mb-lg">
            <h2 className="font-headline-lg text-headline-lg text-primary flex items-center gap-sm">
              Today's Mission
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
            </h2>
            <button className="text-primary font-bold flex items-center gap-xs hover:underline transition-all">
              View Planner
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Priority Card 1 */}
            <div className="sticky-note-mint p-lg rounded-lg bubbly-shadow flex flex-col h-full relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-xs bg-white/50 rounded-full hover:bg-white transition-colors">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              </div>
              <div className="flex items-start gap-md mb-md">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-primary">science</span>
                </div>
                <div>
                  <span className="font-label-sm text-label-sm text-primary uppercase">Bio-Chemistry</span>
                  <h4 className="font-headline-md text-headline-md text-on-primary-container">Cellular Respiration Quiz</h4>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between z-10">
                <span className="px-md py-xs bg-white/60 rounded-full font-label-sm text-label-sm border border-primary/20">90 mins</span>
                <label className="flex items-center gap-sm cursor-pointer">
                  <input className="w-5 h-5 rounded-md border-2 border-primary text-primary focus:ring-primary focus:ring-1" type="checkbox" />
                  <span className="font-bold text-primary">Done!</span>
                </label>
              </div>
              <span className="material-symbols-outlined absolute bottom-2 right-2 text-primary opacity-20 text-[60px]">bookmark_added</span>
            </div>

            {/* Priority Card 2 */}
            <div className="sticky-note-peach p-lg rounded-lg bubbly-shadow flex flex-col h-full relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-xs bg-white/50 rounded-full hover:bg-white transition-colors">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              </div>
              <div className="flex items-start gap-md mb-md">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-tertiary">history_edu</span>
                </div>
                <div>
                  <span className="font-label-sm text-label-sm text-tertiary uppercase">Modern History</span>
                  <h4 className="font-headline-md text-headline-md text-on-tertiary-container">Draft Intro: French Revolution</h4>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between z-10">
                <span className="px-md py-xs bg-white/60 rounded-full font-label-sm text-label-sm border border-tertiary/20">45 mins</span>
                <label className="flex items-center gap-sm cursor-pointer">
                  <input className="w-5 h-5 rounded-md border-2 border-tertiary text-tertiary focus:ring-tertiary focus:ring-1" type="checkbox" />
                  <span className="font-bold text-tertiary">Done!</span>
                </label>
              </div>
              <span className="material-symbols-outlined absolute bottom-2 right-2 text-tertiary opacity-20 text-[60px]">history_edu</span>
            </div>

            {/* Priority Card 3 */}
            <div className="sticky-note-lavender p-lg rounded-lg bubbly-shadow flex flex-col h-full relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-xs bg-white/50 rounded-full hover:bg-white transition-colors">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              </div>
              <div className="flex items-start gap-md mb-md">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-secondary">calculate</span>
                </div>
                <div>
                  <span className="font-label-sm text-label-sm text-secondary uppercase">Calculus III</span>
                  <h4 className="font-headline-md text-headline-md text-on-secondary-container">Practice Problems #1-15</h4>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between z-10">
                <span className="px-md py-xs bg-white/60 rounded-full font-label-sm text-label-sm border border-secondary/20">120 mins</span>
                <label className="flex items-center gap-sm cursor-pointer">
                  <input className="w-5 h-5 rounded-md border-2 border-secondary text-secondary focus:ring-secondary focus:ring-1" type="checkbox" />
                  <span className="font-bold text-secondary">Done!</span>
                </label>
              </div>
              <span className="material-symbols-outlined absolute bottom-2 right-2 text-secondary opacity-20 text-[60px]">functions</span>
            </div>
          </div>
        </section>

        {/* Motivational Quote Section */}
        <section className="mt-auto py-lg text-center flex flex-col items-center">
          <div className="max-w-2xl px-lg py-md bg-white/30 backdrop-blur-sm rounded-xl border border-surface-variant relative">
            <span className="material-symbols-outlined text-primary-fixed-dim absolute -top-4 -left-4 text-3xl animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <p className="font-headline-md italic text-on-surface-variant leading-relaxed">
              "Success is the sum of small efforts, repeated day in and day out."
            </p>
            <div className="mt-sm flex items-center justify-center gap-xs">
              <span className="material-symbols-outlined text-tertiary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>colors_spark</span>
              <p className="font-label-md text-tertiary uppercase tracking-widest">— Robert Collier</p>
              <span className="material-symbols-outlined text-tertiary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>colors_spark</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
