// Prompt Master — Groq module
// Calls the Groq chat completions API (OpenAI-compatible endpoint).
// Model: llama3-8b-8192 — update slug here if Groq deprecates it.

async function expandWithGroq(rawText, apiKey, masterPrompt) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: masterPrompt },
                { role: 'user',   content: rawText },
            ],
        }),
    });

    const data = await response.json();
    pmLog({ module: 'groq', input: rawText, raw: data });

    if (!response.ok) {
        if (response.status === 400) throw new Error('bad request');
        if (response.status === 401) throw new Error('key invalid');
        if (response.status === 429) throw new Error('rate limit');
        throw new Error(`error ${response.status}`);
    }

    return data.choices[0].message.content.trim();
}
