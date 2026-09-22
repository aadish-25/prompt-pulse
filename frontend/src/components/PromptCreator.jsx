import React, { useState } from 'react';
import { Sparkles, Plus, PlusCircle, Check, Loader2 } from 'lucide-react';
import { FALLBACK_VARIANTS } from '../api/client';

/**
 * PromptCreator component - Brand-driven prompt variant generator and selector.
 */
export default function PromptCreator({ 
  project, 
  onAddPrompts,
  onGenerateVariants,
  isGenerating = false 
}) {
  const brandName = project?.brand_name || 'Amul';
  
  const [candidates, setCandidates] = useState(FALLBACK_VARIANTS);
  const [selectedIndices, setSelectedIndices] = useState(() => 
    new Set(FALLBACK_VARIANTS.map((_, i) => i))
  );
  const [customText, setCustomText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Toggle individual card
  const handleToggleCard = (idx) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Toggle select all
  const allSelected = candidates.length > 0 && selectedIndices.size === candidates.length;
  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(candidates.map((_, i) => i)));
    }
  };

  // Generate new variants
  const handleGenerate = async () => {
    if (isGenerating) return;
    if (onGenerateVariants) {
      const newVariants = await onGenerateVariants();
      if (newVariants && newVariants.length > 0) {
        setCandidates(newVariants);
        setSelectedIndices(new Set(newVariants.map((_, i) => i)));
        showToast(`Generated ${newVariants.length} new brand-aware prompts!`);
      }
    } else {
      // Mock generation feedback
      showToast('Generated 10 new brand-aware prompts!');
    }
  };

  // Add custom prompt
  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;

    const newCandidate = {
      topic: 'Custom Query',
      intent: 'User Defined',
      prompt: trimmed,
      rationale: `Manually added prompt query for ${brandName} tracking.`
    };

    setCandidates(prev => [newCandidate, ...prev]);
    setSelectedIndices(prev => {
      const updated = new Set();
      updated.add(0); // Select the newly prepended item
      prev.forEach(i => updated.add(i + 1));
      return updated;
    });
    setCustomText('');
    showToast('Custom prompt added to list!');
  };

  // Bulk add selected to project
  const handleBulkAdd = async () => {
    const selectedPrompts = candidates
      .filter((_, idx) => selectedIndices.has(idx))
      .map(c => c.prompt);

    if (selectedPrompts.length === 0) return;

    setIsSubmitting(true);
    try {
      if (onAddPrompts) {
        await onAddPrompts(selectedPrompts);
      }
      showToast(`Added ${selectedPrompts.length} prompts to project tracker!`);
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
      <div className="bg-surface-850 border border-surface-border rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Brand-Aware Prompt Creator for <span className="text-blue-400 font-semibold">{brandName}</span>
            </h3>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Automatically deduces {brandName}'s industry, category dominance (dairy, butter, ice cream), and competitors to create realistic consumer search questions. <strong className="text-slate-200">Never mentions "{brandName}" in the prompt.</strong>
            </p>
          </div>
          
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
        <div className="pt-3 border-t border-surface-border flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
            placeholder="Or type your own custom prompt here (e.g. Which butter is best for high heat frying in Indian cooking?)"
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
            <span className="text-xs text-slate-500">Page 1 of 1 · {candidates.length} per page</span>
          </div>

          <button
            type="button"
            onClick={handleBulkAdd}
            disabled={selectedIndices.size === 0 || isSubmitting}
            className="shrink-0 whitespace-nowrap text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all shadow-blue-600/20 active:scale-95 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlusCircle className="w-4 h-4" />
            )}
            <span>Add {selectedIndices.size} Selected Prompts to Project</span>
          </button>
        </div>

        {/* Candidate Cards List */}
        <div className="space-y-2.5">
          {candidates.map((item, idx) => {
            const isSelected = selectedIndices.has(idx);
            return (
              <div
                key={idx}
                onClick={() => handleToggleCard(idx)}
                className={`bg-surface-850 border ${isSelected ? 'border-blue-500/40 bg-surface-850' : 'border-surface-border opacity-70'} rounded-xl p-4 flex items-start gap-4 hover:border-slate-700 transition-all cursor-pointer`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleCard(idx)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 w-4 h-4 rounded border-slate-700 bg-surface-900 text-blue-600 focus:ring-0 cursor-pointer"
                />
                <div className="flex-1 space-y-1">
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
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
