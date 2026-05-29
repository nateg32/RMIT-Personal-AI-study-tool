// src/views/FilesView.tsx

export default function FilesView() {
  return (
    <div className="px-margin-desktop pb-lg min-h-screen w-full relative">
      <header className="flex justify-between items-center w-full py-md max-w-7xl mx-auto mb-lg sticky top-0 z-30 bg-background/80 backdrop-blur-md -mx-margin-desktop px-margin-desktop">
        <div className="flex items-center gap-md flex-1">
          <h2 className="font-headline-lg text-headline-lg font-bold text-primary whitespace-nowrap">Study Command Centre</h2>
          <div className="relative flex-1 max-w-md hidden md:block border-2 border-outline-variant rounded-full bg-surface-container">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input className="w-full pl-xl pr-md py-sm bg-transparent border-none focus:outline-none focus:ring-0 text-body-md" placeholder="Search your files..." type="text"/>
          </div>
        </div>
        <div className="flex items-center gap-sm">
          <button className="p-sm rounded-full hover:bg-primary-container/50 transition-all">
            <span className="material-symbols-outlined text-primary">notifications</span>
          </button>
          <button className="p-sm rounded-full hover:bg-primary-container/50 transition-all">
            <span className="material-symbols-outlined text-primary">auto_awesome</span>
          </button>
          <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">person</span>
          </div>
        </div>
      </header>

      {/* Category Tabs */}
      <section className="mb-lg">
        <div className="flex flex-wrap gap-sm">
          <button className="px-lg py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md bubbly-button shadow-sm">Recent</button>
          <button className="px-lg py-sm bg-tertiary-container text-on-tertiary-container rounded-full font-label-md text-label-md bubbly-button hover:bg-tertiary-fixed transition-colors">By Course</button>
          <button className="px-lg py-sm bg-secondary-container text-on-secondary-container rounded-full font-label-md text-label-md bubbly-button hover:bg-secondary-fixed transition-colors">Notes</button>
          <button className="px-lg py-sm bg-surface-container text-on-surface-variant rounded-full font-label-md text-label-md bubbly-button border-2 border-outline-variant hover:border-primary transition-colors">Submissions</button>
        </div>
      </section>

      {/* Bento Grid File Explorer */}
      <section className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-gutter mb-xl relative z-10">
        {/* Large Folder Card */}
        <div className="md:col-span-2 lg:col-span-2 sticky-note bg-primary-container/30 border-2 border-primary-fixed-dim p-md rounded-lg flex flex-col justify-between">
          <div>
            <span className="material-symbols-outlined text-primary text-[48px] mb-sm" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
            <h3 className="font-headline-md text-headline-md text-on-primary-container">Biology 101</h3>
            <p className="font-label-md text-on-surface-variant">12 Files • Last modified 2h ago</p>
          </div>
          <div className="mt-lg flex -space-x-sm">
            <div className="w-8 h-8 rounded-full bg-white border-2 border-primary-container flex items-center justify-center text-[12px] font-bold">PDF</div>
            <div className="w-8 h-8 rounded-full bg-white border-2 border-primary-container flex items-center justify-center text-[12px] font-bold">DOC</div>
            <div className="w-8 h-8 rounded-full bg-white border-2 border-primary-container flex items-center justify-center text-[12px] font-bold">+9</div>
          </div>
        </div>

        {/* PDF File Card */}
        <div className="sticky-note bg-surface-container-lowest border-2 border-secondary-container p-md rounded-lg flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-secondary-container rounded-lg flex items-center justify-center mb-md">
            <span className="material-symbols-outlined text-secondary text-[40px]">picture_as_pdf</span>
          </div>
          <p className="font-label-md text-label-md font-bold mb-xs truncate w-full">Midterm_Review.pdf</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">2.4 MB</p>
        </div>

        {/* Notes Card */}
        <div className="sticky-note bg-tertiary-container/40 border-2 border-tertiary-fixed-dim p-md rounded-lg flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-tertiary-fixed rounded-lg flex items-center justify-center mb-md">
            <span className="material-symbols-outlined text-tertiary text-[40px]">description</span>
          </div>
          <p className="font-label-md text-label-md font-bold mb-xs truncate w-full">Lecture_Notes_W4</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">15 KB</p>
        </div>

        {/* Another Course Folder */}
        <div className="md:col-span-2 sticky-note bg-secondary-container/20 border-2 border-secondary-fixed-dim p-md rounded-lg flex items-center gap-md">
          <span className="material-symbols-outlined text-secondary text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>folder_open</span>
          <div>
            <h3 className="font-headline-md text-headline-md text-on-secondary-container">Calculus II</h3>
            <p className="font-label-md text-on-surface-variant">8 Items</p>
          </div>
          <button className="ml-auto bubbly-button text-secondary">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        {/* Submission Doc */}
        <div className="sticky-note bg-surface-container-lowest border-2 border-outline-variant p-md rounded-lg flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-surface-container-high rounded-lg flex items-center justify-center mb-md">
            <span className="material-symbols-outlined text-outline text-[40px]">task</span>
          </div>
          <p className="font-label-md text-label-md font-bold mb-xs truncate w-full">Essay_Draft_V2</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Uploaded today</p>
        </div>

        {/* Spreadsheet File */}
        <div className="sticky-note bg-primary-container/20 border-2 border-primary-fixed-dim p-md rounded-lg flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary-fixed rounded-lg flex items-center justify-center mb-md">
            <span className="material-symbols-outlined text-primary text-[40px]">table_chart</span>
          </div>
          <p className="font-label-md text-label-md font-bold mb-xs truncate w-full">Budget_Tracker</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">45 KB</p>
        </div>
      </section>

      {/* Drag and Drop Area */}
      <section className="max-w-4xl mx-auto">
        <div className="drag-area p-xl rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary hover:bg-primary-container/20 transition-all">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md mb-md transform rotate-3 hover:rotate-0 transition-transform">
            <span className="material-symbols-outlined text-primary text-[48px]">cloud_upload</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-primary mb-xs">Drop your study materials here!</h3>
          <p className="font-body-md text-on-surface-variant max-w-sm">Drag files from your desktop or click to browse. We support PDFs, Docs, Images, and more ✨</p>
          <div className="mt-lg flex gap-sm opacity-50 text-surface-tint">
            <span className="material-symbols-outlined">auto_awesome</span>
            <span className="material-symbols-outlined">star</span>
            <span className="material-symbols-outlined">favorite</span>
          </div>
        </div>
      </section>
    </div>
  );
}
