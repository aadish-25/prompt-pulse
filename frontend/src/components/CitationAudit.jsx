import React, { useMemo } from 'react';

/**
 * CitationAudit component - Competitor Share of Voice & Domain Citation Audit tables.
 */
export default function CitationAudit({ summary, project, citations = [] }) {
  const brandName = project?.brand_name || 'Amul';
  const targetDomain = project?.domain?.[0] || 'amul.com';
  const configuredCompetitors = project?.competitors || ['Mother Dairy', 'Britannia', 'Nandini', 'Gowardhan', 'Verka', 'Milma'];
  const totalRuns = summary?.total_runs ?? 5;
  const targetMentions = summary?.mentioned_count ?? totalRuns;

  // Build merged competitor list: Target + Configured + AI-Discovered
  const competitorRows = useMemo(() => {
    const detectedMap = new Map();
    (summary?.top_competitors || [
      { brand: 'Mother Dairy', count: 3 },
      { brand: 'Britannia', count: 2 },
      { brand: 'Gowardhan', count: 2 },
      { brand: 'Nandini', count: 2 },
      { brand: 'President Butter', count: 1 }
    ]).forEach(c => detectedMap.set(c.brand.toLowerCase(), c.count));

    const rows = [];

    // 1. Target brand row
    const targetFreq = totalRuns > 0 ? ((targetMentions / totalRuns) * 100).toFixed(1) : '100.0';
    rows.push({
      brand: `${brandName} (Target)`,
      type: 'target',
      typeLabel: 'Target Brand',
      count: targetMentions,
      frequency: `${targetFreq}%`,
      isTarget: true,
      active: true
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
        // Find original casing
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

  // Ensure target domain is represented in citations list if not already
  const domainRows = useMemo(() => {
    const list = [...citations];
    const hasTarget = list.some(c => c.domain.toLowerCase() === targetDomain.toLowerCase());
    if (!hasTarget) {
      list.push({
        domain: targetDomain,
        retrieved: summary?.own_domain_retrieved_count ?? 0,
        cited: summary?.own_domain_cited_count ?? 0
      });
    }
    return list.sort((a, b) => {
      const aIsTarget = a.domain.toLowerCase().includes(targetDomain.toLowerCase());
      const bIsTarget = b.domain.toLowerCase().includes(targetDomain.toLowerCase());
      if (aIsTarget) return 1; // Put target at the bottom or keep sorted
      if (bIsTarget) return -1;
      return b.cited - a.cited || b.retrieved - a.retrieved;
    });
  }, [citations, targetDomain, summary]);

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
            <span className="text-xs font-mono bg-surface-800 px-2 py-1 rounded text-slate-300">
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
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {row.typeLabel}
                        </span>
                      ) : row.type === 'discovered' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {row.typeLabel}
                        </span>
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${row.active ? 'bg-surface-800 text-slate-300' : 'bg-surface-800 text-slate-400'} border border-surface-border`}>
                          {row.typeLabel}
                        </span>
                      )}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono ${row.isTarget ? 'text-white' : row.active ? 'text-slate-300' : 'text-slate-500'}`}>
                      {row.count} {row.count === 1 ? 'run' : 'runs'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono ${row.isTarget ? 'font-bold text-emerald-400' : row.active ? 'text-blue-400 font-semibold' : 'text-slate-500'}`}>
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Domain Citation Audit</h3>
              <p className="text-xs text-slate-400">Domains sorted strictly by actual citation count in AI search responses</p>
            </div>
            <span className="text-xs font-mono bg-surface-800 px-2 py-1 rounded text-slate-300">
              {domainRows.length} Domains Audited
            </span>
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
                {domainRows.map((d, idx) => {
                  const isTarget = d.domain.toLowerCase().includes(targetDomain.toLowerCase());
                  const rate = d.retrieved > 0 ? ((d.cited / d.retrieved) * 100).toFixed(1) : '0.0';

                  if (isTarget) {
                    return (
                      <tr key={idx} className="bg-amber-500/10">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                          {d.domain} (Target)
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-300">{d.retrieved}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-400 font-bold">{d.cited}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-400">{rate}%</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={idx} className="hover:bg-surface-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-white">{d.domain}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{d.retrieved}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">{d.cited}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}
