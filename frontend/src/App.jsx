import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import KpiCards from './components/KpiCards';
import NavigationTabs from './components/NavigationTabs';
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
  fetchBatchRuns,
  fetchSupportedModels,
  triggerBatchRun,
  generatePromptVariants,
  addPromptsBulk,
  createProject,
  FALLBACK_PROJECTS,
  FALLBACK_SUMMARY,
  FALLBACK_CITATIONS,
  FALLBACK_RUNS
} from './api/client';

export default function App() {
  // Navigation & View state
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'landing'
  const [activeTab, setActiveTab] = useState('explorer'); // 'explorer' | 'citations' | 'generator'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Project state
  const [projects, setProjects] = useState(FALLBACK_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState(4);
  const [activeProject, setActiveProject] = useState(FALLBACK_PROJECTS[0]);

  // Data state
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
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);

  // Load project details and executions
  const loadProjectData = useCallback(async (projId) => {
    try {
      const [projData, sumData, citData, runsData] = await Promise.all([
        fetchProject(projId),
        fetchProjectSummary(projId),
        fetchProjectCitations(projId),
        fetchBatchRuns(projId)
      ]);

      if (projData) setActiveProject(projData);
      if (sumData) setSummary(sumData);
      if (citData) setCitations(citData);
      if (runsData && runsData.length > 0) setRuns(runsData);
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

  // Trigger batch execution
  const handleRunBatch = async () => {
    if (isRunningBatch) return;
    setIsRunningBatch(true);
    try {
      await triggerBatchRun(activeProjectId, selectedRounds, selectedModel);
      // Refresh project summary and executions
      await loadProjectData(activeProjectId);
    } catch (err) {
      console.error('Batch run error:', err);
    } finally {
      setIsRunningBatch(false);
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

  // Add prompts to project tracker
  const handleAddPrompts = async (promptsList) => {
    try {
      await addPromptsBulk(activeProjectId, promptsList);
      await loadProjectData(activeProjectId);
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
        currentView={currentView}
        onToggleView={setCurrentView}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        supportedModels={supportedModels}
        selectedRounds={selectedRounds}
        onSelectRounds={setSelectedRounds}
        onRunBatch={handleRunBatch}
        isRunningBatch={isRunningBatch}
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

          {/* Navigation Tabs */}
          <NavigationTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Tab Views */}
          {activeTab === 'explorer' && (
            <PromptExplorer runs={runs} />
          )}

          {activeTab === 'citations' && (
            <CitationAudit
              summary={summary}
              project={activeProject}
              citations={citations}
            />
          )}

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
