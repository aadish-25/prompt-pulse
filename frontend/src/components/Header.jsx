import React, { useState, useEffect, useRef } from 'react';
import { Radar, ChevronDown, Home, LayoutDashboard, Cpu, Repeat, Play, Plus, Loader2 } from 'lucide-react';

export default function Header({
  activeProject,
  projects,
  onSelectProject,
  onOpenNewProjectModal,
  currentView,
  onToggleView,
  selectedModel,
  onSelectModel,
  supportedModels,
  selectedRounds,
  onSelectRounds,
  onRunBatch,
  isRunningBatch
}) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [roundsOpen, setRoundsOpen] = useState(false);

  const headerRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setProjectOpen(false);
        setModelOpen(false);
        setRoundsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header ref={headerRef} className="border-b border-surface-border bg-surface-850 sticky top-0 z-40 px-6 py-3 flex items-center justify-between">
      {/* Brand & Project Switcher */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => onToggleView('dashboard')}
          className="flex items-center gap-2.5 text-left focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <Radar className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-base">PromptPulse</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
              GEO Tracker
            </span>
          </div>
        </button>

        <div className="h-5 w-px bg-surface-border"></div>

        {/* Project Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setProjectOpen(!projectOpen); setModelOpen(false); setRoundsOpen(false); }}
            className="flex items-center gap-2 text-sm bg-surface-900 hover:bg-surface-800 border border-surface-border rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-semibold text-white">{activeProject?.brand_name || 'Select Project'}</span>
            <span className="text-xs text-slate-500">
              {activeProject?.domain?.[0] || 'amul.com'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {projectOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-64 bg-surface-850 border border-surface-border rounded-xl shadow-2xl z-50 p-1.5 space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Active Projects
              </div>
              {projects.map((p) => {
                const isActive = p.id === activeProject?.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { onSelectProject(p); setProjectOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-500/10 border border-blue-500/20 text-white'
                        : 'text-slate-300 hover:bg-surface-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                      {p.brand_name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {p.domain?.[0] || 'domain'}
                    </span>
                  </button>
                );
              })}
              <div className="pt-1 border-t border-surface-border">
                <button
                  onClick={() => { setProjectOpen(false); onOpenNewProjectModal(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-blue-400 hover:bg-blue-500/10 font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Brand Project</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* View Switcher Toggle */}
        <button
          onClick={() => onToggleView(currentView === 'dashboard' ? 'landing' : 'dashboard')}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-900 hover:bg-surface-800 border border-surface-border text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {currentView === 'dashboard' ? (
            <>
              <Home className="w-3.5 h-3.5 text-blue-400" />
              <span>Landing View</span>
            </>
          ) : (
            <>
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
              <span>Dashboard View</span>
            </>
          )}
        </button>
      </div>

      {/* Execution Control Center */}
      <div className="flex items-center gap-3">
        {/* Model Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setModelOpen(!modelOpen); setProjectOpen(false); setRoundsOpen(false); }}
            className="flex items-center gap-2 text-xs bg-surface-900 hover:bg-surface-800 border border-surface-border rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Model:</span>
            <span className="text-white font-medium">{selectedModel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {modelOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-60 bg-surface-850 border border-surface-border rounded-xl shadow-2xl z-50 p-1 space-y-0.5">
              {supportedModels.map((m) => (
                <button
                  key={m}
                  onClick={() => { onSelectModel(m); setModelOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    selectedModel === m
                      ? 'text-white bg-blue-500/10 border border-blue-500/20 font-semibold'
                      : 'text-slate-300 hover:bg-surface-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rounds Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setRoundsOpen(!roundsOpen); setProjectOpen(false); setModelOpen(false); }}
            className="flex items-center gap-2 text-xs bg-surface-900 hover:bg-surface-800 border border-surface-border rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
          >
            <Repeat className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Rounds:</span>
            <span className="text-white font-medium">{selectedRounds} {selectedRounds === 1 ? 'Round' : 'Rounds'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {roundsOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-32 bg-surface-850 border border-surface-border rounded-xl shadow-2xl z-50 p-1 space-y-0.5">
              {[1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => { onSelectRounds(r); setRoundsOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    selectedRounds === r
                      ? 'text-white bg-blue-500/10 border border-blue-500/20 font-semibold'
                      : 'text-slate-300 hover:bg-surface-800'
                  }`}
                >
                  {r} {r === 1 ? 'Round' : 'Rounds'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Run Batch CTA */}
        <button
          onClick={onRunBatch}
          disabled={isRunningBatch}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors shadow-blue-600/20 cursor-pointer"
        >
          {isRunningBatch ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Tracking Batch</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
