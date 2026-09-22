import React from 'react';
import { Play, Sparkles, CheckCircle2, Clock, ArrowRight, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';

/**
 * TrackedPromptsQueue - Section 1 showing all project prompts listed serial number-wise,
 * their batch execution status, active toggles, and direct links to inspect grounding.
 */
export default function TrackedPromptsQueue({
  prompts = [],
  runs = [],
  onToggleActive,
  onNavigateToGrounding,
  onNavigateToCreator,
  onRunBatch,
  isRunningBatch = false
}) {
  // Map of prompt_id -> run
  const runMap = new Map();
  runs.forEach(r => {
    if (r.prompt_id) runMap.set(r.prompt_id, r);
  });

  const totalCount = prompts.length;
  const testedCount = prompts.filter(p => runMap.has(p.id)).length;
  const pendingCount = totalCount - testedCount;

  return (
    <section className="space-y-6">
      {/* Top Summary Bar */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">
              Tracked Prompts Queue
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
              {totalCount} Total Prompts
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All consumer queries configured for this brand project, listed serial number-wise. Prompts marked active run in the next batch.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onNavigateToCreator}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-surface-800 hover:bg-surface-700 text-slate-200 border border-surface-border flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Generate / Add Prompts</span>
          </button>

          <button
            type="button"
            onClick={onRunBatch}
            disabled={isRunningBatch}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-sm transition-all shadow-blue-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {isRunningBatch ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isRunningBatch ? 'Executing Batch...' : 'Run Tracking Batch'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-surface-850 border border-surface-border rounded-xl p-3 flex items-center justify-between">
          <span className="text-slate-400">Total Project Prompts</span>
          <span className="text-base font-bold text-white">{totalCount}</span>
        </div>
        <div className="bg-surface-850 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between bg-emerald-500/5">
          <span className="text-slate-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Tested & Grounded
          </span>
          <span className="text-base font-bold text-emerald-400">{testedCount}</span>
        </div>
        <div className="bg-surface-850 border border-blue-500/30 rounded-xl p-3 flex items-center justify-between bg-blue-500/5">
          <span className="text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" /> Pending Next Batch
          </span>
          <span className="text-base font-bold text-blue-400">{pendingCount}</span>
        </div>
      </div>

      {/* Prompts Listed Serial Number-Wise */}
      <div className="space-y-2.5">
        {prompts.map((p, index) => {
          const serialNo = index + 1;
          const hasRun = runMap.has(p.id);
          const run = runMap.get(p.id);

          return (
            <div
              key={p.id || index}
              className={`bg-surface-850 border ${
                hasRun ? 'border-surface-border hover:border-slate-700' : 'border-blue-500/30 bg-blue-500/5'
              } rounded-xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4`}
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                {/* Serial Number Badge */}
                <div className="shrink-0 w-8 h-8 rounded-lg bg-surface-900 border border-surface-border flex items-center justify-center font-bold text-xs text-blue-400">
                  #{serialNo}
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Query #{serialNo}
                    </span>
                    {hasRun ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Tested & Grounded
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-semibold border border-blue-500/20 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Ready for Next Batch Run
                      </span>
                    )}
                    {!p.active && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium border border-surface-border">
                        Inactive
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-white leading-snug">
                    "{p.text}"
                  </p>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                {/* Active / Inactive Toggle */}
                {onToggleActive && (
                  <button
                    type="button"
                    onClick={() => onToggleActive(p.id, !p.active)}
                    title={p.active ? 'Click to deactivate' : 'Click to activate'}
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
                  >
                    {p.active ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-500" />
                    )}
                  </button>
                )}

                {hasRun ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToGrounding(run)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-800 hover:bg-surface-700 text-blue-400 hover:text-blue-300 border border-surface-border flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View Grounding Answer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 italic">
                    Queued for execution
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
