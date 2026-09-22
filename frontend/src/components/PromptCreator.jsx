import React, { useState } from 'react';
import { Sparkles, Plus, PlusCircle, Check, Loader2, Trash2 } from 'lucide-react';

let candidateCounter = 0;
function createCandidate(prompt, topic = 'Natural Search', intent = 'Consumer Query', rationale = '') {
  candidateCounter += 1;
  return {
    id: `cand_${Date.now()}_${candidateCounter}_${Math.random().toString(36).substring(2, 7)}`,
    prompt,
    topic,
    intent,
    rationale
  };
}

/**
 * PromptCreator component - Brand-driven prompt variant generator and selector.
 * - Initial state is blank (no hardcoded prompts).
 * - Tracks selections by unique candidate ID.
 * - Adding selected prompts removes ONLY those added, keeping unselected items disabled.
 * - Provides an individual delete button on the right of each candidate card.
 */
export default function PromptCreator({ 
  project, 
  onAddPrompts,
  onGenerateVariants,
  isGenerating = false 
}) {
  const brandName = project?.brand_name || 'Target Brand';
  
  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [customText, setCustomText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Toggle individual card selection
  const handleToggleCard = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all
  const allSelected = candidates.length > 0 && selectedIds.size === candidates.length;
  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)));
    }
  };

  // Delete individual candidate card
  const handleDeleteCandidate = (id) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showToast('Removed candidate prompt');
  };

  // Generate new variants from LLM
  const handleGenerate = async () => {
    if (isGenerating) return;
    if (onGenerateVariants) {
      const newVariants = await onGenerateVariants();
      if (newVariants && newVariants.length > 0) {
        const formatted = newVariants.map(v => createCandidate(
          v.prompt || v.text,
          v.topic || v.intent_category || 'Natural Search',
          v.intent || 'Consumer Query',
          v.rationale || `Relevant buyer inquiry for ${brandName} market.`
        ));
        setCandidates(formatted);
        setSelectedIds(new Set(formatted.map(c => c.id)));
        showToast(`Generated ${formatted.length} new brand-aware prompts!`);
        return;
      }
    }
    showToast('Failed to generate variants. Please try again.');
  };

  // Add custom prompt
  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;

    const newCandidate = createCandidate(
      trimmed,
      'Custom Query',
      'User Defined',
      `Manually added prompt query for ${brandName} tracking.`
    );

    setCandidates(prev => [newCandidate, ...prev]);
    setSelectedIds(prev => new Set(prev).add(newCandidate.id));
    setCustomText('');
    showToast('Custom prompt added to candidates!');
  };

  // Bulk add selected to project and clear ONLY the added candidates
  const handleBulkAdd = async () => {
    const toAdd = candidates.filter(c => selectedIds.has(c.id));
    if (toAdd.length === 0) return;

    setIsSubmitting(true);
    try {
      if (onAddPrompts) {
        await onAddPrompts(toAdd.map(c => c.prompt));
      }
      showToast(`Added ${toAdd.length} prompt(s) to project tracker!`);
      
      const addedIdSet = new Set(toAdd.map(c => c.id));
      // Remove ONLY added prompts from the candidate list
      setCandidates(prev => prev.filter(c => !addedIdSet.has(c.id)));
      // Remove ONLY added IDs from selectedIds — leaving all unselected/disabled cards exactly as they were!
      setSelectedIds(prev => {
        const next = new Set(prev);
        addedIdSet.forEach(id => next.delete(id));
        return next;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <Check className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Brand-Aware Action Bar */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-6 space-y-5">
        {/* Title row */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">
              Brand-Aware Prompt Creator
              {brandName !== 'Target Brand' && (
                <span className="text-blue-400"> for {brandName}</span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              AI-powered consumer search query generator
            </p>
          </div>
        </div>

        {/* Description + CTA */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 pt-1 border-t border-surface-border">
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
            Deduces {brandName}'s product category and competitive landscape to generate realistic
            consumer search questions.{' '}
            <strong className="text-slate-300">
              The brand name "{brandName}" is never placed directly inside the prompts.
            </strong>
          </p>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="shrink-0 whitespace-nowrap bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center gap-2 shadow-sm transition-all shadow-blue-600/20 active:scale-95 cursor-pointer"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isGenerating ? 'Generating...' : 'Generate 10 New Prompts'}</span>
          </button>
        </div>

        {/* Custom Prompt Input Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 border-t border-surface-border">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
            placeholder={`Type your own custom prompt for ${brandName}...`}
            className="flex-1 bg-surface-900 border border-surface-border rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={!customText.trim()}
            className="shrink-0 whitespace-nowrap bg-surface-800 hover:bg-surface-700 disabled:opacity-40 text-slate-200 border border-surface-border px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Prompt</span>
          </button>
        </div>
      </div>

      {/* Generated Candidates Header & Controls */}
      {candidates.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="select-all-checkbox"
                checked={allSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-slate-700 bg-surface-900 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="select-all-checkbox" className="text-xs font-bold text-slate-300 uppercase tracking-wider cursor-pointer select-none">
                Select All ({candidates.length} Prompts)
              </label>
              <span className="text-xs text-slate-500">
                {selectedIds.size} of {candidates.length} selected
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkAdd}
              disabled={selectedIds.size === 0 || isSubmitting}
              className="shrink-0 whitespace-nowrap text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              <span>Add {selectedIds.size} Selected Prompts to Project</span>
            </button>
          </div>

          {/* Candidate Cards List */}
          <div className="space-y-2.5">
            {candidates.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleCard(item.id)}
                  className={`bg-surface-850 border ${isSelected ? 'border-blue-500/40 bg-surface-850' : 'border-surface-border opacity-70'} rounded-xl p-4 flex items-start gap-4 hover:border-slate-700 transition-all cursor-pointer`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleCard(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-4 h-4 rounded border-slate-700 bg-surface-900 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2.5 py-0.5 rounded bg-surface-800 text-slate-300 font-medium border border-surface-border">
                        {item.topic}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {item.intent}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white">
                      "{item.prompt}"
                    </p>
                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-300">Rationale:</strong> {item.rationale}
                    </p>
                  </div>

                  {/* Delete button on the right */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCandidate(item.id);
                    }}
                    title="Delete prompt candidate"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 self-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Blank Initial / Empty State */
        <div className="bg-surface-850 border border-surface-border rounded-xl p-12 text-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-base font-bold text-white">No Prompt Candidates Yet</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Click "Generate 10 New Prompts" to discover realistic consumer search queries for <strong className="text-slate-200">{brandName}</strong>, or type your own custom prompt above.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all shadow-blue-600/20 active:scale-95 cursor-pointer"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Generate 10 New Prompts</span>
          </button>
        </div>
      )}
    </section>
  );
}
