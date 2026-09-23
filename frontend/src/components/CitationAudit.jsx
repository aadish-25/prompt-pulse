import React, { useMemo } from 'react';

/**
 * CitationAudit component - Competitor Share of Voice & Domain Citation Audit tables.
 * Free of boxy font-mono, using clean proportional typography.
 */
export default function CitationAudit({ summary, project, citations = [] }) {
  const brandName = project?.brand_name || 'Target Brand';
  const targetDomain = project?.domain?.[0] || '';
  const configuredCompetitors = project?.competitors || [];
  const totalRuns = summary?.total_runs ?? 0;
  const targetMentions = summary?.mentioned_count ?? 0;

  // Build merged competitor list: Target + Configured + AI-Discovered
  const competitorRows = useMemo(() => {
    const detectedMap = new Map();
    (summary?.top_competitors || []).forEach(c => detectedMap.set(c.brand.toLowerCase(), c.count));

    const rows = [];

    // 1. Target brand row
    const targetFreq = totalRuns > 0 ? ((targetMentions / totalRuns) * 100).toFixed(1) : '0.0';
    rows.push({
      brand: `${brandName} (Target)`,
      type: 'target',
      typeLabel: 'Target Brand',
      count: targetMentions,
      frequency: `${targetFreq}%`,
      isTarget: true,
      active: targetMentions > 0
    });

    // 2. Pre-configured competitors
    const configuredSet = new Set();
    configuredCompetitors.forEach(brand => {
      configuredSet.add(brand.toLowerCase());
      const count = detectedMap.get(brand.toLowerCase()) || 0;
      const freq = totalRuns > 0 ? ((count / totalRuns) * 100).toFixed(1) : '0.0';
      rows.push({
        brand,
        type: 'configured',
        typeLabel: 'Pre-configured',
        count,
        frequency: count > 0 ? `${freq}%` : '0.0% (Not detected)',
        isTarget: false,
        active: count > 0
      });
    });

    // 3. AI-Discovered competitors (not in configured set)
    detectedMap.forEach((count, brandLower) => {
      if (!configuredSet.has(brandLower) && brandLower !== brandName.toLowerCase()) {
        const original = summary?.top_competitors?.find(c => c.brand.toLowerCase() === brandLower);
        const name = original ? original.brand : brandLower;
        const freq = totalRuns > 0 ? ((count / totalRuns) * 100).toFixed(1) : '0.0';
        rows.push({
          brand: name,
          type: 'discovered',
          typeLabel: 'AI Discovered',
          count,
          frequency: `${freq}%`,
          isTarget: false,
          active: true
        });
      }
    });

    // Sort: Target first, then by count descending
    return rows.sort((a, b) => {
      if (a.isTarget) return -1;
      if (b.isTarget) return 1;
      return b.count - a.count;
    });
  }, [summary, project, brandName, targetMentions, totalRuns, configuredCompetitors]);

  // Ensure target domain is represented in citations list and sorted strictly by performance
  const sortedDomainRows = useMemo(() => {
    const list = [...citations];
    if (targetDomain && totalRuns > 0) {
      const hasTarget = list.some(c => c.domain.toLowerCase() === targetDomain.toLowerCase());
      if (!hasTarget) {
        list.push({
          domain: targetDomain,
          retrieved: summary?.own_domain_retrieved_count ?? 0,
          cited: summary?.own_domain_cited_count ?? 0,
          isTarget: true
        });
      }
    }
    return list.map(d => ({
      ...d,
      isTarget: targetDomain ? d.domain.toLowerCase().includes(targetDomain.toLowerCase()) : false
    })).sort((a, b) => b.cited - a.cited || b.retrieved - a.retrieved);
  }, [citations, targetDomain, summary, totalRuns]);

  // Pagination for Domain Citation Audit (10 items per page)
  const DOMAIN_PAGE_SIZE = 10;
  const [domainPage, setDomainPage] = React.useState(1);
  const totalDomainPages = Math.max(1, Math.ceil(sortedDomainRows.length / DOMAIN_PAGE_SIZE));

  React.useEffect(() => {
    if (domainPage > totalDomainPages) {
      setDomainPage(totalDomainPages);
    }
  }, [totalDomainPages, domainPage]);

  const pagedDomains = useMemo(() => {
    const start = (domainPage - 1) * DOMAIN_PAGE_SIZE;
    return sortedDomainRows.slice(start, start + DOMAIN_PAGE_SIZE);
  }, [sortedDomainRows, domainPage]);

  const targetDomainRow = useMemo(() => {
    return sortedDomainRows.find(d => d.isTarget);
  }, [sortedDomainRows]);

  const isTargetInCurrentPage = pagedDomains.some(d => d.isTarget);

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Competitor Audit: Pre-configured + AI-Discovered Merged Table */}
        <div className="lg:col-span-6 bg-surface-850 border border-surface-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Competitor Share of Voice</h3>
              <p className="text-xs text-slate-400">Combines user-configured rivals with new competitors discovered by AI</p>
            </div>
            <span className="text-xs bg-surface-800 px-2 py-1 rounded text-slate-300 font-medium">
              {competitorRows.length} Tracked
            </span>
          </div>

          <div className="border border-surface-border rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-800 text-slate-400 border-b border-surface-border">
                <tr>
                  <th className="py-2.5 px-3">Competitor Brand</th>
                  <th className="py-2.5 px-3">Discovery Source</th>
                  <th className="py-2.5 px-3 text-right">Mention Count</th>
                  <th className="py-2.5 px-3 text-right">Mention Frequency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300">
                {competitorRows.map((row, idx) => (
                  <tr 
                    key={idx} 
                    className={`${row.isTarget ? 'bg-blue-500/5' : ''} ${!row.active ? 'opacity-60' : 'hover:bg-surface-800/40'} transition-colors`}
                  >
                    <td className={`py-2.5 px-3 font-medium ${row.isTarget ? 'text-white font-semibold flex items-center gap-1.5' : row.active ? 'text-white' : 'text-slate-400'}`}>
                      {row.isTarget && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                      {row.brand}
                    </td>
                    <td className="py-2.5 px-3">
                      {row.isTarget ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20">
                          {row.typeLabel}
                        </span>
                      ) : row.type === 'discovered' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-300 font-medium border border-purple-500/20">
                          {row.typeLabel}
                        </span>
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${row.active ? 'bg-surface-800 text-slate-300' : 'bg-surface-800 text-slate-400'} font-medium border border-surface-border`}>
                          {row.typeLabel}
                        </span>
                      )}
                    </td>
                    <td className={`py-2.5 px-3 text-right ${row.isTarget ? 'text-white font-medium' : row.active ? 'text-slate-300' : 'text-slate-500'}`}>
                      {row.count} {row.count === 1 ? 'run' : 'runs'}
                    </td>
                    <td className={`py-2.5 px-3 text-right ${row.isTarget ? 'font-bold text-emerald-400' : row.active ? 'text-blue-400 font-semibold' : 'text-slate-500'}`}>
                      {row.frequency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Domain Citation Audit Table */}
        <div className="lg:col-span-6 bg-surface-850 border border-surface-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-1 text-xs">
            <div>
              <h3 className="text-sm font-bold text-white">Domain Citation Audit</h3>
              <p className="text-xs text-slate-400">Domains sorted strictly by actual citation count in AI search responses</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-surface-800 px-2 py-0.5 rounded text-slate-300 font-medium">
                {sortedDomainRows.length} Domains
              </span>
              {totalDomainPages > 1 && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>Page {domainPage} of {totalDomainPages}</span>
                  <button
                    type="button"
                    onClick={() => setDomainPage(p => Math.max(1, p - 1))}
                    disabled={domainPage <= 1}
                    className="w-5 h-5 rounded flex items-center justify-center bg-surface-900 hover:bg-surface-800 border border-surface-border text-slate-300 disabled:opacity-30 disabled:hover:bg-surface-900 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setDomainPage(p => Math.min(totalDomainPages, p + 1))}
                    disabled={domainPage >= totalDomainPages}
                    className="w-5 h-5 rounded flex items-center justify-center bg-surface-900 hover:bg-surface-800 border border-surface-border text-slate-300 disabled:opacity-30 disabled:hover:bg-surface-900 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border border-surface-border rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-800 text-slate-400 border-b border-surface-border">
                <tr>
                  <th className="py-2.5 px-3">Domain</th>
                  <th className="py-2.5 px-3 text-right">Retrieved</th>
                  <th className="py-2.5 px-3 text-right">Cited</th>
                  <th className="py-2.5 px-3 text-right">Citation Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300">
                {pagedDomains.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                      No domain citations recorded yet for this project.
                    </td>
                  </tr>
                ) : (
                  <>
                    {pagedDomains.map((d, idx) => {
                      const rate = d.retrieved > 0 ? ((d.cited / d.retrieved) * 100).toFixed(1) : '0.0';

                      if (d.isTarget) {
                        const isCited = d.cited >= 1;
                        return (
                          <tr key={idx} className={isCited ? 'bg-emerald-500/10' : 'bg-surface-800/60'}>
                            <td className={`py-2.5 px-3 font-bold flex items-center gap-1.5 ${
                              isCited ? 'text-emerald-300' : 'text-slate-200'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>{d.domain}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                Target Brand
                              </span>
                            </td>
                            <td className={`py-2.5 px-3 text-right ${isCited ? 'text-emerald-200' : 'text-slate-300'}`}>
                              {d.retrieved}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              isCited ? 'text-emerald-400' : 'text-slate-400'
                            }`}>
                              {d.cited}
                            </td>
                            <td className={`py-2.5 px-3 text-right ${
                              isCited ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                            }`}>
                              {rate}%
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={idx} className="hover:bg-surface-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-white">{d.domain}</td>
                          <td className="py-2.5 px-3 text-right">{d.retrieved}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">{d.cited}</td>
                          <td className="py-2.5 px-3 text-right">{rate}%</td>
                        </tr>
                      );
                    })}

                    {/* Pinned Target Brand Row when target domain is not on the current page */}
                    {targetDomainRow && !isTargetInCurrentPage && (
                      <tr className={`border-t-2 border-surface-border ${
                        targetDomainRow.cited >= 1 ? 'bg-emerald-500/10' : 'bg-surface-800/60'
                      }`}>
                        <td className={`py-2.5 px-3 font-bold flex items-center gap-1.5 ${
                          targetDomainRow.cited >= 1 ? 'text-emerald-300' : 'text-slate-200'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                          <span>{targetDomainRow.domain}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Target (Rank #{sortedDomainRows.findIndex(d => d.isTarget) + 1})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{targetDomainRow.retrieved}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${
                          targetDomainRow.cited >= 1 ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {targetDomainRow.cited}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${
                          targetDomainRow.cited >= 1 ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                        }`}>
                          {targetDomainRow.retrieved > 0
                            ? ((targetDomainRow.cited / targetDomainRow.retrieved) * 100).toFixed(1)
                            : '0.0'}%
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}
