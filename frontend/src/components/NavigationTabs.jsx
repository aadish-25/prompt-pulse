import React from 'react';
import { ListChecks, LayoutList, Network, Sparkles } from 'lucide-react';

/**
 * NavigationTabs - 4 clean section tabs:
 * 1. Tracked Prompts (all project queries serial number-wise)
 * 2. AI Answers & Grounding (renamed grounding inspector)
 * 3. Citation & Competitor Audit
 * 4. AI Prompt Creator
 */
export default function NavigationTabs({ activeTab, onTabChange, promptsCount = 0 }) {
  const tabs = [
    { 
      id: 'explorer', 
      label: 'AI Answers & Grounding', 
      icon: LayoutList 
    },
    { 
      id: 'citations', 
      label: 'Citation & Competitor Audit', 
      icon: Network 
    },
    { 
      id: 'prompts', 
      label: promptsCount > 0 ? `Tracked Prompts (${promptsCount})` : 'Tracked Prompts', 
      icon: ListChecks 
    },
    { 
      id: 'generator', 
      label: 'AI Prompt Creator', 
      icon: Sparkles, 
      iconClass: 'text-blue-400' 
    },
  ];

  return (
    <nav className="flex items-center gap-2 border-b border-surface-border text-sm overflow-x-auto custom-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2.5 font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              isActive
                ? 'text-white border-blue-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Icon className={`w-4 h-4 ${tab.iconClass || ''}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
