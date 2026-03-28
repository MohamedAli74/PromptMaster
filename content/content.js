// Prompt Master — Content Script
// Injected into ChatGPT, Claude, and Gemini pages.
// Responsibilities:
//   1. Detect the active chat input via MutationObserver
//   2. Inject the sidebar and Magic Wand FAB
//   3. Stream keystrokes to the linter and update the score
//   4. Trigger window.ai expansion on FAB click

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
// Init
// ----------------------------------------------------------------
function init() {
    const platform = getPlatform();
    if (!platform) return;

    observeInput(platform.inputSelector, (inputEl) => {
        // Inject sidebar iframe
        const iframe = document.createElement('iframe');
        iframe.id  = 'pm-sidebar';
        iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
        document.body.appendChild(iframe);

        // Inject Magic Wand FAB
        const fab = document.createElement('button');
        fab.id          = 'pm-fab';
        fab.textContent = '✨';
        document.body.appendChild(fab);

        fab.addEventListener('click', async () => {
            if (!window.ai) {
                alert('Magic Wand requires Gemini Nano. Enable it in chrome://flags/#optimization-guide-on-device-model');
                return;
            }

            const rawText = inputEl.value ?? inputEl.innerText;
            if (!rawText.trim()) return;

            fab.disabled    = true;
            fab.textContent = '⏳';

            try {
                const session      = await window.ai.languageModel.create();
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
        inputEl.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const text = inputEl.value ?? inputEl.innerText;
                chrome.runtime.sendMessage({ type: 'PROMPT_UPDATE', text });
            }, 300);
        });
    });
}

init();
