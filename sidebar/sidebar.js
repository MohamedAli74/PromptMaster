// Prompt Master — Sidebar JS
// Receives prompt text from content script, runs linting, updates UI.

// ----------------------------------------------------------------
// 5-part component definitions
// ----------------------------------------------------------------
const COMPONENTS = [
    { key: 'role',       label: 'Persona / Role' },
    { key: 'context',    label: 'Context' },
    { key: 'task',       label: 'Task' },
    { key: 'constraint', label: 'Constraint' },
    { key: 'format',     label: 'Output Format' },
];

// ----------------------------------------------------------------
// Linter — scores a prompt text against the 5 components
// Returns { score: Number, missing: String[] }
// ----------------------------------------------------------------
function lintPrompt(text) {
    // TODO: implement heuristic / window.ai based detection per component
    const detected = {
        role:       false,
        context:    false,
        task:       false,
        constraint: false,
        format:     false,
    };

    const missing = COMPONENTS.filter(c => !detected[c.key]).map(c => c.label);
    const score = Math.round((Object.values(detected).filter(Boolean).length / COMPONENTS.length) * 100);

    return { score, missing };
}

// ----------------------------------------------------------------
// Render
// ----------------------------------------------------------------
function renderScore({ score, missing }) {
    document.getElementById('pm-score-value').textContent = score;

    const list = document.getElementById('pm-components');
    list.innerHTML = COMPONENTS.map(c => {
        const present = !missing.includes(c.label);
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
