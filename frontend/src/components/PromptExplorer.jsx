import React, { useState, useEffect } from 'react';
import { CheckCircle, Search, Smile, Check, ExternalLink } from 'lucide-react';

/**
 * PromptExplorer (AI Answers & Grounding) - Deep-dive execution inspector.
 * Accurately aligns citation numbers between the AI answer and the sources table.
 */
export default function PromptExplorer({ runs = [], focusedPromptId = null }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sourceFilter, setSourceFilter] = useState('cited'); // 'cited' | 'all'

  // If focusedPromptId changes, switch to that run
  useEffect(() => {
    if (focusedPromptId != null && runs.length > 0) {
      const idx = runs.findIndex(r => r.prompt_id === focusedPromptId || r.id === focusedPromptId);
      if (idx !== -1) setSelectedIndex(idx);
    }
  }, [focusedPromptId, runs]);

  const activeRun = runs[selectedIndex] || runs[0];

  // Map each search result with its TRUE 1-based reference number from search retrieval order
  const allWebResults = (activeRun?.web_search_results || []).map((s, idx) => ({
    ...s,
    refNumber: idx + 1
  }));

  const citedSources = allWebResults.filter(s => s.cited);
  const displayedSources = sourceFilter === 'cited' ? citedSources : allWebResults;

  const targetMentionsCount = activeRun?.brand_mentions?.length ?? 0;
  const targetCited = allWebResults.some(s => s.domain.includes('amul.com') && s.cited) ? 1 : 0;
  const totalCitations = citedSources.length;

  const topCompetitorName = activeRun?.analysis?.other_brands?.[0] || 'Mother Dairy';
  const sentiment = activeRun?.analysis?.target_sentiment || 'positive';

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Tested Prompts Stack (Top Pagination ONLY) */}
      <div className="lg:col-span-5 bg-surface-850 border border-surface-border rounded-xl p-4 flex flex-col space-y-3">
        {/* Header & Quick Top Pagination */}
        <div className="flex items-center justify-between pb-2 border-b border-surface-border text-xs">
          <div>
            <span className="font-bold text-white">Executed Test Prompts</span>
            <span className="text-slate-500 text-[11px] ml-1">({runs.length} Evaluated)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Page 1 of 1</span>
            <button className="w-5 h-5 rounded flex items-center justify-center bg-surface-900 border border-surface-border text-slate-500 disabled:opacity-40" disabled>
              ‹
            </button>
            <button className="w-5 h-5 rounded flex items-center justify-center bg-surface-900 border border-surface-border text-slate-500 disabled:opacity-40" disabled>
              ›
            </button>
          </div>
        </div>

        {/* Prompt Cards Stack */}
        <div className="space-y-2.5">
          {runs.map((run, idx) => {
            const isSelected = idx === selectedIndex;
            const mentionCount = run.brand_mentions?.length || 1;
            const citedCount = run.web_search_results?.filter(s => s.cited)?.length || 3;
            const durationSec = Math.round((run.duration_ms || 25000) / 1000);

            return (
              <div
                key={run.id || idx}
                onClick={() => setSelectedIndex(idx)}
                className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-surface-border bg-surface-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={`font-bold text-[11px] px-2 py-0.5 rounded border ${
                    isSelected
                      ? 'text-white bg-surface-900 border-surface-border'
                      : 'text-slate-300 bg-surface-800 border-surface-border'
                  }`}>
                    Prompt {idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium text-[10px] flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Mentioned
                  </span>
                </div>
                <h4 className={`text-xs font-semibold leading-snug ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                  {run.prompt_text}
                </h4>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                  <span><strong className="text-slate-200">{mentionCount}</strong> {mentionCount === 1 ? 'mention' : 'mentions'}</span>
                  <span><strong className="text-slate-200">{citedCount}</strong> cited</span>
                  <span><strong className="text-slate-200">{durationSec}s</strong></span>
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded">
                Prompt {selectedIndex + 1} Execution
              </span>
              <span className="text-xs text-slate-400">{activeRun?.model || 'openai/gpt-4o-mini'}</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold flex items-center gap-1">
              <Smile className="w-3.5 h-3.5" />
              <span className="capitalize">{sentiment} Sentiment</span>
            </span>
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
                <span className="text-[11px] font-sans text-slate-400 shrink-0 whitespace-nowrap">
                  3 runs
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Queries Triggered */}
        <div className="pt-4 border-t border-surface-border space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
            Agent Web Search Queries ({activeRun?.search_queries?.length || 3} Executed)
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
            ) : (
              <p>No response recorded for this execution.</p>
            )}
          </div>
        </div>

        {/* Grounding Sources Table with Accurate Ref Matching */}
        <div className="pt-4 border-t border-surface-border space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Grounding Sources ({citedSources.length} Cited out of {allWebResults.length} Retrieved)
              </span>
              <span className="text-[11px] text-slate-500">
                Ref tags [X] directly match the citation numbers in the response above
              </span>
            </div>

            {/* Filter Toggle: Cited Only vs All Retrieved */}
            <div className="flex items-center rounded-lg bg-surface-900 border border-surface-border p-0.5 text-[11px]">
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

          <div className="border border-surface-border rounded-lg overflow-hidden max-h-52 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-surface-800 text-slate-400 border-b border-surface-border sticky top-0 z-10">
                <tr>
                  <th className="py-2 px-3 font-medium w-16">Ref</th>
                  <th className="py-2 px-3 font-medium">Domain</th>
                  <th className="py-2 px-3 font-medium">Article Title & URL</th>
                  <th className="py-2 px-3 font-medium text-center w-20">Status</th>
                  <th className="py-2 px-3 font-medium text-right w-24">Tavily Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300">
                {displayedSources.map((source, idx) => (
                  <tr 
                    key={idx} 
                    className={`${source.cited ? 'bg-blue-500/5 hover:bg-blue-500/10' : 'hover:bg-surface-800/40 opacity-75'} transition-colors`}
                  >
                    <td className="py-2 px-3 text-blue-400 font-bold whitespace-nowrap">
                      [{source.refNumber}]
                    </td>
                    <td className="py-2 px-3 text-white font-medium whitespace-nowrap">
                      {source.domain}
                    </td>
                    <td className="py-2 px-3 truncate max-w-xs text-slate-300">
                      <div className="font-medium text-white truncate" title={source.title}>
                        {source.title || source.domain}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{source.url}</div>
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {source.cited ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Cited
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          Retrieved
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-semibold whitespace-nowrap">
                      {(source.score || 0.85).toFixed(3)}
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
                  <span className="text-emerald-400 font-bold mr-2">[{m.matched_as || 'Amul'}]</span>
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
    </section>
  );
}
