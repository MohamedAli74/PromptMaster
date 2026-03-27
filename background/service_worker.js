// Prompt Master — Background Service Worker (Manifest V3)
// Handles cross-tab state, storage events, and message routing.

chrome.runtime.onInstalled.addListener(() => {
    // Initialize default storage on first install
    chrome.storage.sync.get(['templates', 'preferences'], (result) => {
        if (!result.templates) {
            chrome.storage.sync.set({ templates: [] });
        }
        if (!result.preferences) {
            chrome.storage.sync.set({
                preferences: {
                    sidebarEnabled: true,
                    autoExpand: false,
                }
            });
        }
    });
});

// Forward PROMPT_UPDATE messages from content script to sidebar iframe in the same tab
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type !== 'PROMPT_UPDATE') return;

    const tabId = sender.tab?.id;
    if (tabId == null) return;

    chrome.tabs.sendMessage(tabId, message).catch(() => {
        // Sidebar not yet loaded — safe to ignore
    });
});
