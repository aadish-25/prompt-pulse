import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

/**
 * NewProjectModal component - Modal to create and track a new brand project.
 */
export default function NewProjectModal({ isOpen, onClose, onCreateProject }) {
  const [brandName, setBrandName] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [competitorsInput, setCompetitorsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) {
      setError('Brand name is required');
      return;
    }

    const domainList = domainInput
      .split(',')
      .map(d => d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter(Boolean);

    const competitorsList = competitorsInput
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreateProject({
        brand_name: brandName.trim(),
        domain: domainList.length > 0 ? domainList : [`${brandName.trim().toLowerCase()}.com`],
        competitors: competitorsList
      });
      // Reset & close
      setBrandName('');
      setDomainInput('');
      setCompetitorsInput('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface-850 border border-surface-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Create New Tracking Project</h3>
            <p className="text-xs text-slate-400">Track how an AI search engine perceives and cites your brand.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Brand Name</label>
            <input
              type="text"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Puma, boAt, Campus"
              className="w-full bg-surface-900 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Official Web Domain(s)</label>
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="e.g. in.puma.com (comma separated)"
              className="w-full bg-surface-900 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
            />
            <span className="text-[11px] text-slate-500 block">
              Used to detect whether the AI actually cites your official website.
            </span>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Known Competitors</label>
            <input
              type="text"
              value={competitorsInput}
              onChange={(e) => setCompetitorsInput(e.target.value)}
              placeholder="e.g. Nike, Adidas, Reebok"
              className="w-full bg-surface-900 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-surface-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-sm transition-all shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create & Initialize Project</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
