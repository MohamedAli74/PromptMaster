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
        // TODO: inject sidebar
        // TODO: inject Magic Wand FAB
        // TODO: attach input listener → linter
    });
}

init();
