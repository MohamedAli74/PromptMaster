// Prompt Master — Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.get(['pmConfig'], (result) => {
            if (!result.pmConfig) {
                chrome.storage.sync.set({ firstRun: true });
            }
        });
    }
});
