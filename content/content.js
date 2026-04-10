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

// masterPrompt lives in modules/expand.js

// ----------------------------------------------------------------
// Loading animation — runs inside the input field while wand generates
// ----------------------------------------------------------------
const PARTICLE_CHARS = ['*', '+', '-', '=', '~', '^', '!', '·', 'x', 'o'];

const PM_WAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="22" height="22">
    <line x1="12" y1="42" x2="35" y2="17" stroke="#0a0a0f" stroke-width="7" stroke-linecap="round"/>
    <circle cx="12" cy="42" r="5" fill="#0a0a0f"/>
    <circle cx="12" cy="42" r="3" fill="rgba(10,10,15,0.6)"/>
    <polygon points="38,5 40.8,11.2 47,14 40.8,16.8 38,23 35.2,16.8 29,14 35.2,11.2" fill="#0a0a0f"/>
    <circle cx="38" cy="14" r="3"   fill="rgba(10,10,15,0.55)"/>
    <circle cx="38" cy="14" r="1.3" fill="#ffffff" opacity="0.9"/>
</svg>`;

// React-safe write: uses the native setter so React's _valueTracker is NOT updated,
// keeping it at the user's original text. When the expanded prompt is finally written
// (also via native setter) and an input event is dispatched, React compares the new DOM
// value to its stale tracker value, sees a real change, and correctly updates its state.
const _nativeTextareaSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
)?.set;

function writeToInput(inputEl, text) {
    if (inputEl.tagName === 'TEXTAREA' && _nativeTextareaSetter) {
        _nativeTextareaSetter.call(inputEl, text);
    } else {
        inputEl.innerText = text;
    }
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

function startLoadingAnimation(inputEl) {
    // One continuous stream of chars flowing clockwise around the border:
    //   [0..12]  → top row        (left → right)
    //   [13..14] → right side     (top  → bottom)
    //   [15..27] → bottom row     (right → left)
    //   [28..29] → left side      (bottom → top)
    // Each frame shifts offset by +1, creating smooth rotation.
    const POOL = 30;
    const pool = Array.from(
        { length: POOL },
        () => PARTICLE_CHARS[Math.floor(Math.random() * PARTICLE_CHARS.length)]
    );
    let offset = 0;

    const at = (i) => pool[(i + offset) % POOL];

    const writeFrame = (text) => {
        if (inputEl.tagName === 'TEXTAREA' && _nativeTextareaSetter) {
            _nativeTextareaSetter.call(inputEl, text);
        } else {
            inputEl.innerText = text;
        }
    };

    return setInterval(() => {
        offset = (offset + 1) % POOL;

        const top    = Array.from({ length: 13 }, (_, i) => at(i)).join(' ');
        const right  = `${at(13)} ${at(14)}`;
        const bottom = Array.from({ length: 13 }, (_, i) => at(27 - i)).join(' ');
        const left   = `${at(29)} ${at(28)}`;

        writeFrame(`${top}\n${left}   Prompt Master   ${right}\n${bottom}`);
    }, 220);
}

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
// Config Panel
// ----------------------------------------------------------------
async function buildConfigPanel() {
    const res  = await fetch(chrome.runtime.getURL('config/config.html'));
    const html = await res.text();

    const panel = document.createElement('div');
    panel.id        = 'pm-config';
    panel.innerHTML = html;
    document.body.appendChild(panel);

    let selectedModule = null;

    // Pre-populate if config already saved (re-open flow)
    chrome.storage.sync.get(['pmConfig'], (result) => {
        if (!result.pmConfig) return;
        const { module, apiKey } = result.pmConfig;
        const card = panel.querySelector(`.pm-card[data-module="${module}"]`);
        if (card && !card.classList.contains('pm-card-disabled')) {
            card.classList.add('pm-card-selected');
            selectedModule = module;
            panel.querySelector('#pm-config-confirm').disabled = false;
        }
        if (module === 'groq') {
            panel.querySelector('#pm-key-section').style.display = 'block';
            if (apiKey) panel.querySelector('#pm-api-key').value = apiKey;
        }
    });

    // Card selection
    panel.querySelectorAll('.pm-card:not(.pm-card-disabled)').forEach(card => {
        card.addEventListener('click', () => {
            panel.querySelectorAll('.pm-card').forEach(c => c.classList.remove('pm-card-selected'));
            card.classList.add('pm-card-selected');
            selectedModule = card.dataset.module;
            panel.querySelector('#pm-key-section').style.display =
                selectedModule === 'groq' ? 'block' : 'none';
            panel.querySelector('#pm-config-confirm').disabled = false;
        });
    });

    // Show / hide API key
    panel.querySelector('#pm-key-toggle').addEventListener('click', () => {
        const input  = panel.querySelector('#pm-api-key');
        const btn    = panel.querySelector('#pm-key-toggle');
        const hidden = input.type === 'password';
        input.type      = hidden ? 'text' : 'password';
        btn.textContent = hidden ? 'Hide' : 'Show';
    });

    // Confirm — save config and close
    panel.querySelector('#pm-config-confirm').addEventListener('click', () => {
        if (!selectedModule) return;
        const apiKey = panel.querySelector('#pm-api-key').value.trim();
        chrome.storage.sync.set({ pmConfig: { module: selectedModule, apiKey } }, () => {
            chrome.storage.sync.remove('firstRun');
            hideConfigPanel(panel);
        });
    });

    // Skip — default to window.ai
    panel.querySelector('#pm-config-skip').addEventListener('click', () => {
        chrome.storage.sync.set({ pmConfig: { module: 'window.ai', apiKey: '' } }, () => {
            chrome.storage.sync.remove('firstRun');
            hideConfigPanel(panel);
        });
    });

    return panel;
}

function showConfigPanel(panel) {
    panel.classList.add('pm-config-open');
}

function hideConfigPanel(panel) {
    panel.classList.remove('pm-config-open');
}

// ----------------------------------------------------------------
// Init
// ----------------------------------------------------------------
async function init() {
    const platform = getPlatform();
    if (!platform) return;

    // Floating orb (always visible)
    const orb = document.createElement('button');
    orb.id = 'pm-orb';
    orb.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="26" height="26">
        <path d="M 14,23 L 17,13 L 21,20.5 L 26,7 L 31,20.5 L 35,13 L 38,23 Z" fill="#0a0a0f"/>
        <rect x="14" y="21.5" width="24" height="6.5" rx="3.2" fill="#0a0a0f"/>
        <circle cx="17" cy="13" r="2.4" fill="#0a0a0f"/>
        <circle cx="26" cy="7"  r="2.8" fill="#0a0a0f"/>
        <circle cx="35" cy="13" r="2.4" fill="#0a0a0f"/>
        <circle cx="26" cy="7"  r="1.2" fill="#ffffff" opacity="0.85"/>
        <rect x="20" y="30" width="12" height="2"  rx="1" fill="#0a0a0f"/>
        <rect x="23" y="30" width="6"  height="18" rx="3" fill="#0a0a0f"/>
        <rect x="20" y="46" width="12" height="2"  rx="1" fill="#0a0a0f"/>
        <circle cx="26" cy="50" r="2" fill="#0a0a0f"/>
    </svg>`;
    document.body.appendChild(orb);

    // Config panel — fetch markup, wire logic, append to DOM
    const configPanel = await buildConfigPanel();

    // Orb click: toggle config panel open / closed
    orb.addEventListener('click', () => {
        if (configPanel.classList.contains('pm-config-open')) {
            hideConfigPanel(configPanel);
        } else {
            showConfigPanel(configPanel);
        }
    });

    // First-run: auto-open config panel on fresh install
    chrome.storage.sync.get(['firstRun'], (result) => {
        if (result.firstRun) showConfigPanel(configPanel);
    });

    // Glassy popup (hidden until user types)
    const popup = document.createElement('div');
    popup.id           = 'pm-popup';
    popup.style.display = 'none';
    document.body.appendChild(popup);

    observeInput(platform.inputSelector, (inputEl) => {
        // Magic Wand FAB
        const fab = document.createElement('button');
        fab.id = 'pm-fab';
        fab.innerHTML = PM_WAND_SVG;
        document.body.appendChild(fab);

        fab.addEventListener('click', async () => {
            const rawText = inputEl.value ?? inputEl.innerText;
            if (!rawText.trim()) return;

            fab.disabled = true;
            fab.innerHTML = `<span id="pm-fab-loading">···</span>`;
            let animInterval = startLoadingAnimation(inputEl);

            const result = await expand(rawText, (pct) => {
                fab.innerHTML = `<span id="pm-fab-loading">${pct}%</span>`;
            });

            clearInterval(animInterval);

            if (result.error) {
                writeToInput(inputEl, rawText);
                fab.innerHTML = `<span id="pm-fab-loading">${result.error}</span>`;
                setTimeout(() => {
                    fab.disabled = false;
                    fab.innerHTML = PM_WAND_SVG;
                }, 3000);
            } else {
                writeToInput(inputEl, result.text);
                fab.disabled = false;
                fab.innerHTML = PM_WAND_SVG;
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
                    <div id="pm-header">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="18" height="18" style="flex-shrink:0">
                            <defs>
                                <linearGradient id="pm-hdr-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#f59e0b"/>
                                    <stop offset="100%" stop-color="#7c3aed"/>
                                </linearGradient>
                            </defs>
                            <path d="M 14,23 L 17,13 L 21,20.5 L 26,7 L 31,20.5 L 35,13 L 38,23 Z" fill="url(#pm-hdr-grad)"/>
                            <rect x="14" y="21.5" width="24" height="6.5" rx="3.2" fill="url(#pm-hdr-grad)"/>
                            <circle cx="17" cy="13" r="2.4" fill="#f59e0b"/>
                            <circle cx="26" cy="7"  r="2.8" fill="#fbbf24"/>
                            <circle cx="35" cy="13" r="2.4" fill="#8b5cf6"/>
                            <circle cx="26" cy="7"  r="1.2" fill="#ffffff" opacity="0.9"/>
                            <rect x="20" y="30" width="12" height="2"  rx="1" fill="#ffffff"/>
                            <rect x="23" y="30" width="6"  height="18" rx="3" fill="#ffffff"/>
                            <rect x="20" y="46" width="12" height="2"  rx="1" fill="#ffffff"/>
                            <circle cx="26" cy="50" r="2" fill="#f59e0b"/>
                        </svg>
                        <span id="pm-header-title">Prompt <span id="pm-header-master">Master</span></span>
                    </div>
                    <div id="pm-divider"></div>
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
