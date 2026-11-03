const API_BASE = "/api";

// ── In-Memory Cache for Instant 0ms Project Switching ────────────────────────
const cache = new Map();
const CACHE_TTL_MS = 25000; // 25s fresh cache

function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateProjectCache(projectId) {
    for (const key of cache.keys()) {
        if (key.includes(`proj_${projectId}`)) {
            cache.delete(key);
        }
    }
}

// ── Auth & BYOK Token Management ─────────────────────────────────────────────

export function getAuthToken() {
    return localStorage.getItem("promptpulse_token") || "";
}

export function setAuthToken(token) {
    if (token) {
        localStorage.setItem("promptpulse_token", token);
    } else {
        localStorage.removeItem("promptpulse_token");
    }
}

export function getByokKeys() {
    try {
        const raw = localStorage.getItem("promptpulse_byok_keys");
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function saveByokKeys(keys) {
    try {
        localStorage.setItem("promptpulse_byok_keys", JSON.stringify(keys || {}));
    } catch (e) {
        console.warn("Failed to save BYOK keys to localStorage:", e);
    }
}

function getRequestHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    const token = getAuthToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const byok = getByokKeys();
    if (byok.openrouter) headers["X-OpenRouter-Key"] = byok.openrouter;
    if (byok.groq) headers["X-Groq-Key"] = byok.groq;
    if (byok.deepseek) headers["X-DeepSeek-Key"] = byok.deepseek;
    if (byok.tavily) headers["X-Tavily-Key"] = byok.tavily;

    return headers;
}

// ── Auth API Calls ───────────────────────────────────────────────────────────

export async function apiLogin(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Invalid credentials");
    }
    const data = await res.json();
    setAuthToken(data.access_token);
    return data;
}

export async function apiDemoLogin() {
    const res = await fetch(`${API_BASE}/auth/demo-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Could not start demo session");
    const data = await res.json();
    setAuthToken(data.access_token);
    return data;
}

export async function apiGetMe() {
    const token = getAuthToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: getRequestHeaders(),
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("Auth check failed:", e);
    }
    return null;
}

export async function apiGetQuota(projectId) {
    if (!projectId) return null;
    try {
        const res = await fetch(`${API_BASE}/auth/quota/${projectId}`, {
            headers: getRequestHeaders(),
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("Failed to check quota:", e);
    }
    return null;
}

// ── Core Project API Calls ───────────────────────────────────────────────────

export async function fetchProjects() {
    const cached = getCached("projects_list");
    if (cached) return cached;

    try {
        const res = await fetch(`${API_BASE}/projects`, {
            headers: getRequestHeaders(),
        });
        if (res.ok) {
            const data = await res.json();
            setCache("projects_list", data);
            return data;
        }
    } catch (e) {
        console.warn("API projects unavailable, falling back:", e);
    }
    return FALLBACK_PROJECTS;
}

export async function fetchProject(projectId) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}`, {
            headers: getRequestHeaders(),
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("API unavailable, could not fetch project", e);
    }
    return null;
}

export const EMPTY_SUMMARY = {
    total_runs: 0,
    mentioned_count: 0,
    visibility_percentage: 0.0,
    own_domain_retrieved_count: 0,
    own_domain_cited_count: 0,
    own_domain_citation_percentage: 0.0,
    sentiment_breakdown: {},
    top_competitors: [],
};

export async function fetchProjectSummary(projectId) {
    const cacheKey = `proj_${projectId}_summary`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/summary`, {
            headers: getRequestHeaders(),
        });
        if (res.ok) {
            const data = await res.json();
            setCache(cacheKey, data);
            return data;
        }
    } catch (e) {
        console.warn("API unavailable, using fallback summary", e);
    }
    return EMPTY_SUMMARY;
}

export async function fetchProjectCitations(projectId) {
    const cacheKey = `proj_${projectId}_citations`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/citations`, {
            headers: getRequestHeaders(),
        });
        if (res.ok) {
            const data = await res.json();
            setCache(cacheKey, data);
            return data;
        }
    } catch (e) {
        console.warn("API unavailable, using fallback citations", e);
    }
    return [];
}

export async function fetchProjectResults(projectId) {
    const cacheKey = `proj_${projectId}_results`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/results`, {
            headers: getRequestHeaders(),
        });
        if (res.ok) {
            const data = await res.json();
            setCache(cacheKey, Array.isArray(data) ? data : []);
            return data;
        }
    } catch (e) {
        console.warn("API unavailable, using fallback results", e);
    }
    return [];
}

export async function clearProjectResults(projectId) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/results`, {
            method: "DELETE",
            headers: getRequestHeaders(),
        });
        if (res.ok) {
            invalidateProjectCache(projectId);
            return true;
        }
    } catch (e) {
        console.warn("Failed to clear project results", e);
    }
    return false;
}

export async function deleteExecution(executionId) {
    try {
        const res = await fetch(`${API_BASE}/executions/${executionId}`, {
            method: "DELETE",
            headers: getRequestHeaders(),
        });
        return res.ok;
    } catch (e) {
        console.warn("Failed to delete execution", e);
        return false;
    }
}

export async function pollBatchUntilDone(
    batchId,
    onProgress,
    maxSeconds = 180,
) {
    const start = Date.now();
    while (Date.now() - start < maxSeconds * 1000) {
        try {
            const res = await fetch(`${API_BASE}/batches/${batchId}`, {
                headers: getRequestHeaders(),
            });
            if (res.ok) {
                const batch = await res.json();
                if (onProgress) onProgress(batch);
                if (batch.status === "done" || batch.status === "failed") {
                    return batch;
                }
            }
        } catch (e) {
            console.warn("Batch poll error:", e);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return null;
}

export async function fetchSupportedModels() {
    try {
        const res = await fetch(`${API_BASE}/models`, {
            headers: getRequestHeaders(),
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("API unavailable, using fallback models", e);
    }
    return {
        default_model: "OR: openai/gpt-4o-mini",
        supported_models: [
            "OR: openai/gpt-4o-mini",
            "OR: google/gemini-2.5-flash",
            "OR: meta-llama/llama-3.3-70b-instruct",
            "OR: openai/gpt-4o",
            "GROQ: llama-3.3-70b-versatile",
            "GROQ: llama-3.1-8b-instant",
            "GROQ: mixtral-8x7b-32768",
            "DS: deepseek-chat",
            "DS: deepseek-reasoner",
        ],
    };
}

export async function saveProjectCandidates(projectId, candidates) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/candidates`, {
            method: "PUT",
            headers: getRequestHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ candidates: candidates || [] }),
        });
        if (res.ok) {
            invalidateProjectCache(projectId);
            return await res.json();
        }
    } catch (e) {
        console.warn("Failed to persist candidates to database", e);
    }
    return null;
}

export async function triggerBatchRun(
    projectId,
    rounds = 1,
    model = "OR: openai/gpt-4o-mini",
) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/runs`, {
            method: "POST",
            headers: getRequestHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ rounds, model }),
        });
        if (res.ok) {
            invalidateProjectCache(projectId);
            return await res.json();
        } else {
            const err = await res.json().catch(() => ({}));
            return {
                error: typeof err.detail === "object" ? err.detail.message : (err.detail || "Failed to start batch execution"),
                quotaExhausted: err.detail?.code === "FREE_TIER_EXHAUSTED",
            };
        }
    } catch (e) {
        console.warn("API batch trigger unavailable:", e);
        return { error: e.message || "API connection failed" };
    }
}

export async function fetchProjectPrompts(projectId) {
    const cacheKey = `proj_${projectId}_prompts`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/prompts`, {
            headers: getRequestHeaders(),
        });
        if (res.ok) {
            const data = await res.json();
            setCache(cacheKey, Array.isArray(data) ? data : []);
            return data;
        }
    } catch (e) {
        console.warn("API unavailable, using fallback project prompts", e);
    }
    return [];
}

export async function togglePromptActive(promptId, active) {
    try {
        const res = await fetch(`${API_BASE}/prompts/${promptId}`, {
            method: "PATCH",
            headers: getRequestHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ active }),
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("Toggle prompt active API failed", e);
    }
    return { id: promptId, active };
}

export async function deletePrompt(promptId) {
    try {
        const res = await fetch(`${API_BASE}/prompts/${promptId}`, {
            method: "DELETE",
            headers: getRequestHeaders(),
        });
        return res.ok;
    } catch (e) {
        console.warn("Delete prompt API failed", e);
        return false;
    }
}

export async function deleteProject(projectId) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}`, {
            method: "DELETE",
            headers: getRequestHeaders(),
        });
        if (res.ok) {
            cache.delete("projects_list");
            invalidateProjectCache(projectId);
            return true;
        }
    } catch (e) {
        console.warn("Delete project API failed", e);
    }
    return false;
}

const INTENT_LABELS = {
    core_need: "Core Need",
    criteria: "Criteria",
    competitor: "Competitor Conquest",
    persona: "Persona / Use Case",
    transaction: "Pricing & Budget",
};

export async function generatePromptVariants(
    projectId,
    count = 10,
    model = null,
    seedTopic = null,
) {
    try {
        const res = await fetch(
            `${API_BASE}/projects/${projectId}/prompts/generate-variants`,
            {
                method: "POST",
                headers: getRequestHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    count: Math.min(count, 10),
                    model: model || undefined,
                    seed_topic: seedTopic || undefined,
                }),
            },
        );
        if (res.ok) {
            const data = await res.json();
            if (data && data.variants && data.variants.length > 0) {
                invalidateProjectCache(projectId);
                return {
                    model: data.model || model,
                    variants: data.variants.map((v) => ({
                        prompt: v.text,
                        topic: INTENT_LABELS[v.intent_category] || v.intent_category || "Consumer Query",
                        intent: "Natural Search",
                        rationale: v.rationale,
                    })),
                };
            }
        }
    } catch (e) {
        console.warn("Variant generator API unavailable:", e);
    }
    return { variants: [], model };
}

export async function addPrompt(projectId, text) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/prompts`, {
            method: "POST",
            headers: getRequestHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ text }),
        });
        if (res.ok) {
            invalidateProjectCache(projectId);
            return await res.json();
        }
    } catch (e) {
        console.warn("Add prompt API unavailable", e);
    }
    return { id: Date.now(), project_id: projectId, text, active: true };
}

export async function addPromptsBulk(projectId, texts) {
    try {
        const res = await fetch(
            `${API_BASE}/projects/${projectId}/prompts/bulk`,
            {
                method: "POST",
                headers: getRequestHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ texts }),
            },
        );
        if (res.ok) {
            invalidateProjectCache(projectId);
            return await res.json();
        }
    } catch (e) {
        console.warn("Bulk add prompts API unavailable", e);
    }
    return texts.map((t, idx) => ({
        id: Date.now() + idx,
        project_id: projectId,
        text: t,
        active: true,
    }));
}

export async function createProject(data) {
    const res = await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: getRequestHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create project (HTTP ${res.status})`);
    }
    cache.delete("projects_list");
    return await res.json();
}

// ── Default Fallback Projects for Offline Exploration ────────────────────────

export const FALLBACK_PROJECTS = [
    {
        id: 4,
        brand_name: "Amul",
        domain: ["amul.com"],
        competitors: ["Mother Dairy", "Britannia", "Nandini", "Gowardhan"],
    },
    {
        id: 1,
        brand_name: "Nike",
        domain: ["nike.com"],
        competitors: ["Adidas", "Puma", "Reebok"],
    },
    {
        id: 2,
        brand_name: "boAt",
        domain: ["boat-lifestyle.com"],
        competitors: ["Noise", "JBL", "Boult"],
    },
];

export const FALLBACK_PROJECT = FALLBACK_PROJECTS[0];
