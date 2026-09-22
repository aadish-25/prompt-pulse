import React, { useState, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import Header from './components/Header';
import KpiCards from './components/KpiCards';
import NavigationTabs from './components/NavigationTabs';
import TrackedPromptsQueue from './components/TrackedPromptsQueue';
import PromptExplorer from './components/PromptExplorer';
import CitationAudit from './components/CitationAudit';
import PromptCreator from './components/PromptCreator';
import LandingView from './components/LandingView';
import NewProjectModal from './components/NewProjectModal';
import Footer from './components/Footer';
import {
  fetchProjects,
  fetchProject,
  fetchProjectSummary,
  fetchProjectCitations,
  fetchProjectResults,
  fetchBatchRuns,
  pollBatchUntilDone,
  fetchProjectPrompts,
  togglePromptActive,
  deletePrompt,
  fetchSupportedModels,
  triggerBatchRun,
  generatePromptVariants,
  addPromptsBulk,
  createProject,
  deleteProject,
  FALLBACK_PROJECTS,
  FALLBACK_SUMMARY,
  FALLBACK_CITATIONS,
  FALLBACK_RUNS
} from './api/client';

export default function App() {
  // Navigation & View state
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'landing'
  const [activeTab, setActiveTab] = useState('explorer'); // 'explorer' | 'citations' | 'prompts' | 'generator'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [focusedPromptId, setFocusedPromptId] = useState(null);

  // Project state
  const [projects, setProjects] = useState(FALLBACK_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState(4);
  const [activeProject, setActiveProject] = useState(FALLBACK_PROJECTS[0]);

  // Data state
  const [prompts, setPrompts] = useState([]);
  const [summary, setSummary] = useState(FALLBACK_SUMMARY);
  const [citations, setCitations] = useState(FALLBACK_CITATIONS);
  const [runs, setRuns] = useState(FALLBACK_RUNS);
  
  // Execution config state
  const [supportedModels, setSupportedModels] = useState([
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'google/gemini-2.5-flash',
    'anthropic/claude-3.5-haiku',
    'meta-llama/llama-3.3-70b-instruct'
  ]);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
  const [selectedRounds, setSelectedRounds] = useState(1);

  // Status & loading indicators
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null); // { completed: number, total: number }
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load project details, prompts, and all executions
  const loadProjectData = useCallback(async (projId) => {
    if (!projId) {
      setRuns([]);
      setPrompts([]);
      setCitations([]);
      return;
    }
    try {
      const [projData, sumData, citData, runsData, promptsData] = await Promise.all([
        fetchProject(projId),
        fetchProjectSummary(projId),
        fetchProjectCitations(projId),
        fetchProjectResults(projId),
        fetchProjectPrompts(projId)
      ]);

      if (projData) setActiveProject(projData);
      setSummary(sumData || {
        total_runs: 0,
        overall_visibility_pct: 0,
        sentiment_breakdown: {},
        top_cited_domains: [],
        top_competitors: []
      });
      setCitations(citData || []);
      setRuns(runsData || []);
      setPrompts(promptsData || []);
    } catch (err) {
      console.warn('Error fetching project data, fallback retained:', err);
    }
  }, []);

  // Initial data hydration on mount
  useEffect(() => {
    async function initApp() {
      try {
        const [projList, modelData] = await Promise.all([
          fetchProjects(),
          fetchSupportedModels()
        ]);

        if (projList && projList.length > 0) {
          setProjects(projList);
          const defaultProj = projList.find(p => p.id === 4) || projList[0];
          setActiveProjectId(defaultProj.id);
          setActiveProject(defaultProj);
          await loadProjectData(defaultProj.id);
        }

        if (modelData?.supported_models) {
          setSupportedModels(modelData.supported_models);
          if (modelData.default_model) setSelectedModel(modelData.default_model);
        }
        setApiOnline(true);
      } catch (e) {
        console.warn('Backend unavailable, operating in offline fallback mode:', e);
        setApiOnline(false);
      }
    }
    initApp();
  }, [loadProjectData]);

  // Project Switcher handler
  const handleSelectProject = async (proj) => {
    setActiveProjectId(proj.id);
    setActiveProject(proj);
    await loadProjectData(proj.id);
  };

  // Delete project handler
  const handleDeleteProject = async (projectId) => {
    try {
      await deleteProject(projectId);
      const remaining = projects.filter(p => p.id !== projectId);
      setProjects(remaining);
      if (activeProjectId === projectId) {
        if (remaining.length > 0) {
          await handleSelectProject(remaining[0]);
        } else {
          setActiveProjectId(null);
          setActiveProject(null);
          setRuns([]);
          setPrompts([]);
          setSummary({
            total_runs: 0,
            overall_visibility_pct: 0,
            sentiment_breakdown: {},
            top_cited_domains: [],
            top_competitors: []
          });
          setCitations([]);
        }
      }
      showToast('Project deleted successfully.');
    } catch (err) {
      console.error('Failed to delete project:', err);
      showToast('Failed to delete project.');
    }
  };

  // Toggle prompt active/inactive
  const handleTogglePromptActive = async (promptId, newActive) => {
    // Optimistic update
    setPrompts(prev => prev.map(p => p.id === promptId ? { ...p, active: newActive } : p));
    try {
      await togglePromptActive(promptId, newActive);
    } catch (err) {
      console.error('Failed to toggle prompt active state:', err);
    }
  };

  // Delete prompt from tracking queue
  const handleDeletePrompt = async (promptId) => {
    // Optimistic update
    setPrompts(prev => prev.filter(p => p.id !== promptId));
    try {
      await deletePrompt(promptId);
    } catch (err) {
      console.error('Failed to delete prompt:', err);
      // Reload on failure
      await loadProjectData(activeProjectId);
    }
  };

  // Navigate to grounding deep-dive for a specific prompt
  const handleNavigateToGrounding = (run) => {
    if (run) {
      setFocusedPromptId(run.prompt_id || run.id);
    }
    setActiveTab('explorer');
  };

  // Trigger batch execution with real-time polling & progress updates
  const handleRunBatch = async () => {
    if (isRunningBatch) return;

    const activePrompts = prompts.filter(p => p.active);
    if (activePrompts.length === 0) {
      showToast('No active prompts configured for batch run. Please activate at least one prompt.');
      return;
    }

    setIsRunningBatch(true);
    const targetTotal = activePrompts.length * selectedRounds;
    setBatchProgress({ completed: 0, total: targetTotal });

    try {
      showToast(`Initiating tracking batch with ${selectedModel}...`);
      const batch = await triggerBatchRun(activeProjectId, selectedRounds, selectedModel);

      if (batch?.error) {
        showToast(`Batch execution failed: ${batch.error}`);
        return;
      }

      if (batch?.id) {
        showToast(`Batch #${batch.id} running across web sources...`);
        // Poll backend every 2s until all web searches, grounding, and LLM extractions finish
        await pollBatchUntilDone(batch.id, (b) => {
          setBatchProgress({
            completed: b.completed_runs || 0,
            total: b.total_runs || targetTotal
          });
        });
        showToast(`Batch #${batch.id} completed! All diagnostic cards and AI answers updated.`);
      }

      // Refresh all project data, latest executions, summary, and citations
      await loadProjectData(activeProjectId);
    } catch (err) {
      console.error('Batch run error:', err);
      showToast('An unexpected error occurred during batch execution.');
    } finally {
      setIsRunningBatch(false);
      setBatchProgress(null);
    }
  };

  // Generate brand-aware prompt variants
  const handleGenerateVariants = async () => {
    setIsGeneratingVariants(true);
    try {
      const res = await generatePromptVariants(activeProjectId, 10);
      return res?.variants || [];
    } catch (err) {
      console.error('Prompt generation error:', err);
      return [];
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  // Add prompts to project tracker without navigating away
  const handleAddPrompts = async (promptsList) => {
    try {
      await addPromptsBulk(activeProjectId, promptsList);
      // Always refresh database prompts so state reflects actual DB after insert
      const updatedPrompts = await fetchProjectPrompts(activeProjectId);
      if (updatedPrompts) {
        setPrompts(updatedPrompts);
      }
    } catch (err) {
      console.error('Add prompts error:', err);
    }
  };

  // Create new brand tracking project
  const handleCreateProject = async (newProjData) => {
    const created = await createProject(newProjData);
    if (created) {
      setProjects(prev => [...prev, created]);
      await handleSelectProject(created);
      setCurrentView('dashboard');
    }
  };

  return (
    <div className="min-h-screen flex flex-col antialiased bg-surface-900 text-slate-200">
      {/* Top Navigation Header */}
      <Header
        activeProject={activeProject}
        projects={projects}
        onSelectProject={handleSelectProject}
        onOpenNewProjectModal={() => setIsModalOpen(true)}
        onDeleteProject={handleDeleteProject}
        currentView={currentView}
        onToggleView={setCurrentView}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        supportedModels={supportedModels}
        selectedRounds={selectedRounds}
        onSelectRounds={setSelectedRounds}
        onRunBatch={handleRunBatch}
        isRunningBatch={isRunningBatch}
        batchProgress={batchProgress}
      />

      {/* Main View Area */}
      {currentView === 'landing' ? (
        <LandingView
          onGetStarted={() => setIsModalOpen(true)}
          onViewDemo={() => setCurrentView('dashboard')}
        />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
          {/* Top 4 Diagnostic KPI Header Cards */}
          <KpiCards summary={summary} activeProject={activeProject} />

          {/* Navigation Tabs (4 Sections) */}
          <NavigationTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            promptsCount={prompts.length}
          />

          {/* Tab 1: AI Answers & Grounding Deep-Dive */}
          {activeTab === 'explorer' && (
            <PromptExplorer
              runs={runs}
              focusedPromptId={focusedPromptId}
              activeProject={activeProject}
            />
          )}

          {/* Tab 2: Citation & Competitor Audit */}
          {activeTab === 'citations' && (
            <CitationAudit
              summary={summary}
              project={activeProject}
              citations={citations}
            />
          )}

          {/* Tab 3: Tracked Prompts Queue (All prompts serial number-wise) */}
          {activeTab === 'prompts' && (
            <TrackedPromptsQueue
              prompts={prompts}
              runs={runs}
              onToggleActive={handleTogglePromptActive}
              onDeletePrompt={handleDeletePrompt}
              onNavigateToGrounding={handleNavigateToGrounding}
              onNavigateToCreator={() => setActiveTab('generator')}
              onRunBatch={handleRunBatch}
              isRunningBatch={isRunningBatch}
              batchProgress={batchProgress}
            />
          )}

          {/* Tab 4: AI Prompt Creator */}
          {activeTab === 'generator' && (
            <PromptCreator
              project={activeProject}
              onAddPrompts={handleAddPrompts}
              onGenerateVariants={handleGenerateVariants}
              isGenerating={isGeneratingVariants}
            />
          )}
        </main>
      )}

      {/* Floating System Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <Check className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <Footer apiOnline={apiOnline} />

      {/* Modal: New Brand Project */}
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
}
