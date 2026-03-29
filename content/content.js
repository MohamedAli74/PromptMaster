// Prompt Master — Content Script
// Injected into ChatGPT, Claude, and Gemini pages.
// Responsibilities:
//   1. Detect the active chat input via MutationObserver
//   2. Run R.C.T.C.F. linting directly in page context
//   3. Show floating orb + glassy popup with live score
//   4. Inject Magic Wand FAB for window.ai expansion

// ----------------------------------------------------------------
// Platform targets
// ----------------------------------------------------------------
const PLATFORMS = {
    'chatgpt.com':       { inputSelector: '#prompt-textarea' },
    'claude.ai':         { inputSelector: '[contenteditable="true"]' },
    'gemini.google.com': { inputSelector: '.ql-editor' },
};

function getPlatform() {
    const host = location.hostname.replace('www.', '');
    return PLATFORMS[host] || null;
}

// ----------------------------------------------------------------
// MutationObserver — wait for the input to appear in the DOM
// ----------------------------------------------------------------
function observeInput(selector, callback) {
    const existing = document.querySelector(selector);
    if (existing) { callback(existing); return; }

    const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); callback(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ----------------------------------------------------------------
// Linter
// ----------------------------------------------------------------
const COMPONENTS = [
    { key: 'role',       label: 'Persona / Role', weight: 15 },
    { key: 'context',    label: 'Context',        weight: 23 },
    { key: 'task',       label: 'Task',           weight: 40 },
    { key: 'constraint', label: 'Constraint',     weight: 15 },
    { key: 'format',     label: 'Output Format',  weight:  7 },
];

const HEURISTICS = {
    role: {
        keywords: ['act as', 'you are', 'as a', 'pretend to be', 'imagine you', 'take the role', 'your role is'],
        pattern:  null,
    },
    context: {
        keywords: ['background', 'context', 'currently', 'we have', 'i have', 'our', 'the project', 'given that', 'situation'],
        pattern:  null,
    },
    task: {
        keywords: ['write', 'create', 'generate', 'explain', 'summarize', 'list', 'build', 'help me', 'i need', 'please', 'make', 'fix', 'refactor', 'update', 'add', 'remove', 'implement', 'review', 'debug', 'convert', 'analyze', 'design'],
        pattern:  null,
    },
    constraint: {
        keywords: ["don't", 'do not', 'avoid', 'only', 'must', 'limit', 'no more than', 'keep it', 'without', 'never'],
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
    const score   = 100 - missing.reduce((sum, c) => sum + c.weight, 0);

    return { score, detected };
}

// ----------------------------------------------------------------
// Init
// ----------------------------------------------------------------
function init() {
    const platform = getPlatform();
    if (!platform) return;

    // Floating orb (always visible)
    const orb = document.createElement('button');
    orb.id          = 'pm-orb';
    orb.textContent = '✦';
    document.body.appendChild(orb);

    // Glassy popup (hidden until user types)
    const popup = document.createElement('div');
    popup.id           = 'pm-popup';
    popup.style.display = 'none';
    document.body.appendChild(popup);

    observeInput(platform.inputSelector, (inputEl) => {
        // Magic Wand FAB
        const fab = document.createElement('button');
        fab.id          = 'pm-fab';
        fab.textContent = '✨';
        document.body.appendChild(fab);

        fab.addEventListener('click', async () => {
            if (typeof LanguageModel === 'undefined') {
                alert('Magic Wand requires Gemini Nano.\n\n1. Go to chrome://flags\n2. Enable #optimization-guide-on-device-model (BypassPerfRequirement)\n3. Enable #prompt-api-for-gemini-nano\n4. Relaunch Chrome and wait for the model to download.');
                return;
            }

            const availability = await LanguageModel.availability();
            if (availability === 'unavailable') {
                alert('Gemini Nano is not available on this device. Check hardware requirements at developer.chrome.com/docs/ai/get-started');
                return;
            }

            const rawText = inputEl.value ?? inputEl.innerText;
            if (!rawText.trim()) return;

            fab.disabled    = true;
            fab.textContent = '⏳';

            try {
                const session = await LanguageModel.create({
                    outputLanguage: 'en',
                    monitor(monitor) {
                        let lastPct = -1;
                        monitor.addEventListener('downloadprogress', (e) => {
                            const pct = Math.round((e.loaded / e.total) * 100);
                            if (pct !== lastPct) {
                                lastPct = pct;
                                fab.textContent = `${pct}%`;
                                console.log(`Gemini Nano downloading: ${pct}%`);
                            }
                        });
                    },
                });
                const expandedText = await session.prompt(
                    `Expand the following into a structured prompt using Role, Context, Task, Constraint, and Format. Return only the expanded prompt, no explanation.\n\n${rawText}`
                );

                if (inputEl.value !== undefined) {
                    inputEl.value = expandedText;
                } else {
                    inputEl.innerText = expandedText;
                }
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            } finally {
                fab.disabled    = false;
                fab.textContent = '✨';
            }
        });

        let debounceTimer;
        let hideTimer;

        inputEl.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            clearTimeout(hideTimer);

            debounceTimer = setTimeout(() => {
                const text = inputEl.value ?? inputEl.innerText;
                if (!text.trim()) { popup.style.display = 'none'; return; }

                const { score, detected } = lintPrompt(text);

                popup.innerHTML = `
                    <div id="pm-score-ring">${score}<span>/100</span></div>
                    <ul id="pm-checklist">
                        ${COMPONENTS.map(c => `
                            <li class="${detected[c.key] ? 'pm-pass' : 'pm-fail'}">
                                <span class="pm-icon">${detected[c.key] ? '✓' : '✗'}</span>
                                ${c.label}
                            </li>
                        `).join('')}
                    </ul>
                `;
                popup.style.display = 'block';
            }, 300);

            hideTimer = setTimeout(() => {
                popup.style.display = 'none';
            }, 3000);
        });
    });
}

init();
