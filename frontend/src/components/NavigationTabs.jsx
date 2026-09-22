import React from 'react';
import { LayoutList, Network, Sparkles } from 'lucide-react';

export default function NavigationTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'explorer', label: 'Prompts & Grounding Explorer', icon: LayoutList },
    { id: 'citations', label: 'Citation & Competitor Audit', icon: Network },
    { id: 'generator', label: 'AI Prompt Creator', icon: Sparkles, iconClass: 'text-blue-400' },
  ];

  return (
    <nav className="flex items-center gap-2 border-b border-surface-border text-sm">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2.5 font-medium flex items-center gap-2 transition-colors border-b-2 cursor-pointer ${
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
