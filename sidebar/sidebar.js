// Prompt Master — Sidebar JS
// Receives prompt text from content script, runs linting, updates UI.

// ----------------------------------------------------------------
// 5-part component definitions
// ----------------------------------------------------------------
const COMPONENTS = [
    { key: 'role',       label: 'Persona / Role'  , weight: 15},
    { key: 'context',    label: 'Context'         , weight: 23},
    { key: 'task',       label: 'Task'            , weight: 40},
    { key: 'constraint', label: 'Constraint'      , weight: 15},
    { key: 'format',     label: 'Output Format'   , weight: 7},
];

// ----------------------------------------------------------------
// Linter — scores a prompt text against the 5 components
// Returns { score: Number, missing: String[] }
// ----------------------------------------------------------------
const HEURISTICS = {
    role: {
        keywords: ['act as', 'you are', 'as a', 'pretend to be', 'imagine you', 'take the role', 'your role is', 'persona', 'character', 'role', 'from the perspective of'],
        pattern:  null,
    },
    context: {
        keywords: ['background', 'context', 'currently', 'current', 'we have', 'i have', 'our', 'the project', 'given that', 'situation'],
        pattern:  null,
    },
    task: {
        keywords: ['write', 'create', 'generate', 'explain', 'summarize', 'list', 'build', 'help me', 'i need', 'please', 'make', 'fix', 'refactor', 'update', 'add', 'remove', 'implement', 'review', 'debug', 'convert', 'analyze', 'design'],
        pattern:  null,
    },
    constraint: {
        keywords: ['don\'t', 'do not', 'avoid', 'only', 'must', 'limit', 'no more than', 'keep it', 'without', 'never'],
        pattern:  /\b(under|max|maximum|at most|no more than)\s+\d+\s*(words?|lines?|chars?|characters?)\b/i,
    },
    format: {
        keywords: ['bullet', 'numbered', 'table', 'json', 'markdown', 'plain text', 'paragraph', 'heading', 'list', 'step by step', 'in a'],
        pattern:  /\b(respond|reply|output|format|return|give me)\s+(in|as|using|with)\b/i,
    },
};

function lintPrompt(text) {
    const lower = text.toLowerCase();
    const detected = {};

    for (const [key, { keywords, pattern }] of Object.entries(HEURISTICS)) {
        detected[key] = keywords.some(kw => lower.includes(kw))
                     || (pattern ? pattern.test(text) : false);
    }

    const missing = COMPONENTS.filter(c => !detected[c.key]);
    const missingLabels = missing.map(c => c.label);
    const score   = 100 - missing.reduce((sum, c) => sum + c.weight, 0);

    return { score, missingLabels };
}

// --- DEV FIXTURE (remove before release) ---
console.log('TICK-003 fixture:');
console.log(lintPrompt("Act as a senior developer. Given our legacy codebase, refactor the auth module. Keep changes under 200 lines. Return a markdown summary."));
console.log(lintPrompt("fix my bug"));
// -------------------------------------------

// ----------------------------------------------------------------
// Render
// ----------------------------------------------------------------
function renderScore({ score, missingLabels }) {
    document.getElementById('pm-score-value').textContent = score;

    const list = document.getElementById('pm-components');
    list.innerHTML = COMPONENTS.map(c => {
        const present = !missingLabels.includes(c.label);
        return `<li class="${present ? 'present' : 'missing'}">${c.label}</li>`;
    }).join('');
}

// ----------------------------------------------------------------
// Message listener — content script sends prompt text here
// ----------------------------------------------------------------
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PROMPT_UPDATE') {
        renderScore(lintPrompt(message.text));
    }
});
