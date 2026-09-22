import React from 'react';
import { Sparkles, ArrowRight, Search, ShieldCheck, Wand2 } from 'lucide-react';

/**
 * LandingView component - Explains GEO capabilities and allows immediate project creation or demo exploration.
 */
export default function LandingView({ onGetStarted, onViewDemo }) {
  return (
    <section className="max-w-5xl mx-auto p-8 my-auto space-y-12">
      <div className="text-center space-y-4 max-w-2xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-sans font-medium text-blue-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Generative Engine Optimization Intelligence</span>
        </div>
        
        <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
          Track How Search-Grounded AI Recommends and Cites Your Brand
        </h1>
        
        <p className="text-sm text-slate-400 leading-relaxed">
          Monitor AI answers across ChatGPT, Gemini, and Claude. Detect brand mentions, measure citation grounding on your official domain, and identify which competitors and aggregators are capturing your referral traffic.
        </p>
        
        <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={onGetStarted}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Get Started — Track Your Brand</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            onClick={onViewDemo}
            className="bg-surface-850 hover:bg-surface-800 border border-surface-border text-slate-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            View Demo Dashboard (Amul)
          </button>
        </div>
      </div>

      {/* 3 Core Feature Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="bg-surface-850 border border-surface-border rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Search Grounding Audit</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Executes multi-step web searches via Tavily to inspect every query and verify which URLs actually ground the LLM's final response.
          </p>
        </div>

        <div className="bg-surface-850 border border-surface-border rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Mention vs Citation Gap</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Reveals whether your brand is merely talked about from 3rd-party review blogs or if your official website is cited as the primary authority.
          </p>
        </div>

        <div className="bg-surface-850 border border-surface-border rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
            <Wand2 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Brand-Aware Prompt Creator</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Discovers organic consumer search queries tailored to your brand's market strengths without ever biasing the search with brand name keywords.
          </p>
        </div>
      </div>
    </section>
  );
}
