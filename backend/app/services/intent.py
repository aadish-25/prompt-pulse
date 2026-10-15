"""
PromptPulse GEO Intent Classification Service.

Categorizes user prompts into the 5 core Generative Engine Optimization (GEO) intent buckets:
1. 'core_need'    - Foundational problem resolution & educational queries
2. 'criteria'     - Feature matrix, pricing tiers, compliance & capability constraints
3. 'competitor'   - Comparison, versus, and alternative queries
4. 'persona'      - Role-specific, industry-tailored, and team-size queries
5. 'transaction'  - High-intent commercial actions, implementation, and pricing evaluation
"""
import re
from pydantic import BaseModel


class IntentClassification(BaseModel):
    intent: str  # core_need | criteria | competitor | persona | transaction
    display_name: str
    confidence: float
    description: str
    signals_detected: list[str]


# Keyword and regex signals for instant deterministic classification
INTENT_PATTERNS = {
    "competitor": {
        "display_name": "Competitor / Alternative",
        "description": "Comparative evaluation against rival solutions",
        "patterns": [
            r"\bvs\b", r"\bversus\b", r"\balternative(s)?\b", r"\bcompare(d)?\b",
            r"\bcomparison\b", r"\bor\b", r"\blike\b", r"\breplacement\b", r"\bswitch(ing)? from\b"
        ],
        "weight": 1.5,
    },
    "transaction": {
        "display_name": "Commercial / Transactional",
        "description": "High-intent purchasing, trial signup, or pricing inquiries",
        "patterns": [
            r"\bprice\b", r"\bpricing\b", r"\bcost\b", r"\bbuy\b", r"\bdeal\b",
            r"\bdiscount\b", r"\bcoupon\b", r"\bfree trial\b", r"\bquote\b",
            r"\bexpensive\b", r"\bcheap\b", r"\baffordable\b", r"\bdemo\b", r"\bsubscription\b"
        ],
        "weight": 1.4,
    },
    "persona": {
        "display_name": "Persona / Vertical",
        "description": "Targeted by industry, team size, or professional role",
        "patterns": [
            r"\bfor\s+([a-z\-]+\s+)?(startups?|enterprise(s)?|developers?|small business|freelancers?|founders?|agencies?|healthcare|b2b|b2c|engineers?|marketers?)\b",
            r"\b(founders?|startups?|developers?|freelancers?|engineers?|marketers?|solo\s+founders?)\b",
            r"\b(enterprise|small business|smb|pre-seed|early-stage)\b"
        ],
        "weight": 1.4,
    },
    "criteria": {
        "display_name": "Criteria / Attribute Matrix",
        "description": "Technical specs, integrations, compliance, and benchmarks",
        "patterns": [
            r"\bbest\b", r"\btop\b", r"\bfeatures?\b", r"\bintegrat(ion|es)\b",
            r"\bapi\b", r"\bcompliance\b", r"\bsoc-?2\b", r"\bgdpr\b", r"\bhipaa\b",
            r"\bfastest\b", r"\bopen source\b", r"\bself-hosted\b", r"\bsecurity\b",
            r"\breviews?\b", r"\brated\b"
        ],
        "weight": 1.1,
    },
    "core_need": {
        "display_name": "Core Need / Problem Solving",
        "description": "Foundational 'how to' or category discovery inquiry",
        "patterns": [
            r"\bhow to\b", r"\bwhat is\b", r"\bway to\b", r"\bguide\b",
            r"\bhelp\b", r"\bsolve\b", r"\bworkflow\b", r"\bautomate\b", r"\btool(s)?\b",
            r"\bsoftware\b", r"\bplatform\b", r"\bsolution\b"
        ],
        "weight": 1.0,
    },
}


def classify_prompt_intent(prompt_text: str) -> IntentClassification:
    text_lower = prompt_text.lower().strip()
    scores: dict[str, float] = {}
    signals: dict[str, list[str]] = {}

    for intent, config in INTENT_PATTERNS.items():
        matched_signals = []
        for pattern in config["patterns"]:
            if re.search(pattern, text_lower):
                matched_signals.append(pattern.replace(r"\b", "").replace("?", ""))
        signals[intent] = matched_signals
        scores[intent] = len(matched_signals) * config["weight"]

    # Pick highest scoring intent
    best_intent = max(scores.keys(), key=lambda k: scores[k])
    best_score = scores[best_intent]

    # If no explicit signals matched, default to core_need with base confidence
    if best_score <= 0.0:
        best_intent = "core_need"
        confidence = 0.50
        detected = ["general inquiry"]
    else:
        confidence = min(0.95, round(0.60 + (best_score * 0.15), 2))
        detected = signals[best_intent]

    cfg = INTENT_PATTERNS[best_intent]
    return IntentClassification(
        intent=best_intent,
        display_name=cfg["display_name"],
        confidence=confidence,
        description=cfg["description"],
        signals_detected=detected,
    )
