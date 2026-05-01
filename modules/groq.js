// Prompt Master — Groq module
// Calls the Groq chat completions API (OpenAI-compatible endpoint).
// Model: llama-3.1-8b-instant — update slug here if Groq deprecates it.

const GROQ_TIMEOUT_MS = 15000;

function groqAbortController() {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
    return controller;
}

async function expandWithGroq(rawText, apiKey, masterPrompt) {
    const controller = groqAbortController();
    let response;
    try {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            signal: controller.signal,
        });
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('request timed out');
        throw err;
    }

    if (!response.ok) {
        if (response.status === 400) throw new Error('bad request');
        if (response.status === 401) throw new Error('key invalid');
        if (response.status === 429) throw new Error('rate limit');
        throw new Error(`error ${response.status}`);
    }

    const data = await response.json();
    pmLog({ module: 'groq', input: rawText, raw: data });

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('unexpected response');
    return content.trim();
}

async function expandWithGroqStreaming(rawText, apiKey, masterPrompt, onChunk) {
    const controller = groqAbortController();
    let response;
    try {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
                stream: true,
            }),
            signal: controller.signal,
        });
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('request timed out');
        throw err;
    }

    if (!response.ok) {
        if (response.status === 401) throw new Error('key invalid');
        if (response.status === 429) throw new Error('rate limit');
        throw new Error(`error ${response.status}`);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer      = '';
    let accumulated = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();           // save incomplete line for next chunk
        for (const line of lines) {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
            try {
                const token = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? '';
                if (token) {
                    accumulated += token;
                    onChunk(accumulated);
                }
            } catch { /* skip malformed SSE lines */ }
        }
    }

    return accumulated.trim();
}
