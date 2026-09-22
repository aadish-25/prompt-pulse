import React, { useState, useEffect, useCallback } from "react";
import {
    Routes,
    Route,
    Navigate,
    useNavigate,
    useLocation,
} from "react-router-dom";
import { Check } from "lucide-react";
import Header from "./components/Header";
import KpiCards from "./components/KpiCards";
import NavigationTabs from "./components/NavigationTabs";
import TrackedPromptsQueue from "./components/TrackedPromptsQueue";
import PromptExplorer from "./components/PromptExplorer";
import CitationAudit from "./components/CitationAudit";
import PromptCreator from "./components/PromptCreator";
import LandingView from "./components/LandingView";
import NewProjectModal from "./components/NewProjectModal";
import Footer from "./components/Footer";
import {
    fetchProjects,
    fetchProject,
    fetchProjectSummary,
    fetchProjectCitations,
    fetchProjectResults,
    fetchProjectPrompts,
    togglePromptActive,
    deletePrompt,
    fetchSupportedModels,
    triggerBatchRun,
    pollBatchUntilDone,
    generatePromptVariants,
    addPromptsBulk,
    createProject,
    deleteProject,
    EMPTY_SUMMARY,
} from "./api/client";

export default function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname === "/dashboard";

    const [activeTab, setActiveTab] = useState("explorer");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [focusedPromptId, setFocusedPromptId] = useState(null);

    // Project state — always starts empty (no fallback data)
    const [projects, setProjects] = useState([]);
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [activeProject, setActiveProject] = useState(null);

    // Data state — always starts empty
    const [prompts, setPrompts] = useState([]);
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [citations, setCitations] = useState([]);
    const [runs, setRuns] = useState([]);

    // Prompt creator state — lifted so candidates survive tab switches
    const [candidates, setCandidates] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Execution config
    const [supportedModels, setSupportedModels] = useState([
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "google/gemini-2.5-flash",
        "anthropic/claude-haiku-4.5:batch",
        "meta-llama/llama-3.3-70b-instruct",
    ]);
    const [selectedModel, setSelectedModel] = useState("openai/gpt-4o-mini");
    const [selectedRounds, setSelectedRounds] = useState(1);

    // Status flags
    const [isRunningBatch, setIsRunningBatch] = useState(false);
    const [batchProgress, setBatchProgress] = useState(null);
    const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
    const [apiOnline, setApiOnline] = useState(true);
    const [toastMessage, setToastMessage] = useState(null);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Load all data for a project
    const loadProjectData = useCallback(async (projId) => {
        if (!projId) {
            setRuns([]);
            setPrompts([]);
            setCitations([]);
            setSummary(EMPTY_SUMMARY);
            return;
        }
        try {
            const [projData, sumData, citData, runsData, promptsData] =
                await Promise.all([
                    fetchProject(projId),
                    fetchProjectSummary(projId),
                    fetchProjectCitations(projId),
                    fetchProjectResults(projId),
                    fetchProjectPrompts(projId),
                ]);
            if (projData) setActiveProject(projData);
            setSummary(sumData || EMPTY_SUMMARY);
            setCitations(citData || []);
            setRuns(runsData || []);
            setPrompts(promptsData || []);
        } catch (err) {
            console.warn("Error fetching project data:", err);
        }
    }, []);

    // Boot — fetch projects & models, then route accordingly
    useEffect(() => {
        async function init() {
            try {
                const [projList, modelData] = await Promise.all([
                    fetchProjects(),
                    fetchSupportedModels(),
                ]);

                if (projList && projList.length > 0) {
                    setProjects(projList);
                    const defaultProj =
                        projList.find((p) => p.id === 4) || projList[0];
                    setActiveProjectId(defaultProj.id);
                    setActiveProject(defaultProj);
                    await loadProjectData(defaultProj.id);
                    // Only push to dashboard if currently on root
                    if (location.pathname === "/") {
                        navigate("/dashboard", { replace: true });
                    }
                } else {
                    // No projects → stay on / (landing)
                    if (location.pathname !== "/") {
                        navigate("/", { replace: true });
                    }
                }

                if (modelData?.supported_models) {
                    setSupportedModels(modelData.supported_models);
                    if (modelData.default_model)
                        setSelectedModel(modelData.default_model);
                }
                setApiOnline(true);
            } catch (e) {
                console.warn("Backend unavailable:", e);
                setApiOnline(false);
                navigate("/", { replace: true });
            }
        }
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Select a different project
    const handleSelectProject = async (proj) => {
        setActiveProjectId(proj.id);
        setActiveProject(proj);
        setCandidates([]);
        setSelectedIds(new Set());
        await loadProjectData(proj.id);
        if (location.pathname !== "/dashboard") {
            navigate("/dashboard");
        }
    };

    // Delete a project
    const handleDeleteProject = async (projectId) => {
        try {
            await deleteProject(projectId);
            const remaining = projects.filter((p) => p.id !== projectId);
            setProjects(remaining);

            if (remaining.length === 0) {
                // All gone → landing
                setActiveProjectId(null);
                setActiveProject(null);
                setRuns([]);
                setPrompts([]);
                setCandidates([]);
                setSelectedIds(new Set());
                setSummary(EMPTY_SUMMARY);
                setCitations([]);
                showToast(
                    "Project deleted. Create a new project to get started.",
                );
                navigate("/");
            } else if (activeProjectId === projectId) {
                await handleSelectProject(remaining[0]);
                showToast(
                    "Project deleted. Switched to the next available project.",
                );
            } else {
                showToast("Project deleted successfully.");
            }
        } catch (err) {
            console.error("Failed to delete project:", err);
            showToast("Failed to delete project.");
        }
    };

    const handleTogglePromptActive = async (promptId, newActive) => {
        setPrompts((prev) =>
            prev.map((p) =>
                p.id === promptId ? { ...p, active: newActive } : p,
            ),
        );
        try {
            await togglePromptActive(promptId, newActive);
        } catch (err) {
            console.error("Failed to toggle prompt:", err);
        }
    };

    const handleDeletePrompt = async (promptId) => {
        setPrompts((prev) => prev.filter((p) => p.id !== promptId));
        try {
            await deletePrompt(promptId);
        } catch (err) {
            console.error("Failed to delete prompt:", err);
            await loadProjectData(activeProjectId);
        }
    };

    const handleNavigateToGrounding = (run) => {
        if (run) setFocusedPromptId(run.prompt_id || run.id);
        setActiveTab("explorer");
    };

    const handleRunBatch = async () => {
        if (isRunningBatch || !activeProjectId) return;
        const activePrompts = prompts.filter((p) => p.active);
        if (activePrompts.length === 0) {
            showToast(
                "No active prompts configured. Please activate at least one prompt.",
            );
            return;
        }
        setIsRunningBatch(true);
        const targetTotal = activePrompts.length * selectedRounds;
        setBatchProgress({ completed: 0, total: targetTotal });
        try {
            showToast(`Initiating tracking batch with ${selectedModel}...`);
            const batch = await triggerBatchRun(
                activeProjectId,
                selectedRounds,
                selectedModel,
            );
            if (batch?.error) {
                showToast(`Batch failed: ${batch.error}`);
                return;
            }
            if (batch?.id) {
                showToast(`Batch #${batch.id} running...`);
                await pollBatchUntilDone(batch.id, (b) => {
                    setBatchProgress({
                        completed: b.completed_runs || 0,
                        total: b.total_runs || targetTotal,
                    });
                });
                showToast(`Batch #${batch.id} completed!`);
            }
            await loadProjectData(activeProjectId);
        } catch (err) {
            console.error("Batch run error:", err);
            showToast("Unexpected error during batch execution.");
        } finally {
            setIsRunningBatch(false);
            setBatchProgress(null);
        }
    };

    // Guard: only generate if a project exists
    const handleGenerateVariants = async () => {
        if (!activeProjectId) return { variants: [], model: selectedModel };
        setIsGeneratingVariants(true);
        try {
            console.log(
                `[App.jsx] Requesting 10 prompt variants with model: "${selectedModel}" for Project #${activeProjectId}`,
            );
            const res = await generatePromptVariants(
                activeProjectId,
                10,
                selectedModel,
            );
            console.log(
                `[App.jsx] Received prompt variants from backend. Model used: "${res?.model || selectedModel}"`,
            );
            return res;
        } catch (err) {
            console.error("Prompt generation error:", err);
            return { variants: [], model: selectedModel };
        } finally {
            setIsGeneratingVariants(false);
        }
    };

    const handleAddPrompts = async (promptsList) => {
        if (!activeProjectId) return;
        try {
            await addPromptsBulk(activeProjectId, promptsList);
            const updated = await fetchProjectPrompts(activeProjectId);
            if (updated) setPrompts(updated);
        } catch (err) {
            console.error("Add prompts error:", err);
        }
    };

    const handleCreateProject = async (newProjData) => {
        const created = await createProject(newProjData);
        if (created) {
            setProjects((prev) => [...prev, created]);
            await handleSelectProject(created);
        }
    };

    return (
        <div className="min-h-screen flex flex-col antialiased bg-surface-900 text-slate-200">
            <Header
                activeProject={activeProject}
                projects={projects}
                onSelectProject={handleSelectProject}
                onOpenNewProjectModal={() => setIsModalOpen(true)}
                onDeleteProject={handleDeleteProject}
                isDashboard={isDashboard}
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                supportedModels={supportedModels}
                selectedRounds={selectedRounds}
                onSelectRounds={setSelectedRounds}
                onRunBatch={handleRunBatch}
                isRunningBatch={isRunningBatch}
                batchProgress={batchProgress}
            />

            <Routes>
                {/* Landing — shown when no projects or explicitly navigated */}
                <Route
                    path="/"
                    element={
                        <LandingView
                            onGetStarted={() => setIsModalOpen(true)}
                        />
                    }
                />

                {/* Dashboard — project-specific view */}
                <Route
                    path="/dashboard"
                    element={
                        <main className="flex-1 max-w-7xl w-full mx-auto px-6 pt-5 pb-8 space-y-5">
                            <KpiCards
                                summary={summary}
                                activeProject={activeProject}
                            />

                            <NavigationTabs
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                                promptsCount={prompts.length}
                            />

                            {activeTab === "explorer" && (
                                <PromptExplorer
                                    runs={runs}
                                    focusedPromptId={focusedPromptId}
                                    activeProject={activeProject}
                                />
                            )}
                            {activeTab === "citations" && (
                                <CitationAudit
                                    summary={summary}
                                    project={activeProject}
                                    citations={citations}
                                />
                            )}
                            {activeTab === "prompts" && (
                                <TrackedPromptsQueue
                                    prompts={prompts}
                                    runs={runs}
                                    onToggleActive={handleTogglePromptActive}
                                    onDeletePrompt={handleDeletePrompt}
                                    onNavigateToGrounding={
                                        handleNavigateToGrounding
                                    }
                                    onNavigateToCreator={() =>
                                        setActiveTab("generator")
                                    }
                                    onRunBatch={handleRunBatch}
                                    isRunningBatch={isRunningBatch}
                                    batchProgress={batchProgress}
                                />
                            )}
                            {activeTab === "generator" && (
                                <PromptCreator
                                    project={activeProject}
                                    selectedModel={selectedModel}
                                    candidates={candidates}
                                    selectedIds={selectedIds}
                                    onCandidatesChange={setCandidates}
                                    onSelectedIdsChange={setSelectedIds}
                                    onAddPrompts={handleAddPrompts}
                                    onGenerateVariants={handleGenerateVariants}
                                    isGenerating={isGeneratingVariants}
                                />
                            )}
                        </main>
                    }
                />

                {/* Catch-all → landing */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 text-xs font-semibold animate-fade-in">
                    <Check className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            <Footer apiOnline={apiOnline} />

            <NewProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreateProject={handleCreateProject}
            />
        </div>
    );
}
