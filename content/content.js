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
    'chatgpt.com': {
        orbTop:            68,   // px — clears the ChatGPT header bar (~48px)
        inputSelector:     '#prompt-textarea',
        // Dictation button is always present for logged-in users regardless of input state
        fabAnchorSelector: 'button[aria-label="Start dictation"], [data-testid="send-button"], [data-testid="composer-speech-button"]',
        getFabTarget(anchorEl) {
            // Walk up to the flex row (.ms-auto...) — stable across re-renders
            const flexRow = anchorEl.closest('[class*="ms-auto"]');
            if (!flexRow) return null;
            return { container: flexRow };
        },
        getInsertBefore: (container) => container.lastElementChild,
        isSendVisible(container) {
            return !!container.querySelector('[data-testid="send-button"]');
        },
        // React aggressively re-mounts the button row; polling is more reliable than MutationObserver
        usePolling: true,
    },

    'claude.ai': {
        orbTop:            80,   // px — clears the Claude header bar (~56px) with share/incognito buttons
        inputSelector:     '[contenteditable="true"]',
        // Model selector is always visible regardless of input state
        fabAnchorSelector: 'button[data-testid="model-selector-dropdown"]',
        getFabTarget(anchorEl) {
            const modelWrapper = anchorEl.closest('[class*="transition-all"]');
            if (!modelWrapper) return null;
            return { container: modelWrapper.parentElement };    // top flex row
        },
        // Right section is always the last child of the flex row
        getInsertBefore: (container) => container.lastElementChild,
        isSendVisible(container) {
            return !!container.querySelector('button[aria-label="Send message"]');
        },
    },

    'gemini.google.com': {
        orbTop:            84,   // px — clears the Gemini/Google header bar (~64px) with profile circle
        inputSelector:     '.ql-editor',
        // .send-button-container is always in DOM — just toggles .visible / .disabled
        fabAnchorSelector: '.send-button-container',
        getFabTarget(anchorEl) {
            return { container: anchorEl.parentElement };   // .input-buttons-wrapper-bottom
        },
        // Always insert directly before .send-button-container
        getInsertBefore: (container) => container.querySelector('.send-button-container'),
        isSendVisible(container) {
            return !!container.querySelector('.send-button-container.visible');
        },
    },
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

// Returns false when the extension has been reloaded mid-session (dev workflow).
// Prevents "Extension context invalidated" crashes on chrome.* calls.
function chromeAlive() {
    try { return !!chrome.runtime.id; } catch { return false; }
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
// Popup render helper
// ----------------------------------------------------------------
function renderPopup(popup, score, detected) {
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
            <button id="pm-settings-btn" title="Settings">⚙</button>
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
}

// ----------------------------------------------------------------
// Settings Panel
// ----------------------------------------------------------------
async function buildSettingsPanel(onTriggerChange) {
    const res  = await fetch(chrome.runtime.getURL('settings/settings.html'));
    const html = await res.text();

    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const panel = tmp.firstElementChild;
    document.body.appendChild(panel);

    let selectedModule = null;

    // Pre-populate saved config + prefs on re-open
    try {
        chrome.storage.sync.get(['pmConfig', 'pmPrefs'], (result) => {
            if (result.pmConfig) {
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
            }
            const prefs = result.pmPrefs || { autoLinter: true };
            panel.querySelector('#pm-pref-popup-trigger').checked = prefs.autoLinter !== false;
        });
    } catch { /* context invalidated */ }

    // Section nav
    panel.querySelectorAll('.pm-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            panel.querySelectorAll('.pm-nav-btn').forEach(b => b.classList.remove('pm-nav-active'));
            panel.querySelectorAll('[id^="pm-section-"]').forEach(s => s.style.display = 'none');
            btn.classList.add('pm-nav-active');
            panel.querySelector(`#pm-section-${btn.dataset.target}`).style.display = 'flex';
        });
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

    // Save — validate and persist config
    panel.querySelector('#pm-config-confirm').addEventListener('click', () => {
        if (!selectedModule) return;
        const apiKey = panel.querySelector('#pm-api-key').value.trim();
        if (selectedModule === 'groq' && !apiKey) {
            const input = panel.querySelector('#pm-api-key');
            input.focus();
            input.style.borderColor = '#f59e0b';
            setTimeout(() => { input.style.borderColor = ''; }, 1500);
            return;
        }
        try {
            chrome.storage.sync.set({ pmConfig: { module: selectedModule, apiKey } }, () => {
                chrome.storage.sync.remove('firstRun');
                hideSettings(panel);
            });
        } catch { /* context invalidated */ }
    });

    // Automatic linting toggle
    panel.querySelector('#pm-pref-popup-trigger').addEventListener('change', (e) => {
        const enabled = e.target.checked;
        try {
            chrome.storage.sync.set({ pmPrefs: { autoLinter: enabled } });
        } catch { /* context invalidated */ }
        onTriggerChange?.(enabled);
    });

    // Close button
    panel.querySelector('#pm-settings-close').addEventListener('click', () => hideSettings(panel));

    return panel;
}

function showSettings(panel) {
    panel.classList.add('pm-settings-open');
}

function hideSettings(panel) {
    panel.classList.remove('pm-settings-open');
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
    orb.style.top   = `${platform.orbTop}px`;
    document.body.appendChild(orb);

    // inputEl is set by observeInput — applyPopupTrigger closes over it
    let inputEl = null;

    // Settings panel — fetch markup, wire logic, append to DOM
    const settingsPanel = await buildSettingsPanel((enabled) => {
        if (inputEl) applyLinterMode(enabled);
    });

    // Glassy popup — shown/hidden by orb click, not by input events
    const popup = document.createElement('div');
    popup.id            = 'pm-popup';
    popup.style.top     = `${platform.orbTop + 44 + 8}px`;
    popup.style.display = 'none';
    document.body.appendChild(popup);

    let popupOpen = false;

    function showPopup() {
        const inputEl = document.querySelector(platform.inputSelector);
        const text    = inputEl ? (inputEl.value ?? inputEl.innerText) : '';
        if (!text.trim()) return;                   // nothing to score yet
        const { score, detected } = lintPrompt(text);
        renderPopup(popup, score, detected);
        popup.style.display = 'block';
        popupOpen = true;
    }

    function hidePopup() {
        popup.style.display = 'none';
        popupOpen = false;
    }

    // Gear button inside popup — delegated so it survives renderPopup's innerHTML rewrites
    popup.addEventListener('click', (e) => {
        if (e.target.closest('#pm-settings-btn')) {
            e.stopPropagation();
            hidePopup();
            showSettings(settingsPanel);
        }
    });

    // Orb click: always toggles settings panel
    orb.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.contains('pm-settings-open')
            ? hideSettings(settingsPanel)
            : showSettings(settingsPanel);
    });

    // Click outside popup or orb → close popup
    popup.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => { if (popupOpen) hidePopup(); });

    // First-run: auto-open settings panel on fresh install
    try {
        chrome.storage.sync.get(['firstRun'], (result) => {
            if (result.firstRun) showSettings(settingsPanel);
        });
    } catch { /* context already invalidated */ }

    // Re-attach PM body elements if the platform framework clears body children (e.g. Next.js hydration)
    new MutationObserver(() => {
        if (!document.body.contains(orb))           document.body.appendChild(orb);
        if (!document.body.contains(settingsPanel)) document.body.appendChild(settingsPanel);
        if (!document.body.contains(popup))         document.body.appendChild(popup);
    }).observe(document.body, { childList: true });

    // Magic Wand FAB — #pm-fab-wrap is the injected element; #pm-fab is the button inside it
    const fab = document.createElement('button');
    fab.id = 'pm-fab';
    fab.innerHTML = PM_WAND_SVG;

    const fabWrap = document.createElement('div');
    fabWrap.id = 'pm-fab-wrap';
    fabWrap.style.display = 'none';
    fabWrap.appendChild(fab);

    // Animation state — prevents double-trigger when injectAndSync runs frequently
    let fabVisible  = false;
    let onShowDone  = null;
    let onHideDone  = null;

    function showFab() {
        if (fabVisible) return;
        fabVisible = true;
        if (onHideDone) { fab.removeEventListener('animationend', onHideDone); onHideDone = null; }
        fab.classList.remove('pm-fab-out');
        fabWrap.style.display = 'flex';
        void fab.offsetWidth;               // force reflow so the animation restarts cleanly
        fab.classList.add('pm-fab-in');
        onShowDone = () => { fab.classList.remove('pm-fab-in'); onShowDone = null; };
        fab.addEventListener('animationend', onShowDone, { once: true });

        // Per-session reminder — fires once per tab session on first FAB appearance
        if (!sessionStorage.getItem('pm-reminded')) {
            sessionStorage.setItem('pm-reminded', '1');
            const rect = fabWrap.getBoundingClientRect();
            const tip  = document.createElement('div');
            tip.id          = 'pm-fab-tip';
            tip.textContent = 'expand your prompt ✦';
            tip.style.left  = `${rect.left + rect.width / 2}px`;
            tip.style.top   = `${rect.top - 10}px`;
            document.body.appendChild(tip);
            tip.addEventListener('animationend', () => tip.remove(), { once: true });
        }
    }

    function hideFab() {
        if (!fabVisible) return;
        fabVisible = false;
        if (onShowDone) { fab.removeEventListener('animationend', onShowDone); onShowDone = null; }
        fab.classList.remove('pm-fab-in');
        fab.classList.add('pm-fab-out');
        onHideDone = () => {
            fab.classList.remove('pm-fab-out');
            if (!fabVisible) fabWrap.style.display = 'none';
            onHideDone = null;
        };
        fab.addEventListener('animationend', onHideDone, { once: true });
    }

    // Inject FAB between model config and send button on each platform
    observeInput(platform.fabAnchorSelector, (initialAnchorEl) => {
        const initialTarget = platform.getFabTarget(initialAnchorEl);
        if (!initialTarget) return;

        function injectAndSync() {
            // Re-query anchor on every tick — handles React/Angular replacing the container element
            const anchorEl = document.querySelector(platform.fabAnchorSelector);
            if (!anchorEl) { hideFab(); return; }
            const target = platform.getFabTarget(anchorEl);
            if (!target) { hideFab(); return; }
            const { container } = target;

            const before = platform.getInsertBefore(container);
            if (!before) { hideFab(); return; }

            if (fabWrap.nextElementSibling !== before || fabWrap.parentElement !== container) {
                container.insertBefore(fabWrap, before);
            }
            if (platform.isSendVisible(container)) { showFab(); } else { hideFab(); }
        }

        injectAndSync();

        if (platform.usePolling) {
            // React re-mounts the button row on each render; poll instead of watching a stale ref
            setInterval(injectAndSync, 150);
        } else {
            // Observe parent of the initial container — catches if the framework replaces container itself
            const watchEl = initialTarget.container.parentElement ?? initialTarget.container;
            new MutationObserver(injectAndSync).observe(watchEl, {
                childList: true,
                subtree: true,
                attributes: true,           // needed for Gemini — class toggle, not DOM swap
                attributeFilter: ['class'],
            });
        }
    });

    let debounceTimer;

    // Named reference required so removeEventListener targets the same function
    function onInputLinter() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const text = inputEl.value ?? inputEl.innerText;
            if (!text.trim()) { hidePopup(); return; }
            showPopup();
        }, 300);
    }

    function applyLinterMode(enabled) {
        inputEl.removeEventListener('input', onInputLinter);
        if (enabled) {
            inputEl.addEventListener('input', onInputLinter);
        } else {
            hidePopup();
        }
    }

    observeInput(platform.inputSelector, (el) => {
        inputEl = el;

        fab.addEventListener('click', async () => {
            const rawText = inputEl.value ?? inputEl.innerText;
            if (!rawText.trim()) return;

            fab.disabled = true;
            fab.innerHTML = `<span id="pm-fab-loading">···</span>`;
            let animInterval = startLoadingAnimation(inputEl);

            const result = await expand(rawText);

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

        // Read saved pref and apply; default to enabled
        try {
            chrome.storage.sync.get(['pmPrefs'], (result) => {
                const enabled = result.pmPrefs?.autoLinter ?? true;
                applyLinterMode(enabled);
            });
        } catch { applyLinterMode(true); }
    });
}

init();
