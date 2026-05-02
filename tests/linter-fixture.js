// Prompt Master — Linter fixture
// Run with: node tests/linter-fixture.js
// Pure copy of lintPrompt, COMPONENTS, and HEURISTICS from content/content.js.
// No DOM or Chrome API dependencies.

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';

// ----------------------------------------------------------------
// Linter — copied verbatim from content/content.js
// ----------------------------------------------------------------
const COMPONENTS = [
    { key: 'role',       label: 'Persona / Role', weight: 15 },
    { key: 'context',    label: 'Context',        weight: 25 },
    { key: 'task',       label: 'Task',           weight: 40 },
    { key: 'constraint', label: 'Constraint',     weight: 12 },
    { key: 'format',     label: 'Output Format',  weight:  8 },
];

const HEURISTICS = {
    role: {
        patterns: [
            /\bact\s+as\b/i,
            /\bas\s+an?\s+\w+/i,
            /\byou\s+are\s+an?\b/i,
            /\bpretend\s+(to\s+be|you\s+are)\b/i,
            /\bimagine\s+you\s+are\b/i,
            /\bfrom\s+the\s+perspective\s+of\b/i,
            /\bin\s+the\s+role\s+of\b/i,
            /\btake\s+the\s+role\b/i,
        ],
    },
    context: {
        patterns: [
            /\b(background|context|situation|scenario)\b/i,
            /\bworking\s+on\b/i,
            /\bi\s+(am|work|have|currently)\b/i,
            /\b(our|my)\s+(team|company|project|product|app|codebase)\b/i,
            /\bgiven\s+that\b/i,
            /\bthe\s+(project|company|team|app|product|codebase)\b/i,
            /\bat\s+[A-Z]/,
        ],
    },
    task: {
        patterns: [
            /\b(write|create|generate|explain|summarize|list|build|make|fix|refactor|update|add|remove|implement|review|debug|convert|analyze|design|draft|compare|translate|describe|outline|suggest|find|show|give)\b/i,
        ],
    },
    constraint: {
        patterns: [
            /\b(don'?t|do\s+not|avoid|without|never)\b/i,
            /\b(only|must|limit|restrict|no\s+more\s+than)\b/i,
            /\bkeep\s+it\s+(brief|short|concise)\b/i,
            /\bbe\s+(brief|concise|succinct)\b/i,
            /\b(under|max|maximum|at\s+most|no\s+more\s+than)\s+\d+\s*(words?|lines?|chars?|characters?)\b/i,
            /\bconcise\b/i,
        ],
    },
    format: {
        patterns: [
            /\bbullet\s*points?\b/i,
            /\bnumbered\s+list\b/i,
            /\bstep[\s-]by[\s-]step\b/i,
            /\bin\s+a?\s*(table|list|json|markdown)\b/i,
            /\b(respond|reply|output|format|return)\s+(in|as|using|with)\b/i,
            /\b(heading|markdown|json|plain\s+text)\b/i,
        ],
    },
};

function lintPrompt(text) {
    const first15 = text.trim().split(/\s+/).slice(0, 15).join(' ');
    const detected = {};

    for (const [key, { patterns }] of Object.entries(HEURISTICS)) {
        const haystack = key === 'task' ? first15 : text;
        detected[key] = patterns.some(p => p.test(haystack));
    }

    const missing = COMPONENTS.filter(c => !detected[c.key]);
    const score   = 100 - missing.reduce((sum, c) => sum + c.weight, 0);

    return { score, detected };
}

// ----------------------------------------------------------------
// Test cases
// ----------------------------------------------------------------
// Each case specifies:
//   minScore / maxScore   — expected score range (inclusive)
//   detected              — expected component flags (optional per key)
// ----------------------------------------------------------------
const tests = [
    // --- Strong prompts (score ≥ 80, all 5 components) ---
    {
        label: 'strong — all 5 components',
        input: 'Summarize this article. You are a professional writer. I have been working on a newsletter for our team. Keep it under 50 words. Respond in plain text.',
        minScore: 80,
        detected: { role: true, context: true, task: true, constraint: true, format: true },
    },
    {
        label: 'strong — sales email with all components',
        input: 'Write a cold email. Act as a sales expert. Our company sells B2B SaaS tools. Avoid clichés and keep it under 150 words. Format as a numbered list of subject line options.',
        minScore: 80,
        detected: { role: true, context: true, task: true, constraint: true, format: true },
    },
    {
        label: 'strong — debugging task with all components',
        input: 'Debug this Python function. Pretend you are a Python expert. I am working on a data pipeline that processes CSV files. Do not use external libraries. Return the fixed code in markdown.',
        minScore: 80,
        detected: { role: true, context: true, task: true, constraint: true, format: true },
    },

    // --- Bare prompts (score ≤ 30, missing most components) ---
    {
        label: 'bare — question with no structure',
        input: 'What is machine learning?',
        maxScore: 30,
        detected: { role: false, context: false, task: false, constraint: false, format: false },
    },
    {
        label: 'bare — comparison fragment',
        input: 'Python versus JavaScript',
        maxScore: 30,
        detected: { role: false, context: false, task: false, constraint: false, format: false },
    },
    {
        label: 'bare — vague noun phrase',
        input: 'The history of artificial intelligence',
        maxScore: 30,
        detected: { role: false, context: false, task: false, constraint: false, format: false },
    },

    // --- Mixed prompts (score 40–70, partial structure) ---
    {
        label: 'mixed — task only',
        input: 'Explain how neural networks work.',
        minScore: 40, maxScore: 70,
        detected: { task: true, role: false, context: false, constraint: false, format: false },
    },
    {
        label: 'mixed — task + context',
        input: 'I am building a mobile app and facing issues with authentication. Suggest some solutions.',
        minScore: 40, maxScore: 70,
        detected: { task: true, context: true, role: false, constraint: false, format: false },
    },
    {
        label: 'mixed — task + role, no context or constraints',
        input: 'Act as a chef. Give me a simple pasta recipe.',
        minScore: 40, maxScore: 70,
        detected: { task: true, role: true, context: false, constraint: false, format: false },
    },
    {
        label: 'mixed — task + format, no role or context',
        input: 'List the top programming languages used in 2024. Use a numbered list.',
        minScore: 40, maxScore: 70,
        detected: { task: true, format: true, role: false, context: false, constraint: false },
    },
];

// ----------------------------------------------------------------
// Runner
// ----------------------------------------------------------------
let passed = 0;
let failed = 0;

for (const tc of tests) {
    const { score, detected } = lintPrompt(tc.input);
    const failures = [];

    if (tc.minScore !== undefined && score < tc.minScore)
        failures.push(`score ${score} < minScore ${tc.minScore}`);
    if (tc.maxScore !== undefined && score > tc.maxScore)
        failures.push(`score ${score} > maxScore ${tc.maxScore}`);

    if (tc.detected) {
        for (const [key, expected] of Object.entries(tc.detected)) {
            if (detected[key] !== expected)
                failures.push(`${key}: expected ${expected}, got ${detected[key]}`);
        }
    }

    if (failures.length === 0) {
        console.log(`${GREEN}PASS${RESET} ${DIM}[score: ${score}]${RESET} ${tc.label}`);
        passed++;
    } else {
        console.log(`${RED}FAIL${RESET} ${DIM}[score: ${score}]${RESET} ${tc.label}`);
        for (const f of failures) console.log(`     ${YELLOW}↳ ${f}${RESET}`);
        failed++;
    }
}

console.log(`\n${passed + failed} tests — ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : DIM}${failed} failed${RESET}`);
if (failed > 0) process.exit(1);
