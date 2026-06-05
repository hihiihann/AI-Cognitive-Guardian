// AI Cognitive Guardian v3 — Background Service Worker
// Uses Groq API with auto model fallback

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
// Model priority: try each in order, skip if rate limited
const GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama3-8b-8192",
  "gemma2-9b-it",
];

const questionCache = new Map();
const CACHE_MAX = 50;

async function getApiKey() {
  const r = await chrome.storage.local.get(["acg_api_key"]);
  return r.acg_api_key || null;
}

async function callClaude(systemPrompt, userMessage, maxTokens = 600) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  let lastError = "NO_MODEL_AVAILABLE";
  for (const model of GROQ_MODELS) {
    const res = await fetch(GROQ_API, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage  },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }

    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || ("API_ERROR_" + res.status);
    lastError = msg;

    // Only retry next model if rate-limited; other errors (401 invalid key) throw immediately
    const isRateLimit = msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("tpd") || msg.toLowerCase().includes("tokens per day");
    if (!isRateLimit) throw new Error(msg);
  }
  throw new Error(lastError);
}

function parseJSON(text) {
  if (!text) return null;
  // Step 1: strip markdown code fences
  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Step 2: try direct parse first
  try { return JSON.parse(clean); } catch {}

  // Step 3: extract first {...} block (handles extra text before/after)
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}

    // Step 4: fix trailing commas (common small-model mistake)
    const fixed = match[0]
      .replace(/,\s*([}\]])/g, "$1")   // trailing comma before } or ]
      .replace(/,\s*,/g, ",");         // double commas
    try { return JSON.parse(fixed); } catch {}
  }

  // Step 5: if JSON is truncated mid-string, try to recover by closing open structures
  if (match) {
    let s = match[0];
    // Count unclosed brackets/braces
    let braces = 0, brackets = 0, inString = false, escape = false;
    for (const ch of s) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (!inString) {
        if (ch === "{") braces++;
        if (ch === "}") braces--;
        if (ch === "[") brackets++;
        if (ch === "]") brackets--;
      }
    }
    // Close any open string, brackets, braces
    if (inString) s += '"';
    while (brackets > 0) { s += "]"; brackets--; }
    while (braces > 0)   { s += "}"; braces--; }
    try { return JSON.parse(s); } catch {}
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// HANDLER 1: Generate Prerequisite Framework + Questions
// ══════════════════════════════════════════════════════════════════════════

async function handleGenerateFramework(prompt, bloomLevel) {
  const cacheKey = "fw4::" + bloomLevel + "::" + prompt.slice(0, 80).toLowerCase().trim();
  if (questionCache.has(cacheKey)) return questionCache.get(cacheKey);

  const levelName = ["","Mới bắt đầu","Cơ bản","Trung cấp","Nâng cao","Chuyên sâu","Chuyên gia"][bloomLevel] || "Mới bắt đầu";
  const isVi = /[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/.test(prompt)
    || /\b(là|gì|của|được|trong|có|và|cho|với|không)\b/.test(prompt);
  const lang = isVi ? "Vietnamese" : "English";

  // Extract the core topic for bridging (strip question words)
  const topicCore = prompt
    .replace(/\b(là\s+\S+(\s+\S+)?\s+)?gì\b/gi, "")
    .replace(/\blà gì\b/gi, "")
    .replace(/\bnhư thế nào\b/gi, "")
    .replace(/\bra sao\b/gi, "")
    .replace(/\?/g, "")
    .trim();

  const systemPrompt = `You are an educational scaffolding AI for ACG (AI Cognitive Guardian).
Language: write EVERYTHING in ${lang} only. No mixing languages.
User knowledge level: ${bloomLevel}/6 (${levelName}).

Your task: Given the user's original question, generate a prerequisite scaffold + 3 bridge questions.

═══ SCAFFOLD (4 bullets) ═══
Generate EXACTLY 4 bullets about the PREREQUISITE concept (one step simpler than the user's question).
Each bullet = 1 complete, informative sentence (15-25 words). NO generic templates.

Structure:
1. HOOK — Connect to something the user ALREADY KNOWS from daily life. Must have a VERB.
   Pattern: "Bạn đã từng [VERB cụ thể] [noun cụ thể]...? Đó chính là ý tưởng gốc của [prerequisite]."
   Example for "lãi suất": "Bạn đã từng gửi tiền tiết kiệm và nhận tiền lãi từ ngân hàng chưa? Đó chính là lãi suất trong thực tế."

2. CONTRAST — The most important confusion to prevent. "[A] ≠ [B]: why they differ."
   Bold COMPLETE compound terms: <strong>tỷ suất lợi nhuận</strong> NOT <strong>tỷ</strong> suất
   Example: "<strong>Lãi suất đơn</strong> ≠ <strong>lãi suất kép</strong>: lãi đơn tính trên vốn gốc, lãi kép tính cả lãi tích lũy."

3. CONDITION — When to use / when NOT to use (must be factually correct, no invented constraints).
   Example: "Chỉ dùng <strong>lãi suất</strong> khi tài sản sinh lợi theo thời gian; không áp dụng với tài sản không sinh lời như vàng."

4. BRIDGE — Explicitly connect prerequisite → user's original topic. Name BOTH.
   Pattern: "Vì vậy hiểu [prerequisite] giúp bạn hiểu [original topic] vì [specific reason]."
   Example (prereq=lãi suất, topic=ROI): "Vì vậy hiểu lãi suất giúp bạn hiểu ROI vì ROI thực chất là tỷ suất sinh lời tổng quát của bất kỳ khoản đầu tư nào."

═══ QUESTIONS (3 questions) ═══
Each question MUST:
- Mention at least one term from the PREREQUISITE
- Mention at least one term from the ORIGINAL TOPIC: "${topicCore}"
- NOT directly ask "what is [topic]?" (that's the user's question, not yours)
- Match Bloom level ${bloomLevel}

Level ${bloomLevel} question style:
${bloomLevel <= 2 ? "Simple recall/understanding. 'Dựa vào [prereq], theo bạn [topic] có liên quan đến điều gì?'" : ""}
${bloomLevel === 3 ? "Apply: 'Dùng [prereq], bạn có thể tính/ước tính [topic] trong tình huống nào?'" : ""}
${bloomLevel >= 4 ? "Analyze/Evaluate/Create: 'So sánh [prereq] với [topic]... Khi nào... Thiết kế...'" : ""}

═══ OUTPUT FORMAT ═══
Respond with ONLY valid JSON, no other text:
{
  "prerequisiteTopic": "2-4 word name of the prerequisite concept",
  "scaffold": [
    "Specific HOOK sentence mentioning <strong>prereq term</strong>",
    "Specific CONTRAST sentence with <strong>Term A</strong> ≠ <strong>Term B</strong>",
    "Specific CONDITION sentence with <strong>prereq term</strong>",
    "Specific BRIDGE sentence naming both prereq AND original topic"
  ],
  "questions": [
    "Q1 mentioning prereq + original topic",
    "Q2 mentioning prereq + original topic from different angle",
    "Q3 deeper question mentioning prereq + original topic"
  ],
  "hint": "1 warm encouraging sentence under 12 words",
  "targetBloomLevel": ${bloomLevel}
}`;

  const raw = await callClaude(systemPrompt,
    `User's original question: "${prompt}"\nCore topic to bridge to: "${topicCore}"\nPrerequisite concept should be one step simpler than "${topicCore}".`,
    700);

  const parsed = parseJSON(raw);
  if (!parsed?.scaffold?.length || !parsed?.questions?.length) throw new Error("PARSE_ERROR");

  if (questionCache.size >= CACHE_MAX) questionCache.delete(questionCache.keys().next().value);
  questionCache.set(cacheKey, parsed);
  return parsed;
}

// ══════════════════════════════════════════════════════════════════════════
// HANDLER 2: Evaluate user answer — 6-level Bloom
// ══════════════════════════════════════════════════════════════════════════

async function handleEvaluateAnswer(prompt, userAnswer, prerequisiteTopic, questions) {
  const systemPrompt = `You are evaluating a user's answer using Bloom's Taxonomy (6 levels).
Be GENEROUS — most users are learners, not experts. Reward thinking, not precision.

RUBRIC (assign HIGHEST level demonstrated):
1 — REMEMBER: mentions any relevant keyword or rough definition
2 — UNDERSTAND: explains in own words, gives analogy, or distinguishes from something similar
3 — APPLY: gives a concrete example or real scenario, even hypothetical
4 — ANALYZE: compares two things, finds a pattern, identifies a limitation or condition
5 — EVALUATE: makes a judgment with reasoning, critiques an approach
6 — CREATE: proposes something new, designs a solution, combines concepts originally

Calibration:
- 8+ words with explanation = Level 2 minimum
- Any concrete example = Level 3 minimum
- Don't penalize imprecision — reward effort

Respond ONLY with valid JSON:
{
  "detectedBloomLevel": 1-6,
  "bloomName": "REMEMBER|UNDERSTAND|APPLY|ANALYZE|EVALUATE|CREATE",
  "signals": ["key signal found"],
  "hint": "warm 1-sentence tip pushing one level higher",
  "nextLevelQuestion": "easy natural follow-up for next level",
  "strength": "short encouraging note on what they did well"
}
Respond in same language as user's answer.`;

  const raw = await callClaude(systemPrompt,
    `Question: "${prompt}"\nPrerequisite: "${prerequisiteTopic || ""}"\nUser's answer: "${userAnswer}"`,
    350);
  const parsed = parseJSON(raw);
  if (!parsed?.detectedBloomLevel) throw new Error("PARSE_ERROR");
  return parsed;
}

// ══════════════════════════════════════════════════════════════════════════
// HANDLER 3: Essay mode questions
// ══════════════════════════════════════════════════════════════════════════

async function handleGenerateEssayQuestions(prompt) {
  const cacheKey = "essay4::" + prompt.slice(0, 80).toLowerCase().trim();
  if (questionCache.has(cacheKey)) return questionCache.get(cacheKey);

  const raw = await callClaude(
    `Generate 3 specific questions to extract the user's OWN ideas before AI writes for them.
Questions should be warm, specific to the topic, and help surface personal perspectives/memories.
Respond ONLY with valid JSON: {"questions":["q1","q2","q3"],"hint":"short tip"}
Match the language of the user's prompt.`,
    `Writing prompt: "${prompt}"`,
    300);

  const parsed = parseJSON(raw);
  if (!parsed?.questions?.length) throw new Error("PARSE_ERROR");
  if (questionCache.size >= CACHE_MAX) questionCache.delete(questionCache.keys().next().value);
  questionCache.set(cacheKey, parsed);
  return parsed;
}

// ══════════════════════════════════════════════════════════════════════════
// MESSAGE LISTENER
// ══════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === "GENERATE_FRAMEWORK") {
    handleGenerateFramework(msg.prompt, msg.bloomLevel || 1)
      .then(r => sendResponse({ ok: true, data: r }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "EVALUATE_ANSWER") {
    handleEvaluateAnswer(msg.prompt, msg.userAnswer, msg.prerequisiteTopic, msg.questions)
      .then(r => sendResponse({ ok: true, data: r }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "GENERATE_ESSAY_QUESTIONS") {
    handleGenerateEssayQuestions(msg.prompt)
      .then(r => sendResponse({ ok: true, data: r }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "SAVE_API_KEY") {
    chrome.storage.local.set({ acg_api_key: msg.key })
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "TEST_API") {
    callClaude("You are a test.", "Reply with exactly this JSON: {\"ok\":true}", 20)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "CHECK_API_KEY") {
    getApiKey()
      .then(key => sendResponse({ ok: true, hasKey: !!key }))
      .catch(() => sendResponse({ ok: false, hasKey: false }));
    return true;
  }
});
