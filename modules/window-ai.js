// Prompt Master — window.ai module
// Wraps Chrome's built-in LanguageModel (Gemini Nano).
// Requires Chrome 127+ with the Gemini Nano flag enabled.

async function expandWithWindowAI(rawText, systemPrompt, onDownloadProgress) {
    if (typeof LanguageModel === 'undefined') {
        throw new Error(
            'window.ai not found — go to chrome://flags, enable ' +
            '#prompt-api-for-gemini-nano and #optimization-guide-on-device-model, then relaunch Chrome'
        );
    }

    const availability = await LanguageModel.availability();
    if (availability === 'unavailable') {
        throw new Error('Gemini Nano unavailable on this device');
    }

    const session = await LanguageModel.create({
        systemPrompt,
        outputLanguage: 'en',
        monitor(monitor) {
            let lastPct = -1;
            monitor.addEventListener('downloadprogress', (e) => {
                // Model already cached — skip, no progress to show
                if (e.loaded >= e.total) return;
                const pct = Math.round((e.loaded / e.total) * 100);
                if (pct !== lastPct) {
                    lastPct = pct;
                    onDownloadProgress?.(pct);
                }
            });
        },
    });

    return (await session.prompt(
        `Rewrite this as an RCTCF prompt. Do NOT answer it:\n\n${rawText}`
    )).trim();
}
