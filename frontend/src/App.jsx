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
    saveProjectCandidates,
    clearProjectResults,
    deleteExecution,
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

    // Prompt creator state — lifted and persisted directly in Neon DB
    const [candidates, setCandidates] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Execution config
    const [supportedModels, setSupportedModels] = useState([
        "OR: openai/gpt-4o-mini",
        "OR: google/gemini-2.5-flash",
        "OR: meta-llama/llama-3.3-70b-instruct",
        "OR: openai/gpt-4o",
        "GROQ: openai/gpt-oss-120b",
        "GROQ: qwen/qwen3.8-27b",
        "GROQ: openai/gpt-oss-20b",
        "DS: deepseek-chat",
        "DS: deepseek-reasoner",
    ]);
    const [selectedModel, setSelectedModel] = useState("OR: openai/gpt-4o-mini");
    const [selectedRounds, setSelectedRounds] = useState(1);

    // Sync candidates from real database (with localStorage fallback)
    useEffect(() => {
        if (!activeProjectId) {
            setCandidates([]);
            setSelectedIds(new Set());
            return;
        }
        const proj = projects.find((p) => p.id === activeProjectId);
        if (proj?.draft_candidates && Array.isArray(proj.draft_candidates) && proj.draft_candidates.length > 0) {
            setCandidates(proj.draft_candidates);
            setSelectedIds(new Set(proj.draft_candidates.map((c) => c.id)));
            return;
        }
        try {
            const raw = localStorage.getItem(`promptpulse_candidates_${activeProjectId}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCandidates(parsed);
                    setSelectedIds(new Set(parsed.map((c) => c.id)));
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to load saved prompt candidates:", e);
        }
        setCandidates([]);
        setSelectedIds(new Set());
    }, [activeProjectId, projects]);

    // Save candidates to real database & state
    const handleCandidatesChange = (newCandidates) => {
        setCandidates(newCandidates);
        if (activeProjectId) {
            // Write directly to Neon PostgreSQL database
            saveProjectCandidates(activeProjectId, newCandidates);
            // Also keep local cache
            try {
                if (newCandidates && newCandidates.length > 0) {
                    localStorage.setItem(
                        `promptpulse_candidates_${activeProjectId}`,
                        JSON.stringify(newCandidates)
                    );
                } else {
                    localStorage.removeItem(`promptpulse_candidates_${activeProjectId}`);
                }
            } catch (e) {
                console.warn("Failed to save candidates to localStorage:", e);
            }
        }
    };

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
            const [sumData, citData, runsData, promptsData] =
                await Promise.all([
                    fetchProjectSummary(projId),
                    fetchProjectCitations(projId),
                    fetchProjectResults(projId),
                    fetchProjectPrompts(projId),
                ]);
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
                    const defaultProj = projList[0];
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

    const handleDeletePrompt = (promptId) => {
        let prevPrompts;
        setPrompts((prev) => {
            prevPrompts = prev;
            return prev.filter((p) => p.id !== promptId);
        });
        deletePrompt(promptId).catch((err) => {
            console.error("Failed to delete prompt:", err);
            if (prevPrompts) setPrompts(prevPrompts);
            showToast("Failed to delete prompt.");
        });
    };

    const handleClearResults = async () => {
        if (!activeProjectId) return;
        try {
            const ok = await clearProjectResults(activeProjectId);
            if (ok) {
                setRuns([]);
                setSummary(EMPTY_SUMMARY);
                setCitations([]);
                showToast("All execution test results cleared.");
            } else {
                showToast("Failed to clear results.");
            }
        } catch (err) {
            console.error("Failed to clear results:", err);
            showToast("Failed to clear results.");
        }
    };

    const handleDeleteExecution = (executionId) => {
        let previousRuns;
        setRuns((prev) => {
            previousRuns = prev;
            return prev.filter((r) => r.id !== executionId);
        });

        deleteExecution(executionId)
            .then((ok) => {
                if (ok) {
                    if (activeProjectId) {
                        fetchProjectSummary(activeProjectId).then((s) => s && setSummary(s));
                        fetchProjectCitations(activeProjectId).then((c) => c && setCitations(c));
                    }
                } else {
                    if (previousRuns) setRuns(previousRuns);
                    showToast("Failed to delete execution on server.");
                }
            })
            .catch((err) => {
                console.error("Failed to delete execution:", err);
                if (previousRuns) setRuns(previousRuns);
                showToast("Failed to delete execution on server.");
            });
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
    const handleGenerateVariants = async (seedTopic = null) => {
        if (!activeProjectId) return { variants: [], model: selectedModel };
        setIsGeneratingVariants(true);
        try {
            console.log(
                `[App.jsx] Requesting 10 prompt variants with model: "${selectedModel}" for Project #${activeProjectId} (Topic: ${seedTopic || "Auto"})`,
            );
            const res = await generatePromptVariants(
                activeProjectId,
                10,
                selectedModel,
                seedTopic,
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
                                    onClearResults={handleClearResults}
                                    onDeleteExecution={handleDeleteExecution}
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
                                    onCandidatesChange={handleCandidatesChange}
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
