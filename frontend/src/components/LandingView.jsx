import React from 'react';
import { ArrowRight, Search, ShieldCheck, Wand2, Sparkles } from 'lucide-react';

/**
 * LandingView - shown at / when no projects exist or the user hasn't started yet.
 */
export default function LandingView({ onGetStarted }) {
  return (
    <section className="flex-1 max-w-5xl mx-auto w-full px-8 py-16 space-y-14">
      {/* Hero */}
      <div className="text-center space-y-5 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Generative Engine Optimization Intelligence</span>
        </div>

        <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
          Track How Search-Grounded AI Recommends and Cites Your Brand
        </h1>

        <p className="text-sm text-slate-400 leading-relaxed">
          Monitor AI answers across ChatGPT, Gemini, and Claude. Detect brand mentions, measure
          citation grounding on your official domain, and identify which competitors are capturing
          your referral traffic.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={onGetStarted}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-7 py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Create Your First Brand Project</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Feature pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-850 border border-surface-border rounded-2xl p-6 space-y-3 hover:border-slate-600 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Search Grounding Audit</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Executes multi-step web searches via Tavily to inspect every query and verify which
            URLs actually ground the LLM's final response.
          </p>
        </div>

        <div className="bg-surface-850 border border-surface-border rounded-2xl p-6 space-y-3 hover:border-slate-600 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Mention vs Citation Gap</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Reveals whether your brand is merely talked about from 3rd-party review blogs or if
            your official website is cited as the primary authority.
          </p>
        </div>

        <div className="bg-surface-850 border border-surface-border rounded-2xl p-6 space-y-3 hover:border-slate-600 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Wand2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Brand-Aware Prompt Creator</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Discovers organic consumer search queries tailored to your brand's market without ever
            biasing the search with brand name keywords.
          </p>
        </div>
      </div>
    </section>
  );
}
