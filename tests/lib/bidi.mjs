// Minimal WebDriver BiDi client for headless Firefox
export async function connect(url = 'ws://127.0.0.1:9333/session') {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const waiting = new Map();
    const listeners = [];
    ws.onmessage = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id && waiting.has(msg.id)) {
            const { res, rej } = waiting.get(msg.id);
            waiting.delete(msg.id);
            if (msg.type === 'error') rej(new Error(msg.error + ': ' + msg.message));
            else res(msg.result);
        } else if (msg.type === 'event') {
            for (const l of listeners) l(msg);
        }
    };
    const send = (method, params = {}) => new Promise((res, rej) => {
        const i = ++id;
        waiting.set(i, { res, rej });
        ws.send(JSON.stringify({ id: i, method, params }));
    });
    await send('session.new', { capabilities: { alwaysMatch: { unhandledPromptBehavior: { default: 'accept' } } } });
    await send('session.subscribe', { events: ['log.entryAdded', 'browsingContext.userPromptOpened'] });
    const logs = [];
    listeners.push((m) => {
        if (m.method === 'log.entryAdded') logs.push(`[${m.params.level}] ${m.params.text}`);
        if (m.method === 'browsingContext.userPromptOpened') logs.push(`[prompt ${m.params.type}] ${m.params.message}`);
    });

    const api = {
        send, logs, ws,
        async contexts() { return (await send('browsingContext.getTree', {})).contexts; },
        async navigate(context, url) { return send('browsingContext.navigate', { context, url, wait: 'complete' }); },
        // Evaluate a function body (string) in a context; returns the deserialized JSON value
        async run(context, body, { user = false } = {}) {
            const r = await send('script.callFunction', {
                functionDeclaration: `async function() { const __r = await (async () => { ${body} })(); return JSON.stringify(__r === undefined ? null : __r); }`,
                target: { context }, awaitPromise: true, userActivation: user
            });
            if (r.type === 'exception') throw new Error('JS exception: ' + (r.exceptionDetails?.text || JSON.stringify(r.exceptionDetails)));
            return JSON.parse(r.result.value);
        },
        async waitFor(context, body, timeout = 8000) {
            const t0 = Date.now();
            while (Date.now() - t0 < timeout) {
                try { const v = await api.run(context, body); if (v) return v; } catch (_) { /* page loading */ }
                await new Promise(r => setTimeout(r, 150));
            }
            throw new Error('timeout waiting for: ' + body);
        },
        sleep: (ms) => new Promise(r => setTimeout(r, ms)),
        // Real pointer drag across an element (draws a stroke on a canvas)
        async drag(context, selector, pts) {
            const box = await api.run(context, `const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height};`);
            const P = ([fx, fy]) => ({ x: Math.round(box.x + fx * box.w), y: Math.round(box.y + fy * box.h) });
            const actions = [{ type: 'pointerMove', ...P(pts[0]), duration: 0 }, { type: 'pointerDown', button: 0 }];
            for (const p of pts.slice(1)) actions.push({ type: 'pointerMove', ...P(p), duration: 30 });
            actions.push({ type: 'pointerUp', button: 0 });
            await send('input.performActions', { context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions }] });
            return box;
        },
        async close() { try { await send('session.end', {}); } catch (_) {} ws.close(); }
    };
    return api;
}
