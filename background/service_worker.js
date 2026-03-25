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

// TODO: message routing between content script and sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // TODO
});
