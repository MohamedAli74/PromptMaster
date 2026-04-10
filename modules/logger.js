// Prompt Master — Logger
// Appends structured entries to chrome.storage.local under key 'pmLogs'.
// Capped at 50 entries (oldest dropped first).
//
// To read logs, open the background service worker console at:
//   chrome://extensions → Prompt Master → "service worker" link → Console
// Then run:
//   chrome.storage.local.get(['pmLogs'], r => console.log(JSON.stringify(r.pmLogs, null, 2)))

const PM_LOG_KEY  = 'pmLogs';
const PM_LOG_MAX  = 50;

function pmLog(entry) {
    chrome.storage.local.get([PM_LOG_KEY], (result) => {
        const logs = result[PM_LOG_KEY] || [];
        logs.push({ ts: new Date().toISOString(), ...entry });
        if (logs.length > PM_LOG_MAX) logs.splice(0, logs.length - PM_LOG_MAX);
        chrome.storage.local.set({ [PM_LOG_KEY]: logs });
    });
}
