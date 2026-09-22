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
 * PromptCreator — Brand-driven prompt variant generator and selector.
 * - candidates and selectedIds are lifted to App.jsx so they survive tab switches.
 * - Adding selected prompts removes only those added, leaving unselected cards intact.
 */
export default function PromptCreator({
  project,
  selectedModel,
  candidates = [],
  selectedIds,
  onCandidatesChange,
  onSelectedIdsChange,
  onAddPrompts,
  onGenerateVariants,
  isGenerating = false
}) {
  const brandName = project?.brand_name || 'Target Brand';

  const [customText, setCustomText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleCard = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectedIdsChange(next);
  };

  const allSelected = candidates.length > 0 && selectedIds.size === candidates.length;
  const handleToggleSelectAll = () => {
    onSelectedIdsChange(allSelected ? new Set() : new Set(candidates.map(c => c.id)));
  };

  const handleDeleteCandidate = (id) => {
    onCandidatesChange(candidates.filter(c => c.id !== id));
    const next = new Set(selectedIds);
    next.delete(id);
    onSelectedIdsChange(next);
    showToast('Removed candidate prompt');
  };

  const handleGenerate = async () => {
    if (isGenerating || !project) return;
    if (onGenerateVariants) {
      console.log(`[PromptCreator] Requesting generate variants with model: "${selectedModel}"`);
      const res = await onGenerateVariants();
      const newVariants = Array.isArray(res) ? res : res?.variants || [];
      const usedModel = res?.model || selectedModel || 'selected model';
      if (newVariants && newVariants.length > 0) {
        const formatted = newVariants.map(v => createCandidate(
          v.prompt || v.text,
          v.topic || v.intent_category || 'Consumer Query',
          v.intent || 'Natural Search',
          v.rationale || `Relevant inquiry for ${brandName} market.`
        ));
        onCandidatesChange(formatted);
        onSelectedIdsChange(new Set(formatted.map(c => c.id)));
        showToast(`Generated ${formatted.length} prompts using ${usedModel}`);
        console.log(`[PromptCreator] Successfully loaded ${formatted.length} prompts generated with model: "${usedModel}"`);
        return;
      }
    }
    showToast('Failed to generate variants. Please try again.');
  };

  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    const newCandidate = createCandidate(trimmed, 'Custom Query', 'User Defined', `Manually added for ${brandName}.`);
    onCandidatesChange([newCandidate, ...candidates]);
    onSelectedIdsChange(new Set([...selectedIds, newCandidate.id]));
    setCustomText('');
    showToast('Custom prompt added!');
  };

  const handleBulkAdd = async () => {
    const toAdd = candidates.filter(c => selectedIds.has(c.id));
    if (toAdd.length === 0) return;
    setIsSubmitting(true);
    try {
      if (onAddPrompts) await onAddPrompts(toAdd.map(c => c.prompt));
      showToast(`Added ${toAdd.length} prompt(s) to project tracker!`);
      const addedIds = new Set(toAdd.map(c => c.id));
      onCandidatesChange(candidates.filter(c => !addedIds.has(c.id)));
      const next = new Set(selectedIds);
      addedIds.forEach(id => next.delete(id));
      onSelectedIdsChange(next);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <Check className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-surface-850 border border-surface-border rounded-xl p-5 space-y-3">
        {/* Top Header Row: Title & Tagline on Left, Model Badge & Generate Button on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                Brand-Aware Prompt Creator
                {brandName !== 'Target Brand' && <span className="text-blue-400"> for {brandName}</span>}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">AI-powered consumer search query generator</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedModel && (
              <span className="text-[11px] text-slate-400 font-mono bg-surface-900 border border-surface-border px-2.5 py-1.5 rounded-lg hidden sm:inline-block" title="Active Model">
                {selectedModel}
              </span>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !project}
              className="shrink-0 whitespace-nowrap bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs py-2 px-3.5 rounded-lg flex items-center gap-2 shadow-sm transition-all shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isGenerating ? 'Generating...' : 'Generate 10 New Prompts'}</span>
            </button>
          </div>
        </div>

        {/* Compact Description with subtle margin */}
        <p className="text-xs text-slate-400 leading-relaxed pt-0.5">
          Deduces {brandName}'s product category and competitive landscape to generate realistic consumer search questions.
        </p>

        {/* Custom prompt row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-surface-border">
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

      {/* Candidates */}
      {candidates.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="select-all"
                checked={allSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-slate-700 bg-surface-900 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="select-all" className="text-xs font-bold text-slate-300 uppercase tracking-wider cursor-pointer select-none">
                Select All ({candidates.length} Prompts)
              </label>
              <span className="text-xs text-slate-500">{selectedIds.size} of {candidates.length} selected</span>
            </div>
            <button
              type="button"
              onClick={handleBulkAdd}
              disabled={selectedIds.size === 0 || isSubmitting}
              className="shrink-0 whitespace-nowrap text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              <span>Add {selectedIds.size} Selected Prompts to Project</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {candidates.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleCard(item.id)}
                  className={`bg-surface-850 border ${isSelected ? 'border-blue-500/40' : 'border-surface-border opacity-70'} rounded-xl p-4 flex items-start gap-4 hover:border-slate-700 transition-all cursor-pointer`}
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
                      <span className="text-[11px] px-2.5 py-0.5 rounded bg-surface-800 text-slate-300 font-medium border border-surface-border">{item.topic}</span>
                      <span className="text-[11px] text-slate-400">{item.intent}</span>
                    </div>
                    <p className="text-sm font-semibold text-white">"{item.prompt}"</p>
                    <p className="text-xs text-slate-400"><strong className="text-slate-300">Rationale:</strong> {item.rationale}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteCandidate(item.id); }}
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
        <div className="bg-surface-850 border border-surface-border rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3.5">
          <div className="w-11 h-11 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto">
            <h4 className="text-sm font-bold text-white mb-2.5">No Prompt Candidates Yet</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Click <strong className="text-slate-200">"Generate 10 New Prompts"</strong> above to discover realistic consumer search queries for{' '}
              <strong className="text-slate-200">{brandName}</strong>, or type your own custom prompt above.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
