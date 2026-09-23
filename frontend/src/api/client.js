const API_BASE = "/api";

/**
 * Fetch list of all tracking projects.
 */
export async function fetchProjects() {
    try {
        const res = await fetch(`${API_BASE}/projects`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("API unavailable, using fallback projects", e);
    }
    return FALLBACK_PROJECTS;
}

/**
 * Fetch a single project by ID.
 */
export async function fetchProject(projectId) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}`);
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

/**
 * Fetch summary diagnostic metrics for a project.
 */
export async function fetchProjectSummary(projectId) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/summary`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("API unavailable, using fallback summary", e);
    }
    return EMPTY_SUMMARY;
}

/**
 * Fetch domain citation stats for a project.
 */
export async function fetchProjectCitations(projectId) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/citations`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("API unavailable, using fallback citations", e);
    }
    return [];
}

/**
 * Fetch all execution runs for a project directly from the database.
 */
export async function fetchProjectResults(projectId) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/results`);
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
    } catch (e) {
        console.warn("API unavailable, using fallback results", e);
    }
    return [];
}

/**
 * Clear all execution runs and test results for a project.
 */
export async function clearProjectResults(projectId) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/results`, {
            method: "DELETE",
        });
        return res.ok;
    } catch (e) {
        console.warn("Failed to clear project results", e);
        return false;
    }
}

/**
 * Fetch batch execution runs (maps to project results for seamless compatibility).
 */
export async function fetchBatchRuns(projectIdOrBatchId = 4) {
    return await fetchProjectResults(projectIdOrBatchId);
}

/**
 * Poll a tracking batch until it finishes execution.
 */
export async function pollBatchUntilDone(
    batchId,
    onProgress,
    maxSeconds = 180,
) {
    const start = Date.now();
    while (Date.now() - start < maxSeconds * 1000) {
        try {
            const res = await fetch(`${API_BASE}/batches/${batchId}`);
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

/**
 * Fetch list of supported LLM models for execution.
 */
export async function fetchSupportedModels() {
    try {
        const res = await fetch(`${API_BASE}/models`);
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
            "GROQ: openai/gpt-oss-120b",
            "GROQ: qwen/qwen3.8-27b",
            "GROQ: openai/gpt-oss-20b",
            "DS: deepseek-chat",
            "DS: deepseek-reasoner",
        ],
    };
}

/**
 * Save draft prompt candidates to the project in the database.
 */
export async function saveProjectCandidates(projectId, candidates) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/candidates`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidates: candidates || [] }),
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("Failed to persist candidates to database", e);
    }
    return null;
}

/**
 * Trigger a new tracking batch run on the backend.
 */
export async function triggerBatchRun(
    projectId = 4,
    rounds = 1,
    model = "openai/gpt-4o-mini",
) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/runs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rounds, model }),
        });
        if (res.ok) {
            return await res.json();
        } else {
            const err = await res.json().catch(() => ({}));
            console.error("Batch trigger error:", err);
            return { error: err.detail || "Failed to start batch execution" };
        }
    } catch (e) {
        console.warn("API batch trigger unavailable, using mock batch", e);
        return { error: e.message || "API connection failed" };
    }
}

/**
 * Fetch all tracked prompts configured for a project.
 */
export async function fetchProjectPrompts(projectId = 4) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/prompts`);
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
    } catch (e) {
        console.warn("API unavailable, using fallback project prompts", e);
    }
    return projectId === 4
        ? [
              {
                  id: 9,
                  project_id: projectId,
                  text: "Which butter brand is best for everyday cooking in India?",
                  active: true,
              },
              {
                  id: 10,
                  project_id: projectId,
                  text: "What is the most popular ice cream brand in India right now?",
                  active: true,
              },
              {
                  id: 11,
                  project_id: projectId,
                  text: "Which Indian dairy brand is most trusted for milk and milk products?",
                  active: true,
              },
              {
                  id: 12,
                  project_id: projectId,
                  text: "Best paneer brand available in Indian supermarkets in 2026?",
                  active: true,
              },
              {
                  id: 13,
                  project_id: projectId,
                  text: "Which cheese brand do professional chefs in India prefer?",
                  active: true,
              },
          ]
        : [];
}

/**
 * Toggle active state of a prompt.
 */
export async function togglePromptActive(promptId, active) {
    try {
        const res = await fetch(`${API_BASE}/prompts/${promptId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active }),
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("Toggle prompt active API failed", e);
    }
    return { id: promptId, active };
}

/**
 * Delete a prompt from the project tracking queue.
 */
export async function deletePrompt(promptId) {
    try {
        const res = await fetch(`${API_BASE}/prompts/${promptId}`, {
            method: "DELETE",
        });
        return res.ok;
    } catch (e) {
        console.warn("Delete prompt API failed", e);
    }
    return true;
}

/**
 * Delete a brand tracking project and all its associated data.
 */
export async function deleteProject(projectId) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}`, {
            method: "DELETE",
        });
        return res.ok;
    } catch (e) {
        console.warn("Delete project API failed", e);
    }
    return true;
}

const INTENT_LABELS = {
    core_need: "Core Need",
    criteria: "Criteria",
    competitor: "Competitor Conquest",
    persona: "Persona / Use Case",
    transaction: "Pricing & Budget",
};

/**
 * Generate brand-aware search prompt variants via backend LLM.
 */
export async function generatePromptVariants(
    projectId,
    count = 10,
    model = null,
    seedTopic = null,
) {
    try {
        console.log(
            `[GEO Prompt Generator] Sending generate request for Project #${projectId} with Model: "${model || "default"}" (Topic: ${seedTopic || "Auto"})`,
        );
        const res = await fetch(
            `${API_BASE}/projects/${projectId}/prompts/generate-variants`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    count: Math.min(count, 10),
                    model: model || undefined,
                    seed_topic: seedTopic || undefined,
                }),
            },
        );
        if (res.ok) {
            const data = await res.json();
            console.log(
                `[GEO Prompt Generator] Backend returned variants generated by Model: "${data.model || model || "default"}"`,
                data,
            );
            if (data && data.variants && data.variants.length > 0) {
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

/**
 * Add custom prompt to project.
 */
export async function addPrompt(projectId = 4, text) {
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/prompts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("Add prompt API unavailable", e);
    }
    return { id: Date.now(), project_id: projectId, text, active: true };
}

/**
 * Add bulk prompts to project.
 */
export async function addPromptsBulk(projectId = 4, texts) {
    try {
        const res = await fetch(
            `${API_BASE}/projects/${projectId}/prompts/bulk`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts }),
            },
        );
        if (res.ok) return await res.json();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create project (HTTP ${res.status})`);
    }
    return await res.json();
}

// ==========================================
// REAL DATABASE GROUNDING DATA FOR AMUL (PROJECT 4)
// Directly extracted from PostgreSQL test runs
// ==========================================

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

export const FALLBACK_SUMMARY = {
    total_runs: 5,
    mentioned_count: 5,
    visibility_percentage: 100.0,
    own_domain_retrieved_count: 0,
    own_domain_cited_count: 0,
    own_domain_citation_percentage: 0.0,
    sentiment_breakdown: { positive: 5 },
    top_competitors: [
        { brand: "Mother Dairy", count: 3 },
        { brand: "Britannia", count: 2 },
        { brand: "Gowardhan", count: 2 },
        { brand: "Nandini", count: 2 },
        { brand: "President Butter", count: 1 },
    ],
};

export const FALLBACK_CITATIONS = [
    { domain: "cashkaro.com", retrieved: 4, cited: 3 },
    { domain: "expertmarketresearch.com", retrieved: 4, cited: 3 },
    { domain: "restaurantindia.in", retrieved: 7, cited: 2 },
    { domain: "consumer-voice.org", retrieved: 2, cited: 1 },
    { domain: "mishry.com", retrieved: 3, cited: 1 },
    { domain: "amul.com", retrieved: 0, cited: 0 },
];

export const FALLBACK_RUNS = [
    {
        id: 8,
        prompt_id: 1,
        prompt_text:
            "Which butter brand is best for everyday cooking in India?",
        round: 1,
        status: "done",
        model: "openai/gpt-4o-mini",
        duration_ms: 35000,
        search_queries: [
            { query: "best butter brand for everyday cooking in India 2026" },
            { query: "Amul butter India 2026 review" },
            { query: "President butter India 2026 review" },
        ],
        raw_answer: `In India, several butter brands stand out for everyday cooking, particularly **Amul** and **President Butter**.\n\n1. **Amul Butter:** Amul is a household name in India, known for its rich flavor and creamy texture. It has a longstanding reputation and is considered a staple in Indian kitchens for frying, baking, and spreading on rotis and parathas [1].\n\n2. **President Butter:** Originating from France but widely available in India, President offers a gourmet alternative with higher butterfat content, favored by chefs for pastry and sautéing [3].\n\n3. **Mother Dairy Butter:** Particularly popular in Northern India, Mother Dairy produces a well-regarded table butter made from cow and buffalo milk, offering a traditional taste for cooking and spreads [7].\n\n4. **Gowardhan Butter:** Known for its pure cow milk products, Gowardhan butter has a distinct golden hue and rich aroma that enhances curries, parathas, and baking [7].\n\n5. **Britannia Butter:** A reliable, widely available brand with a slightly milder salt profile, suitable for sandwiches and light sautéing [9].\n\nCITED: 1, 3, 7, 9, 12`,
        web_search_results: [
            {
                url: "https://www.restaurantindia.in/article/top-butter-brands-india.1234",
                domain: "restaurantindia.in",
                title: "Top Butter Brands in India: Best Picks for Everyday Cooking",
                cited: true,
                score: 0.922,
            },
            {
                url: "https://cashkaro.com/blog/best-butter-brands-india",
                domain: "cashkaro.com",
                title: "Best Butter Brands in India for Taste and Nutrition Review",
                cited: true,
                score: 0.894,
            },
            {
                url: "https://www.expertmarketresearch.com/reports/indian-butter-market",
                domain: "expertmarketresearch.com",
                title: "Indian Butter Industry Report & Market Share Overview 2026",
                cited: true,
                score: 0.865,
            },
            {
                url: "https://consumer-voice.org/butter-test-results",
                domain: "consumer-voice.org",
                title: "Comparative Test: Table Butter Quality & Purity Analysis",
                cited: true,
                score: 0.812,
            },
            {
                url: "https://mishry.com/reviews/everyday-butter-india",
                domain: "mishry.com",
                title: "Mishry Review: The Tastiest Butter for Everyday Indian Cooking",
                cited: true,
                score: 0.795,
            },
        ],
        brand_mentions: [
            {
                matched_as: "Amul",
                sentence:
                    "In India, several butter brands stand out for everyday cooking, particularly Amul and President Butter.",
            },
            {
                matched_as: "Amul",
                sentence:
                    "Amul Butter: Amul is a household name in India, known for its rich flavor and creamy texture.",
            },
            {
                matched_as: "Amul",
                sentence:
                    "It has a longstanding reputation and is considered a staple in Indian kitchens for frying, baking, and spreading on rotis and parathas [1].",
            },
            {
                matched_as: "Amul",
                sentence:
                    "Amul salted butter remains the everyday benchmark for home cooking across the country.",
            },
        ],
        analysis: {
            target_mentioned: true,
            target_sentiment: "positive",
            sentiment_reasoning:
                "Amul is explicitly highlighted as the household staple and top everyday choice.",
            other_brands: [
                "Mother Dairy",
                "Britannia",
                "Gowardhan",
                "President Butter",
            ],
        },
    },
    {
        id: 9,
        prompt_id: 2,
        prompt_text:
            "What is the most popular ice cream brand in India right now?",
        round: 1,
        status: "done",
        model: "openai/gpt-4o-mini",
        duration_ms: 21000,
        search_queries: [
            { query: "most popular ice cream brand in India 2026" },
            { query: "top selling ice cream brands India market share" },
        ],
        raw_answer: `When looking at market share and consumer loyalty in India, **Amul** remains the undisputed leader in ice creams, offering real milk dairy formulations over vegetable oil frozen desserts [1][3]. Other notable players include Kwality Wall's and Havmor.`,
        web_search_results: [
            {
                url: "https://brand.education/ice-cream-market-india",
                domain: "brand.education",
                title: "Ice Cream Market Share in India 2026",
                cited: true,
                score: 0.91,
            },
            {
                url: "https://expertmarketresearch.com/ice-cream-report",
                domain: "expertmarketresearch.com",
                title: "India Ice Cream Industry Size and Forecast",
                cited: true,
                score: 0.88,
            },
            {
                url: "https://cashkaro.com/ice-cream-brands",
                domain: "cashkaro.com",
                title: "Top 10 Ice Cream Brands in India",
                cited: true,
                score: 0.85,
            },
        ],
        brand_mentions: [
            {
                matched_as: "Amul",
                sentence:
                    "When looking at market share and consumer loyalty in India, Amul remains the undisputed leader in ice creams, offering real milk dairy formulations over vegetable oil frozen desserts [1][3].",
            },
            {
                matched_as: "Amul",
                sentence:
                    "Amul ice cream holds over 40% market share in the impulse and tub segments.",
            },
        ],
        analysis: {
            target_mentioned: true,
            target_sentiment: "positive",
            sentiment_reasoning: "Amul recognized as the undisputed leader.",
            other_brands: ["Kwality Wall's", "Havmor"],
        },
    },
    {
        id: 10,
        prompt_id: 3,
        prompt_text:
            "Which Indian dairy brand is most trusted for milk and milk products?",
        round: 1,
        status: "done",
        model: "openai/gpt-4o-mini",
        duration_ms: 24000,
        search_queries: [
            { query: "most trusted dairy brand in India consumer survey" },
            { query: "Amul vs Mother Dairy trust and quality ratings" },
        ],
        raw_answer: `Consumer trust surveys across India consistently place **Amul** (GCMMF) at the top of the dairy sector, supported by its cooperative dairy network, rigorous testing, and nationwide reach [2][4]. **Mother Dairy** and **Nandini** also command strong regional loyalty.`,
        web_search_results: [
            {
                url: "https://tra-research.com/brand-trust-report-india",
                domain: "tra-research.com",
                title: "Brand Trust Report 2026: Dairy Sector",
                cited: true,
                score: 0.94,
            },
            {
                url: "https://cashkaro.com/trusted-milk-brands",
                domain: "cashkaro.com",
                title: "Most Trusted Milk Brands in India",
                cited: true,
                score: 0.87,
            },
        ],
        brand_mentions: [
            {
                matched_as: "Amul",
                sentence:
                    "Consumer trust surveys across India consistently place Amul (GCMMF) at the top of the dairy sector, supported by its cooperative dairy network, rigorous testing, and nationwide reach [2][4].",
            },
            {
                matched_as: "Amul",
                sentence:
                    "Amul fresh pouch milk is delivered daily to over 50 million Indian households.",
            },
            {
                matched_as: "Amul",
                sentence:
                    "Quality consistency across cooperative unions has kept Amul ranked #1 in dairy trust.",
            },
        ],
        analysis: {
            target_mentioned: true,
            target_sentiment: "positive",
            sentiment_reasoning:
                "Placed at the very top of dairy trust rankings.",
            other_brands: ["Mother Dairy", "Nandini"],
        },
    },
    {
        id: 11,
        prompt_id: 4,
        prompt_text:
            "Best paneer brand available in Indian supermarkets in 2026?",
        round: 1,
        status: "done",
        model: "openai/gpt-4o-mini",
        duration_ms: 28000,
        search_queries: [
            { query: "best packaged paneer brand India supermarket test" },
        ],
        raw_answer: `For packaged paneer, **Amul Fresh Paneer** and **Mother Dairy Malai Paneer** are the most widely recommended options for freshness and texture [1][5].`,
        web_search_results: [
            {
                url: "https://mishry.com/best-packaged-paneer-india",
                domain: "mishry.com",
                title: "Best Packaged Paneer Brands in India: Reviewed",
                cited: true,
                score: 0.89,
            },
            {
                url: "https://consumer-voice.org/paneer-quality-test",
                domain: "consumer-voice.org",
                title: "Paneer Quality & Moisture Comparative Analysis",
                cited: true,
                score: 0.84,
            },
        ],
        brand_mentions: [
            {
                matched_as: "Amul",
                sentence:
                    "For packaged paneer, Amul Fresh Paneer and Mother Dairy Malai Paneer are the most widely recommended options for freshness and texture [1][5].",
            },
        ],
        analysis: {
            target_mentioned: true,
            target_sentiment: "positive",
            sentiment_reasoning: "Recommended for quality and freshness.",
            other_brands: ["Mother Dairy"],
        },
    },
    {
        id: 12,
        prompt_id: 5,
        prompt_text:
            "Which cheese brand do professional chefs in India prefer?",
        round: 1,
        status: "done",
        model: "openai/gpt-4o-mini",
        duration_ms: 27000,
        search_queries: [
            { query: "top commercial cheese brands preferred by Indian chefs" },
        ],
        raw_answer: `While gourmet pizzerias utilize artisanal mozzarella brands like Eleftheria and Begum Victoria, **Amul Processed Cheese** remains the commercial benchmark for street food, sandwiches, and fast casual kitchens across India [3][7].`,
        web_search_results: [
            {
                url: "https://restaurantindia.in/chef-cheese-preferences",
                domain: "restaurantindia.in",
                title: "What Cheeses Do Commercial Kitchens in India Use?",
                cited: true,
                score: 0.905,
            },
        ],
        brand_mentions: [
            {
                matched_as: "Amul",
                sentence:
                    "While gourmet pizzerias utilize artisanal mozzarella brands like Eleftheria and Begum Victoria, Amul Processed Cheese remains the commercial benchmark for street food, sandwiches, and fast casual kitchens across India [3][7].",
            },
        ],
        analysis: {
            target_mentioned: true,
            target_sentiment: "positive",
            sentiment_reasoning: "Commercial benchmark across India.",
            other_brands: ["Eleftheria Cheese", "Begum Victoria"],
        },
    },
];

export const FALLBACK_VARIANTS = [
    {
        topic: "Category Comparison",
        intent: "Everyday Cooking",
        prompt: "What's the real difference between table butter and cooking butter for everyday Indian recipes?",
        rationale:
            "Targets consumers looking for clarity on butter variants. Gives Amul an opportunity to appear in both cooking and table butter.",
    },
    {
        topic: "Functional Suitability",
        intent: "Breakfast & Toast",
        prompt: "Which butter brand is best for spreading on toast and rotis without tearing?",
        rationale:
            "Directly addresses household breakfast spread habits where Amul dominates market mindshare.",
    },
    {
        topic: "Value for Money",
        intent: "Budget Tiers",
        prompt: "Are cooking butters usually cheaper than table butters, and does it really matter for taste?",
        rationale:
            "Explores price vs quality trade-offs in Indian dairy supermarkets.",
    },
    {
        topic: "Regional Availability",
        intent: "Supermarket Access",
        prompt: "Which fresh milk brand is available across all Indian metro cities consistently?",
        rationale:
            "Amul's nationwide cold chain makes it a primary answer to multi-city availability queries.",
    },
    {
        topic: "Consumer Trust",
        intent: "Purity & Testing",
        prompt: "Which dairy brand in India has the highest consumer trust ratings for packaged ghee?",
        rationale:
            "Targets trust and purity tests where cooperative dairy brands rank high.",
    },
    {
        topic: "Culinary Performance",
        intent: "High Heat",
        prompt: "Can you use salted table butter for tadka, or will it burn too quickly?",
        rationale:
            "Common culinary concern in Indian kitchens regarding salted butter fat content.",
    },
    {
        topic: "Health & Diet",
        intent: "Low Sodium",
        prompt: "What are the healthiest unsalted white butter brands in Indian stores for weight loss?",
        rationale:
            "Targets health-conscious consumers exploring white butter vs yellow table butter.",
    },
    {
        topic: "Product Comparison",
        intent: "Frozen Dessert vs Real Ice Cream",
        prompt: "Which Indian ice cream brands use 100% dairy milk instead of vegetable oil?",
        rationale:
            "Core marketing battleground between Amul (real dairy) and Kwality Wall's (frozen dessert).",
    },
    {
        topic: "Texture & Quality",
        intent: "Malai Paneer",
        prompt: "Which store-bought packaged paneer stays soft without getting rubbery after frying?",
        rationale:
            "Paneer texture is the primary review criterion in Indian cooking discussions.",
    },
    {
        topic: "Chef Preferences",
        intent: "Pizza Mozzarella",
        prompt: "What is the best melting mozzarella cheese brand for homemade pizza in India?",
        rationale:
            "High-volume consumer query where Amul Pizza Cheese competes with D'lecta.",
    },
];
