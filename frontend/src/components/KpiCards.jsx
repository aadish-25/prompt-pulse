import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

export default function KpiCards({ summary, activeProject }) {
  const brandName = activeProject?.brand_name || 'your brand';
  const targetDomain = activeProject?.domain?.[0] || '';

  const totalRuns = summary?.total_runs ?? 0;
  const hasRuns = totalRuns > 0;

  const visibilityPct = hasRuns && summary?.visibility_percentage != null
    ? summary.visibility_percentage.toFixed(1)
    : '0.0';
  const visibilityNum = parseFloat(visibilityPct);
  const mentionedCount = summary?.mentioned_count ?? 0;

  const citationPct = hasRuns && summary?.own_domain_citation_percentage != null
    ? summary.own_domain_citation_percentage.toFixed(1)
    : '0.0';
  const citationNum = parseFloat(citationPct);
  const citedCount = summary?.own_domain_cited_count ?? 0;

  // Compute dominant sentiment from breakdown (most frequent wins)
  const sentimentBreakdown = summary?.sentiment_breakdown || {};
  const sentimentEntries = Object.entries(sentimentBreakdown).sort((a, b) => b[1] - a[1]);
  const dominantSentiment = hasRuns && sentimentEntries.length > 0
    ? sentimentEntries[0][0]
    : null;
  const dominantSentimentPct = hasRuns && totalRuns > 0 && sentimentEntries.length > 0
    ? Math.round((sentimentEntries[0][1] / totalRuns) * 100)
    : 0;
  const sentimentBarWidth = hasRuns ? `${dominantSentimentPct}%` : '0%';
  const sentimentColor = dominantSentiment === 'positive'
    ? 'bg-emerald-500'
    : dominantSentiment === 'negative'
      ? 'bg-rose-500'
      : dominantSentiment === 'neutral'
        ? 'bg-amber-400'
        : 'bg-slate-600';

  const formatSentimentLabel = (s) => {
    if (!s) return 'No evaluations';
    if (s.toLowerCase() === 'not_mentioned') return 'Not Mentioned';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const topCompetitor = hasRuns && summary?.top_competitors?.[0]?.brand
    ? summary.top_competitors[0].brand
    : (hasRuns ? 'None Detected' : 'No Runs Yet');
  const topCompetitorRuns = hasRuns && summary?.top_competitors?.[0]?.count
    ? `${summary.top_competitors[0].count} runs`
    : (hasRuns ? '0 runs' : 'No data');
  const competitorCount = hasRuns && summary?.top_competitors?.length
    ? `${summary.top_competitors.length} Competitors`
    : (hasRuns ? '0 Competitors' : '0 Runs Executed');

  // Mention Visibility Badge styling based on real percentage
  const getVisibilityBadge = () => {
    if (!hasRuns) return null;
    if (visibilityNum >= 60) {
      return (
        <span className="text-xs text-emerald-400 font-medium flex items-center">
          <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> High Share
        </span>
      );
    }
    if (visibilityNum >= 25) {
      return (
        <span className="text-xs text-blue-400 font-medium flex items-center">
          <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> Moderate Share
        </span>
      );
    }
    if (visibilityNum > 0) {
      return (
        <span className="text-xs text-amber-400 font-medium flex items-center">
          <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> Low Share
        </span>
      );
    }
    return (
      <span className="text-xs text-slate-400 font-medium flex items-center">
        0 Mentions
      </span>
    );
  };

  // Target Domain Citation Styling based on real performance
  const isHighCitation = citationNum >= 50;
  const isModerateCitation = citationNum > 0 && citationNum < 50;

  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Card 1: AI Mention Visibility */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-medium text-slate-300">AI Mention Visibility</span>
          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border ${
            visibilityNum >= 50
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : visibilityNum > 0
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {mentionedCount}/{totalRuns} Prompts
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className="text-2xl font-bold text-white tracking-tight">{visibilityPct}%</span>
          {getVisibilityBadge()}
        </div>
        <p className="text-xs text-slate-400 mt-1 truncate">
          {hasRuns
            ? `${brandName} recommended in ${mentionedCount} of ${totalRuns} test questions`
            : `No test runs executed yet for ${brandName}`}
        </p>
      </div>

      {/* Card 2: Target Domain Citations */}
      <div className={`bg-surface-850 rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden transition-colors ${
        isHighCitation
          ? 'border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent'
          : isModerateCitation
            ? 'border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent'
            : 'border border-surface-border'
      }`}>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className={`font-medium ${isHighCitation ? 'text-emerald-200' : isModerateCitation ? 'text-amber-200' : 'text-slate-300'}`}>
            Target Domain Citations
          </span>
          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border truncate max-w-[140px] ${
            isHighCitation
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : isModerateCitation
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700'
          }`} title={targetDomain}>
            {targetDomain || 'No domain tracked'}
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span className={`text-2xl font-bold tracking-tight ${
            isHighCitation ? 'text-emerald-300' : isModerateCitation ? 'text-amber-300' : 'text-white'
          }`}>
            {citationPct}%
          </span>
          <span className={`text-xs font-medium ${
            isHighCitation ? 'text-emerald-400' : isModerateCitation ? 'text-amber-400' : 'text-slate-400'
          }`}>
            {citedCount} of {totalRuns} cited
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 truncate">
          {isHighCitation ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : isModerateCitation ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <span className="truncate">
            {hasRuns
              ? (isHighCitation
                  ? 'Strong citation presence across search grounding'
                  : isModerateCitation
                    ? 'Moderate citation traffic captured'
                    : 'Target domain not cited in evaluated queries')
              : 'Awaiting first test batch run'}
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
            {hasRuns && dominantSentiment ? `${dominantSentimentPct}%` : 'N/A'}
          </span>
          <span className={`text-xs font-medium ${
            dominantSentiment === 'positive'
              ? 'text-emerald-400'
              : dominantSentiment === 'negative'
                ? 'text-rose-400'
                : dominantSentiment === 'neutral'
                  ? 'text-amber-400'
                  : 'text-slate-400'
          }`}>
            {hasRuns ? formatSentimentLabel(dominantSentiment) : 'No evaluations'}
          </span>
        </div>
        <div className="w-full bg-surface-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className={`${hasRuns && dominantSentiment ? sentimentColor : 'bg-slate-700'} h-full transition-all`}
            style={{ width: sentimentBarWidth }}
            title={hasRuns && dominantSentiment ? `${dominantSentimentPct}% ${formatSentimentLabel(dominantSentiment)}` : 'No data'}
          />
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
