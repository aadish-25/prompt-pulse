import React, { useState, useEffect } from 'react';
import { CheckCircle, Search, Smile, Check, ExternalLink, AlertCircle, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

/**
 * PromptExplorer (AI Answers & Grounding) - Deep-dive execution inspector.
 * Accurately aligns citation numbers between the AI answer and the sources table.
 */
export default function PromptExplorer({
  runs = [],
  focusedPromptId = null,
  activeProject = null,
  onClearResults = null,
  onDeleteExecution = null
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sourceFilter, setSourceFilter] = useState('cited'); // 'cited' | 'all'
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Sort latest batch first (descending batch_id), then prompt / execution order within batch (ascending id)
  const sortedRuns = React.useMemo(() => {
    return [...runs].sort((a, b) => {
      const batchA = a.batch_id ?? 0;
      const batchB = b.batch_id ?? 0;
      if (batchB !== batchA) return batchB - batchA; // Latest batch first
      return (a.id ?? 0) - (b.id ?? 0); // Prompt order within batch
    });
  }, [runs]);

  // Pagination: 6 test prompts per page
  const PAGE_SIZE = 6;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(sortedRuns.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Keep selectedIndex within valid range when runs are deleted
  useEffect(() => {
    if (selectedIndex >= sortedRuns.length && sortedRuns.length > 0) {
      setSelectedIndex(sortedRuns.length - 1);
    }
  }, [sortedRuns.length, selectedIndex]);

  // If focusedPromptId changes, switch to that run and its page
  useEffect(() => {
    if (focusedPromptId != null && sortedRuns.length > 0) {
      const idx = sortedRuns.findIndex(r => r.prompt_id === focusedPromptId || r.id === focusedPromptId);
      if (idx !== -1) {
        setSelectedIndex(idx);
        setCurrentPage(Math.floor(idx / PAGE_SIZE) + 1);
      }
    }
  }, [focusedPromptId, sortedRuns]);

  if (!sortedRuns || sortedRuns.length === 0) {
    return (
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left column — prompt list */}
        <div className="lg:col-span-5 bg-surface-850 border border-surface-border rounded-xl p-5 flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border text-xs mb-6">
            <span className="font-bold text-white">Executed Test Prompts</span>
            <span className="text-slate-500 text-[11px]">(0 Evaluated)</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-2">No Prompts Executed Yet</h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Add prompts in the <strong className="text-slate-300">AI Prompt Creator</strong> tab, then run a tracking batch to evaluate responses.
              </p>
            </div>
          </div>
        </div>

        {/* Right column — execution details */}
        <div className="lg:col-span-7 bg-surface-850 border border-surface-border rounded-xl p-5 flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border text-xs mb-6">
            <span className="font-bold text-white">Execution Details & Grounding</span>
            <span className="text-slate-500 text-[11px]">No Active Run</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
            <div className="w-10 h-10 rounded-xl bg-surface-800 border border-surface-border text-slate-400 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-2">No Execution Data</h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Once you run a tracking batch, the AI-generated response, web search queries, grounding sources, and brand mention extractions will appear here.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const displayedRuns = sortedRuns.slice(startIndex, startIndex + PAGE_SIZE);

  const handlePageChange = (newPage) => {
    const valid = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(valid);
    setSelectedIndex((valid - 1) * PAGE_SIZE);
  };

  const activeRun = sortedRuns[selectedIndex] || displayedRuns[0] || sortedRuns[0];

  // Map each search result with its TRUE 1-based reference number from search retrieval order
  const allWebResults = (activeRun?.web_search_results || []).map((s, idx) => ({
    ...s,
    refNumber: idx + 1
  }));

  const citedSources = allWebResults.filter(s => s.cited);
  const displayedSources = sourceFilter === 'cited' ? citedSources : allWebResults;

  const targetMentionsCount = activeRun?.brand_mentions?.length ?? 0;
  const projectDomains = activeProject?.domain || [];
  const targetCited = projectDomains.length > 0 && allWebResults.some(
    s => s.cited && projectDomains.some(d => s.domain?.toLowerCase().includes(d.toLowerCase()))
  ) ? 1 : 0;
  const totalCitations = citedSources.length;

  // Top competitor from the run's analysis, with count from the project-level summary if available
  const topCompetitorName = activeRun?.analysis?.other_brands?.[0] || 'None Detected';
  const topCompetitorCount = activeRun?.analysis?.other_brands?.length > 0
    ? `${activeRun.analysis.other_brands.length} in response`
    : '';
  const sentiment = activeRun?.analysis?.target_sentiment || 'neutral';

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Tested Prompts Stack (Top Pagination ONLY) */}
      <div className="lg:col-span-5 bg-surface-850 border border-surface-border rounded-xl p-4 flex flex-col space-y-3">
        {/* Header & Quick Top Pagination */}
        <div className="flex items-center justify-between pb-2 border-b border-surface-border text-xs">
          <div>
            <span className="font-bold text-white">Executed Test Prompts</span>
            <span className="text-slate-500 text-[11px] ml-1">({sortedRuns.length} Evaluated)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {sortedRuns.length > 0 && onClearResults && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={isClearing}
                className="px-2 py-0.5 rounded text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                title="Clear all executed test prompts"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            )}
            <span>Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="w-5 h-5 rounded flex items-center justify-center bg-surface-900 hover:bg-surface-800 border border-surface-border text-slate-300 disabled:opacity-30 disabled:hover:bg-surface-900 cursor-pointer disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="w-5 h-5 rounded flex items-center justify-center bg-surface-900 hover:bg-surface-800 border border-surface-border text-slate-300 disabled:opacity-30 disabled:hover:bg-surface-900 cursor-pointer disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              ›
            </button>
          </div>
        </div>

        {/* Prompt Cards Stack */}
        <div className="space-y-2.5">
          {displayedRuns.map((run, localIdx) => {
            const globalIdx = startIndex + localIdx;
            const isSelected = globalIdx === selectedIndex;
            const mentionCount = run.brand_mentions?.length ?? 0;
            const citedCountCard = run.web_search_results?.filter(s => s.cited)?.length ?? 0;
            const durationSec = run.duration_ms ? Math.round(run.duration_ms / 1000) : null;
            const hasMention = mentionCount > 0;
            const modelShort = run.model ? run.model.replace(/^OR:\s*|^GROQ:\s*|^DS:\s*/i, '').split('/').pop() : null;

            return (
              <div
                key={run.id || globalIdx}
                onClick={() => setSelectedIndex(globalIdx)}
                className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-surface-border bg-surface-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-bold text-[11px] px-2 py-0.5 rounded border ${
                      isSelected
                        ? 'text-white bg-surface-900 border-surface-border'
                        : 'text-slate-300 bg-surface-800 border-surface-border'
                    }`}>
                      Prompt {globalIdx + 1}
                    </span>
                    {run.batch_id != null && (
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        Batch #{run.batch_id}
                      </span>
                    )}
                    {modelShort && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-slate-400 border border-surface-border truncate max-w-[100px]" title={run.model}>
                        {modelShort}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {run.status === 'failed' ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-medium text-[10px] border border-rose-500/20 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Failed
                      </span>
                    ) : hasMention ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium text-[10px] flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Mentioned
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 font-medium text-[10px]">
                        Not Mentioned
                      </span>
                    )}

                    {onDeleteExecution && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteExecution(run.id);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                        title="Delete this execution run"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h4 className={`text-xs font-semibold leading-snug ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                  {run.prompt_text}
                </h4>

                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span><strong className="text-slate-200">{mentionCount}</strong> {mentionCount === 1 ? 'mention' : 'mentions'}</span>
                    <span><strong className="text-slate-200">{citedCountCard}</strong> cited</span>
                    {durationSec != null && <span><strong className="text-slate-200">{durationSec}s</strong></span>}
                  </div>
                  {run.created_at && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Execution Detail Pane */}
      <div className="lg:col-span-7 bg-surface-850 border border-surface-border rounded-xl p-5 space-y-4">
        {/* Header & Prompt Title */}
        <div className="border-b border-surface-border pb-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded">
                Prompt {selectedIndex + 1} Execution
              </span>
              {activeRun?.batch_id != null && (
                <span className="text-xs font-bold text-blue-300 bg-blue-500/20 border border-blue-500/40 px-2.5 py-0.5 rounded">
                  Batch #{activeRun.batch_id}
                </span>
              )}
              {activeRun?.model && (
                <span className="text-xs text-slate-400 font-mono bg-surface-900 border border-surface-border px-2 py-0.5 rounded">
                  {activeRun.model}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded font-semibold flex items-center gap-1 capitalize ${
                sentiment === 'positive'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : sentiment === 'negative'
                    ? 'bg-rose-500/10 text-rose-400'
                    : 'bg-amber-500/10 text-amber-400'
              }`}>
                <Smile className="w-3.5 h-3.5" />
                <span>{sentiment} Sentiment</span>
              </span>

              {onDeleteExecution && activeRun && (
                <button
                  type="button"
                  onClick={() => onDeleteExecution(activeRun.id)}
                  className="px-2 py-1 rounded text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Delete this execution run"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete Run</span>
                </button>
              )}
            </div>
          </div>

          <h3 className="text-sm font-bold text-white">
            "{activeRun?.prompt_text}"
          </h3>

          {/* Prompt Level 4-Stat Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            {/* Box 1: Target Mentions */}
            <div className="bg-surface-900 border border-surface-border rounded-lg p-3 min-w-0 flex flex-col justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider truncate block">
                Target Mentions
              </span>
              <span className="text-xl font-bold font-sans text-emerald-400 mt-1 block">
                {targetMentionsCount}
              </span>
            </div>

            {/* Box 2: Target Cited */}
            <div className="bg-surface-900 border border-surface-border rounded-lg p-3 min-w-0 flex flex-col justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider truncate block">
                Target Cited
              </span>
              <span className="text-xl font-bold font-sans text-rose-500 mt-1 block">
                {targetCited}
              </span>
            </div>

            {/* Box 3: Total Citations */}
            <div className="bg-surface-900 border border-surface-border rounded-lg p-3 min-w-0 flex flex-col justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider truncate block">
                Total Citations
              </span>
              <span className="text-xl font-bold font-sans text-white mt-1 block">
                {totalCitations}
              </span>
            </div>

            {/* Box 4: Top Competitor */}
            <div className="bg-surface-900 border border-surface-border rounded-lg p-3 min-w-0 flex flex-col justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider truncate block">
                Top Competitor
              </span>
              <div className="flex items-baseline gap-1.5 mt-1 overflow-hidden">
                <span className="text-sm font-bold font-sans text-white truncate shrink min-w-0" title={topCompetitorName}>
                  {topCompetitorName}
                </span>
                {topCompetitorCount && (
                  <span className="text-[11px] font-sans text-slate-400 shrink-0 whitespace-nowrap">
                    {topCompetitorCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search Queries Triggered */}
        <div className="pt-4 border-t border-surface-border space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
            Agent Web Search Queries ({activeRun?.search_queries?.length ?? 0} Executed)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeRun?.search_queries?.map((q, idx) => (
              <span
                key={idx}
                className="text-[11px] px-2.5 py-1 bg-surface-900 border border-surface-border rounded text-slate-300 flex items-center gap-1.5"
              >
                <Search className="w-3 h-3 text-slate-500" />
                <span>{q.query}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Full AI Generated Answer Box */}
        <div className="pt-4 border-t border-surface-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Full AI Generated Response
            </span>
            <span className="text-[10px] text-slate-400">Scrollable view</span>
          </div>
          <div className="bg-surface-900 border border-surface-border rounded-lg p-4 text-xs leading-relaxed space-y-2.5 text-slate-300 max-h-52 overflow-y-auto custom-scrollbar font-sans">
            {activeRun?.raw_answer ? (
              activeRun.raw_answer.split('\n\n').map((paragraph, idx) => {
                if (paragraph.startsWith('CITED:')) {
                  return (
                    <div key={idx} className="pt-2 border-t border-surface-border text-[11px] text-slate-400">
                      {paragraph}
                    </div>
                  );
                }
                return (
                  <p key={idx} dangerouslySetInnerHTML={{
                    __html: paragraph
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                      .replace(/\[(\d+)\]/g, '<span class="inline-block text-[11px] text-blue-400 font-bold bg-blue-500/20 px-1 py-0.5 rounded border border-blue-500/30 mx-0.5 tracking-tight">[$1]</span>')
                  }} />
                );
              })
            ) : activeRun?.status === 'failed' || activeRun?.error ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Execution Failed</span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed font-mono text-[11px] bg-surface-900/60 p-2.5 rounded-lg border border-rose-500/20 break-all">
                  {activeRun.error || 'LLM provider error occurred during execution.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Note: The batch execution can be retried cleanly now that worker concurrency has been optimized.
                </p>
              </div>
            ) : (
              <p className="text-slate-500 italic text-xs">No response recorded for this execution.</p>
            )}
          </div>
        </div>

        {/* Grounding Sources Table with Accurate Ref Matching */}
        <div className="pt-4 border-t border-surface-border space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Grounding Sources ({citedSources.length} Cited / {allWebResults.length} Retrieved)
              </span>
              <span className="text-[11px] text-slate-500">
                Ref tags [X] directly match citation numbers in the AI response above
              </span>
            </div>

            {/* Filter Toggle: Cited Only vs All Retrieved */}
            <div className="flex items-center rounded-lg bg-surface-900 border border-surface-border p-0.5 text-[11px] shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setSourceFilter('cited')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  sourceFilter === 'cited'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cited Only ({citedSources.length})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  sourceFilter === 'all'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Retrieved ({allWebResults.length})
              </button>
            </div>
          </div>

          <div className="border border-surface-border rounded-lg max-h-56 overflow-y-auto overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-surface-800 text-slate-400 border-b border-surface-border sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 font-semibold w-14 shrink-0 text-blue-400">Ref</th>
                  <th className="py-2.5 px-3 font-medium w-40 shrink-0">Domain</th>
                  <th className="py-2.5 px-3 font-medium">Article Title & URL</th>
                  <th className="py-2.5 px-3 font-medium text-right w-24 shrink-0 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300">
                {displayedSources.map((source, idx) => (
                  <tr 
                    key={idx} 
                    className={`${source.cited ? 'bg-blue-500/5 hover:bg-blue-500/10' : 'hover:bg-surface-800/40 opacity-75'} transition-colors`}
                  >
                    <td className="py-2.5 px-3 text-blue-400 font-bold whitespace-nowrap">
                      [{source.refNumber}]
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium whitespace-nowrap">
                      <span className="truncate block max-w-[150px]" title={source.domain}>
                        {source.domain}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="font-medium text-white hover:text-blue-400 flex items-center gap-1.5 transition-colors group"
                        title={source.title || source.url}
                      >
                        <span className="truncate">{source.title || source.domain}</span>
                        <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-blue-400 shrink-0" />
                      </a>
                      <div className="text-[10px] text-slate-500 truncate max-w-md" title={source.url}>{source.url}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap pr-4">
                      {source.cited ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Cited
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-surface-border">
                          Retrieved
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Target Brand Mentions Extracted */}
        <div className="pt-4 border-t border-surface-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
              Target Brand Mentions Extracted
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              {targetMentionsCount} {targetMentionsCount === 1 ? 'Mention' : 'Mentions'}
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-sans">
            {activeRun?.brand_mentions && activeRun.brand_mentions.length > 0 ? (
              activeRun.brand_mentions.map((m, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-surface-900 border border-surface-border text-slate-300 leading-relaxed">
                  <span className="text-emerald-400 font-bold mr-2">[{m.matched_as || 'Brand'}]</span>
                  <span>"{m.sentence}"</span>
                </div>
              ))
            ) : (
              <div className="p-3 rounded-lg bg-surface-900 border border-surface-border text-slate-400 italic text-xs">
                No explicit target brand mentions detected in this execution.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear All Confirmation Modal */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All Executed Test Prompts?"
        description="This will permanently delete all evaluated test prompt runs, grounding sources, and mention analytics for this project so you can start clean."
        confirmLabel={isClearing ? "Clearing..." : "Clear All Results"}
        onConfirm={async () => {
          setIsClearing(true);
          try {
            if (onClearResults) await onClearResults();
          } finally {
            setIsClearing(false);
            setShowClearConfirm(false);
          }
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </section>
  );
}
