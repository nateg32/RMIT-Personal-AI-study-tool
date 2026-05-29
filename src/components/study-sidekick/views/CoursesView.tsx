// src/views/CoursesView.tsx

export default function CoursesView() {
  return (
    <div className="px-margin-desktop pb-xl">
      <header className="bg-background/80 backdrop-blur-md flex justify-between items-center w-full py-md max-w-7xl mx-auto sticky top-0 z-30 mb-md -mx-margin-desktop px-margin-desktop">
        <div className="flex items-center gap-lg flex-1">
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary whitespace-nowrap">Study Command Centre</h1>
          <div className="relative hidden lg:block flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input className="bg-surface-container-low border-2 border-outline-variant rounded-full px-lg py-sm pl-xl w-full focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all" placeholder="Search your knowledge..." type="text" />
          </div>
        </div>
        <div className="flex items-center gap-md">
          <button className="p-sm rounded-full text-on-surface-variant hover:bg-primary-container/50 transition-all duration-200 active:scale-95">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-sm rounded-full text-on-surface-variant hover:bg-primary-container/50 transition-all duration-200 active:scale-95">
            <span className="material-symbols-outlined">auto_awesome</span>
          </button>
          <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary-container flex items-center justify-center">
             <span className="material-symbols-outlined text-primary">person</span>
          </div>
        </div>
      </header>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-lg gap-md mt-lg max-w-7xl mx-auto w-full">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm mb-xs">
            <span className="text-primary material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>colors_spark</span>
            <span className="font-label-md text-label-md text-primary uppercase tracking-widest font-bold">Current Enrolment</span>
          </div>
          <h2 className="font-display-lg text-display-lg text-on-surface">Your Curated Library</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">Organized by priority and your academic focus. Keep growing your knowledge, one lesson at a time.</p>
        </div>
        <div className="flex gap-sm">
          <button className="flex items-center gap-sm bg-surface-container border-2 border-outline-variant px-lg py-md rounded-full font-label-md text-label-md hover:bg-surface-variant transition-all active:scale-95">
            <span className="material-symbols-outlined">filter_list</span> Filter
          </button>
          <button className="flex items-center gap-sm bg-primary text-on-primary px-lg py-md rounded-full font-label-md text-label-md hover:shadow-lg transition-all active:scale-95">
            <span className="material-symbols-outlined">add</span> New Course
          </button>
        </div>
      </div>

      {/* Bento Grid of Course Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter max-w-7xl mx-auto w-full">
        {/* Biology Card */}
        <div className="bg-primary-container/20 border-2 border-primary-container p-md rounded-lg bubbly-shadow relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute -right-base -top-base opacity-10 group-hover:rotate-12 transition-transform">
            <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-lg">
              <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-primary-fixed-dim">
                <span className="material-symbols-outlined text-primary">science</span>
              </div>
              <span className="bg-primary-container text-on-primary-container px-sm py-xs rounded-full font-label-sm text-label-sm">Active</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-background mb-base">Cellular Biology</h3>
            <div className="flex items-center gap-sm text-on-surface-variant mb-md">
              <span className="material-symbols-outlined text-md">schedule</span>
              <span className="font-label-md text-label-md">Next: Lab Session @ 2PM</span>
            </div>
            {/* Progress Section */}
            <div className="mb-lg">
              <div className="flex justify-between items-center mb-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Course Progress</span>
                <span className="font-label-sm text-label-sm font-bold text-primary">68%</span>
              </div>
              <div className="h-4 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary progress-candy" style={{ width: '68%' }}></div>
              </div>
            </div>
            {/* Stats & Links */}
            <div className="grid grid-cols-2 gap-sm mb-lg">
              <div className="bg-surface-container-low p-sm rounded-md flex flex-col items-center border border-outline-variant">
                <span className="font-headline-md text-headline-md text-primary">4</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Assignments</span>
              </div>
              <div className="bg-surface-container-low p-sm rounded-md flex flex-col items-center border border-outline-variant">
                <span className="font-headline-md text-headline-md text-primary">12</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Resources</span>
              </div>
            </div>
            <div className="flex gap-sm">
              <button className="flex-grow flex items-center justify-center gap-xs bg-white/80 border-2 border-primary-container py-sm rounded-full font-label-md text-label-md hover:bg-primary-container transition-all">
                <span className="material-symbols-outlined text-sm">folder</span> Files
              </button>
              <button className="flex-grow flex items-center justify-center gap-xs bg-white/80 border-2 border-primary-container py-sm rounded-full font-label-md text-label-md hover:bg-primary-container transition-all">
                <span className="material-symbols-outlined text-sm">assignment</span> Tasks
              </button>
            </div>
          </div>
        </div>

        {/* Modern History Card */}
        <div className="bg-tertiary-container/30 border-2 border-tertiary-container p-md rounded-lg bubbly-shadow relative overflow-hidden group sticky-note-rotate-alt hover:rotate-0 transition-transform duration-300">
          <div className="absolute -right-base -top-base opacity-10 group-hover:-rotate-12 transition-transform">
            <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-lg">
              <div className="w-12 h-12 bg-tertiary-container rounded-full flex items-center justify-center text-on-tertiary-container">
                <span className="material-symbols-outlined">castle</span>
              </div>
              <span className="bg-tertiary-container text-on-tertiary-container px-sm py-xs rounded-full font-label-sm text-label-sm">Due Soon</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-background mb-base">Modern History</h3>
            <div className="flex items-center gap-sm text-on-surface-variant mb-md">
              <span className="material-symbols-outlined text-md">event</span>
              <span className="font-label-md text-label-md">Essay due in 3 days</span>
            </div>
            {/* Progress Section */}
            <div className="mb-lg">
              <div className="flex justify-between items-center mb-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Course Progress</span>
                <span className="font-label-sm text-label-sm font-bold text-tertiary">42%</span>
              </div>
              <div className="h-4 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-tertiary progress-candy" style={{ width: '42%' }}></div>
              </div>
            </div>
            {/* Stats & Links */}
            <div className="grid grid-cols-2 gap-sm mb-lg">
              <div className="bg-surface-container-low p-sm rounded-md flex flex-col items-center border border-outline-variant">
                <span className="font-headline-md text-headline-md text-tertiary">2</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Assignments</span>
              </div>
              <div className="bg-surface-container-low p-sm rounded-md flex flex-col items-center border border-outline-variant">
                <span className="font-headline-md text-headline-md text-tertiary">8</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Resources</span>
              </div>
            </div>
            <div className="flex gap-sm">
              <button className="flex-grow flex items-center justify-center gap-xs bg-white/80 border-2 border-tertiary-container py-sm rounded-full font-label-md text-label-md hover:bg-tertiary-container transition-all">
                <span className="material-symbols-outlined text-sm">folder</span> Files
              </button>
              <button className="flex-grow flex items-center justify-center gap-xs bg-white/80 border-2 border-tertiary-container py-sm rounded-full font-label-md text-label-md hover:bg-tertiary-container transition-all">
                <span className="material-symbols-outlined text-sm">assignment</span> Tasks
              </button>
            </div>
          </div>
        </div>

        {/* Calculus Card */}
        <div className="bg-secondary-container/20 border-2 border-secondary-container p-md rounded-lg bubbly-shadow relative overflow-hidden group sticky-note-rotate hover:rotate-0 transition-transform duration-300">
          <div className="absolute -right-base -top-base opacity-10 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>calculate</span>
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-lg">
              <div className="w-12 h-12 bg-secondary-container rounded-full flex items-center justify-center text-on-secondary-container">
                <span className="material-symbols-outlined">functions</span>
              </div>
              <span className="bg-secondary-container text-on-secondary-container px-sm py-xs rounded-full font-label-sm text-label-sm">High Priority</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-background mb-base">Advanced Calculus</h3>
            <div className="flex items-center gap-sm text-on-surface-variant mb-md">
              <span className="material-symbols-outlined text-md">psychology</span>
              <span className="font-label-md text-label-md">Practice Quiz Available</span>
            </div>
            {/* Progress Section */}
            <div className="mb-lg">
              <div className="flex justify-between items-center mb-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Course Progress</span>
                <span className="font-label-sm text-label-sm font-bold text-secondary">85%</span>
              </div>
              <div className="h-4 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-secondary progress-candy" style={{ width: '85%' }}></div>
              </div>
            </div>
            {/* Stats & Links */}
            <div className="grid grid-cols-2 gap-sm mb-lg">
              <div className="bg-surface-container-low p-sm rounded-md flex flex-col items-center border border-outline-variant">
                <span className="font-headline-md text-headline-md text-secondary">7</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Assignments</span>
              </div>
              <div className="bg-surface-container-low p-sm rounded-md flex flex-col items-center border border-outline-variant">
                <span className="font-headline-md text-headline-md text-secondary">24</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Resources</span>
              </div>
            </div>
            <div className="flex gap-sm">
              <button className="flex-grow flex items-center justify-center gap-xs bg-white/80 border-2 border-secondary-container py-sm rounded-full font-label-md text-label-md hover:bg-secondary-container transition-all">
                <span className="material-symbols-outlined text-sm">folder</span> Files
              </button>
              <button className="flex-grow flex items-center justify-center gap-xs bg-white/80 border-2 border-secondary-container py-sm rounded-full font-label-md text-label-md hover:bg-secondary-container transition-all">
                <span className="material-symbols-outlined text-sm">assignment</span> Tasks
              </button>
            </div>
          </div>
        </div>

        {/* Add New Course State */}
        <div className="border-4 border-dashed border-outline-variant p-md rounded-lg flex flex-col items-center justify-center min-h-[400px] text-center group cursor-pointer hover:border-primary/50 transition-all">
          <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-md group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant group-hover:text-primary">add_circle</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface-variant group-hover:text-primary transition-colors">Explore more</h3>
          <p className="font-body-md text-on-surface-variant mt-sm px-lg">Browse the catalog to add elective courses or join study groups.</p>
        </div>
      </div>
    </div>
  );
}
