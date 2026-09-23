import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Radar, ChevronDown, Cpu, Repeat, Play, Plus, Loader2, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Header - sticky top nav.
 * - Execution controls (model, rounds, run batch) are only visible on /dashboard.
 * - No landing/dashboard toggle buttons — routing is handled by react-router-dom.
 * - Project switcher shows on all pages so users can always switch or create projects.
 */
export default function Header({
  activeProject,
  projects,
  onSelectProject,
  onOpenNewProjectModal,
  onDeleteProject,
  isDashboard,
  selectedModel,
  onSelectModel,
  supportedModels,
  selectedRounds,
  onSelectRounds,
  onRunBatch,
  isRunningBatch,
  batchProgress = null,
}) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [roundsOpen, setRoundsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { id, name }

  const headerRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setProjectOpen(false);
        setModelOpen(false);
        setRoundsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleRequestDelete = (e, project) => {
    e.stopPropagation();
    setPendingDelete({ id: project.id, name: project.brand_name });
    setProjectOpen(false);
  };

  const handleConfirmDelete = () => {
    if (pendingDelete && onDeleteProject) onDeleteProject(pendingDelete.id);
    setPendingDelete(null);
  };

  const activeProjectDomain = activeProject?.domain?.[0] || '';

  return (
    <>
      <header
        ref={headerRef}
        className="border-b border-surface-border bg-surface-850 sticky top-0 z-40 px-6 py-3 flex items-center justify-between"
      >
        {/* Left: Brand logo + project switcher */}
        <div className="flex items-center gap-5">
          {/* Logo -> Clickable link to landing page */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group cursor-pointer hover:opacity-90 transition-opacity"
            title="PromptPulse Home"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Radar className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-white text-base group-hover:text-blue-300 transition-colors">PromptPulse</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                GEO Tracker
              </span>
            </div>
          </Link>

          <div className="h-5 w-px bg-surface-border" />

          {/* Project switcher dropdown */}
          <div className="relative">
            <button
              onClick={() => { setProjectOpen(!projectOpen); setModelOpen(false); setRoundsOpen(false); }}
              className="flex items-center gap-2 text-sm bg-surface-900 hover:bg-surface-800 border border-surface-border rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full ${activeProject ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span className="font-semibold text-white">
                {activeProject?.brand_name || 'Select Project'}
              </span>
              {activeProjectDomain && (
                <span className="text-xs text-slate-500">{activeProjectDomain}</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {projectOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-72 bg-surface-850 border border-surface-border rounded-xl shadow-2xl z-50 p-1.5 space-y-0.5">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Projects
                </div>

                {projects.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-500 italic">No projects yet</div>
                ) : (
                  projects.map((p) => {
                    const isActive = p.id === activeProject?.id;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center rounded-lg text-xs font-semibold transition-colors ${
                          isActive
                            ? 'bg-blue-500/10 border border-blue-500/20 text-white'
                            : 'text-slate-300 hover:bg-surface-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => { onSelectProject(p); setProjectOpen(false); }}
                          className="flex-1 flex items-center justify-between px-2.5 py-2 text-left cursor-pointer min-w-0"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                            <span className="truncate">{p.brand_name}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1.5">
                            {p.domain?.[0] || ''}
                          </span>
                        </button>
                        {onDeleteProject && (
                          <button
                            type="button"
                            title={`Delete ${p.brand_name}`}
                            onClick={(e) => handleRequestDelete(e, p)}
                            className="p-1.5 mr-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}

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
        </div>

        {/* Right: execution controls — only on /dashboard */}
        {isDashboard && (
          <div className="flex items-center gap-3">
            {/* Model picker */}
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
                <div className="absolute top-full right-0 mt-1.5 w-64 bg-surface-850 border border-surface-border rounded-xl shadow-2xl z-50 p-1 space-y-0.5">
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

            {/* Rounds picker */}
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

            {/* Run batch */}
            <button
              onClick={onRunBatch}
              disabled={isRunningBatch}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors shadow-blue-600/20 cursor-pointer"
            >
              {isRunningBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {batchProgress && batchProgress.total > 0
                      ? `Running (${batchProgress.completed}/${batchProgress.total})...`
                      : 'Running...'}
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Tracking Batch</span>
                </>
              )}
            </button>
          </div>
        )}
      </header>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title={`Delete "${pendingDelete?.name}"?`}
        description="This permanently removes the project with all its prompts, executions, citations, and tracking history. This cannot be undone."
        confirmLabel="Delete Project"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
