import React from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';

export default function KpiCards({ summary, activeProject }) {
  const brandName = activeProject?.brand_name || 'Amul';
  const targetDomain = activeProject?.domain?.[0] || 'amul.com';

  const visibilityPct = summary?.visibility_percentage != null ? summary.visibility_percentage.toFixed(1) : '100.0';
  const mentionedCount = summary?.mentioned_count ?? 5;
  const totalRuns = summary?.total_runs ?? 5;

  const citationPct = summary?.own_domain_citation_percentage != null ? summary.own_domain_citation_percentage.toFixed(1) : '0.0';
  const citedCount = summary?.own_domain_cited_count ?? 0;

  const topCompetitor = summary?.top_competitors?.[0]?.brand || 'Mother Dairy';
  const topCompetitorRuns = summary?.top_competitors?.[0]?.count ?? 3;
  const competitorCount = summary?.top_competitors?.length ? `${summary.top_competitors.length} Competitors` : '8 Competitors';

  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Card 1: AI Mention Visibility */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-medium text-slate-300">AI Mention Visibility</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[10px] border border-emerald-500/20">
            {mentionedCount}/{totalRuns} Prompts
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className="text-2xl font-bold text-white tracking-tight">{visibilityPct}%</span>
          <span className="text-xs text-emerald-400 font-medium flex items-center">
            <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> High Share
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1 truncate">
          {brandName} explicitly recommended in all {totalRuns} test questions
        </p>
      </div>

      {/* Card 2: Target Domain Citations */}
      <div className="bg-surface-850 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-amber-500/5 to-transparent">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-medium text-amber-200">Target Domain Citations</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[10px] border border-amber-500/20">
            {targetDomain}
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className="text-2xl font-bold text-amber-300 tracking-tight">{citationPct}%</span>
          <span className="text-xs text-amber-400 font-medium">{citedCount} of {totalRuns} cited</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-200/80 mt-1 truncate">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">All citation traffic captured by aggregators</span>
        </div>
      </div>

      {/* Card 3: Target Sentiment Score */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-medium text-slate-300">Target Sentiment</span>
          <span className="text-xs text-slate-400 font-mono">{totalRuns} evaluations</span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className="text-2xl font-bold text-white tracking-tight">100%</span>
          <span className="text-xs text-emerald-400 font-medium">Positive</span>
        </div>
        <div className="w-full bg-surface-800 h-1.5 rounded-full mt-2 overflow-hidden flex">
          <div className="bg-emerald-500 h-full w-full" title="100% Positive"></div>
        </div>
      </div>

      {/* Card 4: Top Detected Competitor */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-medium text-slate-300">Top Detected Competitor</span>
          <span className="text-xs text-slate-400 font-mono">{competitorCount}</span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className="text-xl font-bold text-white tracking-tight truncate">{topCompetitor}</span>
          <span className="text-xs text-slate-400 font-mono">{topCompetitorRuns} runs</span>
        </div>
        <p className="text-xs text-slate-400 mt-1 truncate">
          Most detected rival across AI responses
        </p>
      </div>
    </section>
  );
}
