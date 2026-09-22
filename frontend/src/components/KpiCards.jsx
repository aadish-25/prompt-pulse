import React from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';

export default function KpiCards({ summary, activeProject }) {
  const brandName = activeProject?.brand_name || 'Amul';
  const targetDomain = activeProject?.domain?.[0] || 'amul.com';

  const totalRuns = summary?.total_runs ?? 0;
  const hasRuns = totalRuns > 0;

  const visibilityPct = hasRuns && summary?.visibility_percentage != null 
    ? summary.visibility_percentage.toFixed(1) 
    : '0.0';
  const mentionedCount = summary?.mentioned_count ?? 0;

  const citationPct = hasRuns && summary?.own_domain_citation_percentage != null 
    ? summary.own_domain_citation_percentage.toFixed(1) 
    : '0.0';
  const citedCount = summary?.own_domain_cited_count ?? 0;

  const topCompetitor = hasRuns && summary?.top_competitors?.[0]?.brand 
    ? summary.top_competitors[0].brand 
    : (hasRuns ? 'None Detected' : 'No Runs Yet');
  const topCompetitorRuns = hasRuns && summary?.top_competitors?.[0]?.count 
    ? `${summary.top_competitors[0].count} runs` 
    : (hasRuns ? '0 runs' : 'No data');
  const competitorCount = hasRuns && summary?.top_competitors?.length 
    ? `${summary.top_competitors.length} Competitors` 
    : (hasRuns ? '0 Competitors' : '0 Runs Executed');

  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Card 1: AI Mention Visibility */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-medium text-slate-300">AI Mention Visibility</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold text-[10px] border border-emerald-500/20">
            {mentionedCount}/{totalRuns} Prompts
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className="text-2xl font-bold text-white tracking-tight">{visibilityPct}%</span>
          {hasRuns && (
            <span className="text-xs text-emerald-400 font-medium flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> High Share
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1 truncate">
          {hasRuns 
            ? `${brandName} explicitly recommended in ${mentionedCount} of ${totalRuns} test questions`
            : `No test runs executed yet for ${brandName}`}
        </p>
      </div>

      {/* Card 2: Target Domain Citations */}
      <div className="bg-surface-850 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-amber-500/5 to-transparent">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-medium text-amber-200">Target Domain Citations</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold text-[10px] border border-amber-500/20">
            {targetDomain}
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className="text-2xl font-bold text-amber-300 tracking-tight">{citationPct}%</span>
          <span className="text-xs text-amber-400 font-medium">{citedCount} of {totalRuns} cited</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-200/80 mt-1 truncate">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">
            {hasRuns ? 'Citation traffic captured by search engines' : 'Awaiting first test batch run'}
          </span>
        </div>
      </div>

      {/* Card 3: Target Sentiment Score */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-medium text-slate-300">Target Sentiment</span>
          <span className="text-xs text-slate-400">{totalRuns} evaluations</span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className="text-2xl font-bold text-white tracking-tight">
            {hasRuns ? '100%' : 'N/A'}
          </span>
          <span className="text-xs text-emerald-400 font-medium">
            {hasRuns ? 'Positive' : 'No evaluations'}
          </span>
        </div>
        <div className="w-full bg-surface-800 h-1.5 rounded-full mt-2 overflow-hidden flex">
          <div className={`${hasRuns ? 'bg-emerald-500' : 'bg-slate-700'} h-full w-full`} title={hasRuns ? "100% Positive" : "No data"}></div>
        </div>
      </div>

      {/* Card 4: Top Detected Competitor */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-medium text-slate-300">Top Detected Competitor</span>
          <span className="text-xs text-slate-400">{competitorCount}</span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className="text-xl font-bold text-white tracking-tight truncate">{topCompetitor}</span>
          <span className="text-xs text-slate-400 font-medium">{topCompetitorRuns}</span>
        </div>
        <p className="text-xs text-slate-400 mt-1 truncate">
          {hasRuns ? 'Most detected rival across AI responses' : 'Run a batch to detect competing brands'}
        </p>
      </div>
    </section>
  );
}
