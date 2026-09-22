import React from 'react';
import { Radar } from 'lucide-react';

/**
 * Footer component - Status indicators for backend API, Tavily, and OpenRouter LLM pipeline.
 */
export default function Footer({ apiOnline = true }) {
  return (
    <footer className="border-t border-surface-border bg-surface-850 py-5 px-6 mt-12 text-xs text-slate-400">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Radar className="w-4 h-4 text-blue-400" />
            PromptPulse
          </span>
          <span className="text-slate-500 font-mono">v0.1.0</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">Generative Engine Optimization (GEO) Platform</span>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 font-sans text-xs text-slate-400">
          <span className={`flex items-center gap-1.5 ${apiOnline ? 'text-emerald-400' : 'text-amber-400'} font-medium`}>
            <span className={`w-1.5 h-1.5 rounded-full ${apiOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            Backend API: {apiOnline ? 'Online (Port 8000)' : 'Fallback Mock Mode'}
          </span>
          <span className="text-slate-600">·</span>
          <span>Tavily Search Grounded</span>
          <span className="text-slate-600">·</span>
          <span>OpenRouter LLM Pipeline</span>
        </div>
      </div>
    </footer>
  );
}
