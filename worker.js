const MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4o-mini"
];

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  if (origin && allowedOrigin && origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }
  return headers;
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = (env.ALLOWED_ORIGIN || "").trim().replace(/\/$/, "");
    const cors = corsHeaders(origin, allowedOrigin);

    if (!allowedOrigin || !env.OPENROUTER_API_KEY) {
      return json({ error: "Backend configuration missing." }, 500, cors);
    }
    if (origin !== allowedOrigin) {
      return json({ error: "Origin not allowed." }, 403, cors);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    const url = new URL(request.url);
    if (url.pathname !== "/chat") return json({ error: "Not found." }, 404, cors);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > 64 * 1024) return json({ error: "Request too large." }, 413, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON." }, 400, cors); }

    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 30) {
      return json({ error: "Invalid messages array." }, 400, cors);
    }
    const cleanMessages = [];
    for (const item of messages) {
      if (!item || !["system", "user", "assistant"].includes(item.role) ||
          typeof item.content !== "string" || !item.content.trim() ||
          item.content.length > 20000) {
        return json({ error: "Invalid message format." }, 400, cors);
      }
      cleanMessages.push({ role: item.role, content: item.content });
    }

    const temperature = Number.isFinite(body.temperature)
      ? Math.min(1.5, Math.max(0, body.temperature)) : 0.7;
    const maxTokens = Number.isFinite(body.max_tokens)
      ? Math.min(2048, Math.max(64, Math.floor(body.max_tokens))) : 2048;

    let lastStatus = 502;
    for (const model of MODELS) {
      try {
        const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "X-OpenRouter-Title": "Sheriya Study Zone"
          },
          body: JSON.stringify({ model, messages: cleanMessages, temperature, max_tokens: maxTokens }),
          signal: AbortSignal.timeout(45000)
        });

        const raw = await upstream.text();
        let result = {};
        try { result = raw ? JSON.parse(raw) : {}; } catch {}
        if (upstream.ok) {
          const content = result?.choices?.[0]?.message?.content;
          const text = Array.isArray(content)
            ? content.map(part => typeof part === "string" ? part : (part?.text || "")).join("\n").trim()
            : String(content || "").trim();
          if (!text) return json({ error: "AI returned an empty response." }, 502, cors);
          return json({
            text,
            model,
            finish_reason: result?.choices?.[0]?.finish_reason || "stop"
          }, 200, cors);
        }

        lastStatus = upstream.status;
        if ([400, 401, 402, 403].includes(upstream.status)) {
          return json({ error: upstream.status === 402
            ? "OpenRouter account credits/billing need attention."
            : "OpenRouter rejected the request. Check the backend key and account." }, upstream.status, cors);
        }
        if (![404, 408, 429, 500, 502, 503, 504].includes(upstream.status)) {
          return json({ error: "OpenRouter request failed." }, upstream.status, cors);
        }
      } catch {
        lastStatus = 502;
      }
    }
    return json({ error: "All configured AI models are temporarily unavailable.", status: lastStatus }, 502, cors);
  }
};
