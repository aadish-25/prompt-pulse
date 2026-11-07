import React, { useState } from 'react';
import { X, Loader2, ArrowRight, ArrowLeft, Check, Sparkles, Globe, Target, Calendar, Key } from 'lucide-react';
import { saveByokKeys, getByokKeys } from '../api/client';

export default function NewProjectModal({ isOpen, onClose, onCreateProject }) {
  const [step, setStep] = useState(1); // 1: Brand & Domain, 2: Competitors & Category, 3: Schedule & Engine
  
  // Form fields
  const [brandName, setBrandName] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [aliasesInput, setAliasesInput] = useState('');
  const [competitorsInput, setCompetitorsInput] = useState('');
  const [categoryTopic, setCategoryTopic] = useState('');
  const [scheduleType, setScheduleType] = useState('immediate'); // 'immediate' | 'daily' | 'weekly' | 'manual'
  const [userKey, setUserKey] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep(1);
    setBrandName('');
    setDomainInput('');
    setAliasesInput('');
    setCompetitorsInput('');
    setCategoryTopic('');
    setScheduleType('immediate');
    setUserKey('');
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleBrandChange = (val) => {
    setBrandName(val);
    if (!domainInput || domainInput.endsWith('.com')) {
      const clean = val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean) setDomainInput(`${clean}.com`);
    }
  };

  const handleNext = (e) => {
    e?.preventDefault();
    if (step === 1) {
      if (!brandName.trim()) {
        setError('Brand name is required');
        return;
      }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      setError(null);
      setStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const domainList = domainInput
      .split(',')
      .map(d => d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter(Boolean);

    const aliasesList = aliasesInput
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);

    const competitorsList = competitorsInput
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    // Save BYOK key if supplied during onboarding
    if (userKey.trim()) {
      const existing = getByokKeys();
      saveByokKeys({ ...existing, openrouter: userKey.trim() });
    }

    try {
      await onCreateProject({
        brand_name: brandName.trim(),
        domain: domainList.length > 0 ? domainList : [`${brandName.trim().toLowerCase()}.com`],
        aliases: aliasesList,
        competitors: competitorsList,
        schedule: scheduleType,
        category: categoryTopic.trim() || undefined,
      });
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to initialize brand project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface-850 border border-surface-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                Step {step} of 3
              </span>
              <h3 className="text-base font-bold text-white">Brand Onboarding Wizard</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === 1 && 'Define brand identity, web domains, and search aliases'}
              {step === 2 && 'Set known competitors and industry category focus'}
              {step === 3 && 'Choose execution schedule and API key preferences'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-surface-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Step 1: Brand & Domain */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-200">Brand Name *</label>
              <input
                type="text"
                required
                autoFocus
                value={brandName}
                onChange={(e) => handleBrandChange(e.target.value)}
                placeholder="e.g. Nike, boAt, Amul, Lenskart"
                className="w-full bg-surface-900 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-200 flex items-center justify-between">
                <span>Official Web Domain(s)</span>
                <span className="text-[10px] text-slate-500">Auto-suggested</span>
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="e.g. nike.com, boat-lifestyle.com"
                  className="w-full bg-surface-900 border border-surface-border rounded-lg pl-9 pr-3.5 py-2 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <span className="text-[11px] text-slate-500 block">
                Used to verify if AI search engines cite your official website.
              </span>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-200">Brand Aliases & Entity Names</label>
              <input
                type="text"
                value={aliasesInput}
                onChange={(e) => setAliasesInput(e.target.value)}
                placeholder="e.g. GCMMF, Amul Dairy, boAt Lifestyle (comma separated)"
                className="w-full bg-surface-900 border border-surface-border rounded-lg px-3.5 py-2 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
              <span className="text-[11px] text-slate-500 block">
                Catches fuzzy brand mentions and parent cooperative/legal names in answers.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!brandName.trim()}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Competitors & Category */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-200">Known Competitors</label>
              <div className="relative">
                <Target className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  value={competitorsInput}
                  onChange={(e) => setCompetitorsInput(e.target.value)}
                  placeholder="e.g. Adidas, Puma, Reebok (comma separated)"
                  className="w-full bg-surface-900 border border-surface-border rounded-lg pl-9 pr-3.5 py-2 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <span className="text-[11px] text-slate-500 block">
                Used to compute displacement share: who wins the AI answer when you don't?
              </span>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-200">Product Category / Industry</label>
              <input
                type="text"
                value={categoryTopic}
                onChange={(e) => setCategoryTopic(e.target.value)}
                placeholder="e.g. Running shoes, Dairy products, Wireless audio"
                className="w-full bg-surface-900 border border-surface-border rounded-lg px-3.5 py-2 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
              <span className="text-[11px] text-slate-500 block">
                Anchors prompt variant generation so questions are authentic to your niche.
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Schedule & Engine */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-2">
              <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Tracking Schedule</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'immediate', label: 'Run Immediately', desc: 'Trigger initial baseline run right after setup' },
                  { id: 'daily', label: 'Daily Tracking', desc: 'Evaluates visibility every 24 hours automatically' },
                  { id: 'weekly', label: 'Weekly Audit', desc: 'Standard weekly production benchmark' },
                  { id: 'manual', label: 'Manual On-Demand', desc: 'Only run when you click Run Batch' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScheduleType(s.id)}
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      scheduleType === s.id
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-surface-border bg-surface-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-slate-200">{s.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-slate-400" />
                  <span>Optional BYOK Key (OpenRouter or Groq)</span>
                </span>
                <span className="text-[10px] text-slate-500">Optional</span>
              </label>
              <input
                type="password"
                value={userKey}
                onChange={(e) => setUserKey(e.target.value)}
                placeholder="sk-or-v1-... (leave blank to use server trial key)"
                className="w-full bg-surface-900 border border-surface-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none transition-colors"
              />
              <span className="text-[10px] text-slate-500 block">
                Bypasses the 5-prompt free-tier limit and uses your own account directly.
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Initialize & Launch Brand</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
