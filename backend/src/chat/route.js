import { Router } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();

const SNAPSHOT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/existing-foundry-inventory.snapshot.json"
);

const MCP_SERVER_URL = (process.env.MCP_SERVER_URL ?? "https://chatdock-mcp-production.up.railway.app").replace(/\/+$/, "");

// Auth param names the MCP server uses — backend injects these, LLM never sees them
const MCP_AUTH_PARAMS = ["truefoundry_api_key", "control_plane_url"];

// Read the guardrail policy from the snapshot on every request — no permanent cache.
// This ensures the updated policy is picked up immediately after applyGuardrailPolicy()
// writes the guardrailPolicy section without requiring a backend restart.
async function getGuardrailPolicy() {
  try {
    const data = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
    const gwSection = data.sections?.find((s) => s.key === "guardrailPolicy");
    const policy = gwSection?.raw?.manifest?.default ?? {};
    return {
      input:   (policy.llm_input_guardrails               ?? []),
      output:  (policy.llm_output_guardrails              ?? []),
      mcpPre:  (policy.mcp_tool_pre_invoke_guardrails     ?? []),
      mcpPost: (policy.mcp_tool_post_invoke_guardrails    ?? []),
    };
  } catch {
    return { input: [], output: [], mcpPre: [], mcpPost: [] };
  }
}

const CHAOS = {
  "rate-limit":    { icon: "🔴", label: "429 Rate limited",           delayMs: 140 },
  "kill-primary":  { icon: "🔴", label: "503 Provider unavailable",   delayMs: 220 },
  "slow":          { icon: "🟡", label: "Response timeout after 3.1s", delayMs: 3100 },
};

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const TIER_RULE_ID = { guest: "guests", loggedIn: "logged-in", pro: "pro" };
const TIER_LABELS  = { guest: "Guest",  loggedIn: "Logged-in",  pro: "Pro"  };
const TOOL_TIER_RANK = { guest: 0, loggedIn: 1, pro: 2 };

// Classify a tool's minimum required tier from its auth requirement + description.
// Mirrors the heuristic used by /mcp-tools so counts and actual access stay consistent.
function classifyToolTier(description, needsAuth) {
  if (!needsAuth) return "guest";
  const desc = (description ?? "").toLowerCase();
  const isProOnly = desc.includes("pro tier") || desc.includes("pro only") || /requires.*pro/i.test(desc);
  return isProOnly ? "pro" : "loggedIn";
}

// ── MCP helpers ───────────────────────────────────────────────────────────────

function parseMcpSse(text) {
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  if (!dataLine) return null;
  try { return JSON.parse(dataLine.slice(6)); } catch { return null; }
}

// Strip MCP auth params from schema so LLM never sees them.
// Returns { schema, needsAuth } where needsAuth = true if tool required auth params.
function stripAuthFromSchema(inputSchema) {
  if (!inputSchema || typeof inputSchema !== "object") return { schema: inputSchema, needsAuth: false };
  const props = { ...(inputSchema.properties ?? {}) };
  const authFound = MCP_AUTH_PARAMS.filter((p) => p in props);
  for (const p of authFound) delete props[p];
  const required = (inputSchema.required ?? []).filter((r) => !MCP_AUTH_PARAMS.includes(r));
  return {
    schema: { ...inputSchema, properties: props, required },
    needsAuth: authFound.length > 0,
  };
}

let _mcpToolsCache = null;
// Returns { openaiTools, authRequired: Set<toolName> }
async function fetchMcpToolDefs() {
  if (_mcpToolsCache) return _mcpToolsCache;
  try {
    const res = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const json = parseMcpSse(text) ?? JSON.parse(text);
    const tools = json?.result?.tools ?? [];

    const openaiTools = [];
    const authRequired = new Set();

    for (const t of tools) {
      const { schema, needsAuth } = stripAuthFromSchema(t.inputSchema);
      if (needsAuth) authRequired.add(t.name);
      openaiTools.push({
        type: "function",
        function: { name: t.name, description: t.description, parameters: schema },
      });
    }

    _mcpToolsCache = { openaiTools, authRequired };
  } catch {
    _mcpToolsCache = { openaiTools: [], authRequired: new Set() };
  }
  return _mcpToolsCache;
}

async function callMcpTool(toolName, args) {
  try {
    const res = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    const json = parseMcpSse(text) ?? JSON.parse(text);
    if (json?.error) return { text: `Tool error: ${JSON.stringify(json.error)}`, denied: false };
    const content = json?.result?.content;
    const resultText = Array.isArray(content)
      ? content.map((c) => c.text ?? JSON.stringify(c)).join("\n")
      : JSON.stringify(json?.result ?? {});
    const denied = /access denied|no access|tier required|requires.*tier|not authorized|unauthorized/i.test(resultText);
    return { text: resultText, denied };
  } catch (err) {
    return { text: `Could not reach tool server: ${err.message}`, denied: false };
  }
}

// ── Stream one gateway request ────────────────────────────────────────────────

async function streamGatewayRequest({ url, apiKey, tfyMetadata, messages, tools, modelId, streamDeltas, res, t0 }) {
  const body = { model: modelId, messages, stream: true };
  if (tools?.length) { body.tools = tools; body.tool_choice = "auto"; }

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-TFY-METADATA": tfyMetadata,
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    throw Object.assign(new Error(`Gateway returned ${upstream.status}: ${errText.slice(0, 200)}`), { statusText: errText });
  }

  // The gateway returns the resolved (actually-used) model and a feedback-target-id
  // that encodes {spanId, traceId} for the request's root trace span — this is what
  // lets us later pull the full per-model fallback attempt chain via the spans API.
  const resolvedModelHeader = upstream.headers.get("x-tfy-resolved-model");
  let traceId = null;
  const feedbackTargetId = upstream.headers.get("x-tfy-feedback-target-id");
  if (feedbackTargetId) {
    try {
      const decoded = JSON.parse(Buffer.from(feedbackTargetId, "base64").toString("utf8"));
      traceId = decoded.traceId || null;
    } catch { /* not decodable — leave traceId null */ }
  }

  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let usedModel = resolvedModelHeader || modelId;
  let accumulated = "";
  let finishReason = null;
  const toolCallMap = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;
      try {
        const chunk = JSON.parse(raw);
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        if (chunk.model) usedModel = chunk.model;
        const delta = choice.delta ?? {};
        if (delta.content) {
          accumulated += delta.content;
          if (streamDeltas) sse(res, "delta", { content: delta.content });
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallMap[idx]) toolCallMap[idx] = { id: "", name: "", arguments: "" };
            if (tc.id)                  toolCallMap[idx].id        += tc.id;
            if (tc.function?.name)      toolCallMap[idx].name      += tc.function.name;
            if (tc.function?.arguments) toolCallMap[idx].arguments += tc.function.arguments;
          }
        }
      } catch { /* skip malformed */ }
    }
  }

  const toolCalls = Object.values(toolCallMap).filter((tc) => tc.name);
  return { text: accumulated, toolCalls, usedModel, finishReason, traceId };
}

// ── Chat route ────────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const {
    messages, gatewayUrl, modelId, apiKey,
    chaosMode, primaryModelLabel, fallbackModelLabel,
    userTier, controlPlaneUrl, systemPrompt, guardrailNames,
  } = req.body;

  if (!messages?.length || !gatewayUrl || !modelId || !apiKey) {
    return res.status(400).json({ error: "messages, gatewayUrl, modelId and apiKey are required." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const t0 = Date.now();
  const primary  = primaryModelLabel  || modelId;
  const fallback = fallbackModelLabel || modelId;

  // Prefer guardrail names sent from the frontend (tier config); fall back to snapshot.
  const snapshotGp = await getGuardrailPolicy();
  const clientGuardrails = Array.isArray(guardrailNames) && guardrailNames.length > 0 ? guardrailNames : null;
  const gp = clientGuardrails
    ? { input: clientGuardrails, output: clientGuardrails, mcpPre: clientGuardrails, mcpPost: [] }
    : snapshotGp;

  try {
    sse(res, "trace", { icon: "🔵", text: `Request received → model: ${primary}`, ms: 0 });

    if (chaosMode && CHAOS[chaosMode]) {
      const c = CHAOS[chaosMode];
      if (chaosMode === "slow") {
        sse(res, "trace", { icon: "🟡", text: `Chaos: slow mode active — adding 3.1s delay`, ms: Date.now() - t0 });
        await new Promise((r) => setTimeout(r, c.delayMs));
      } else {
        sse(res, "trace", { icon: "⚡", text: `Calling ${primary}…`, ms: Date.now() - t0 });
        await new Promise((r) => setTimeout(r, c.delayMs));
      }
      sse(res, "trace", { icon: c.icon, text: `${primary} → ${c.label} (${Date.now() - t0}ms)`, ms: Date.now() - t0 });
      sse(res, "trace", { icon: "↩", text: `Falling back to ${fallback}`, ms: Date.now() - t0 });
    } else {
      sse(res, "trace", { icon: "⚡", text: `Calling ${primary}…`, ms: Date.now() - t0 });
    }

    const url = `${gatewayUrl.replace(/\/+$/, "")}/chat/completions`;
    const ruleId = (userTier && TIER_RULE_ID[userTier]) || "guests";
    const tier   = TIER_LABELS[userTier] || "Guest";
    const tfyMetadata = JSON.stringify({ userId: `sim-${userTier || "guest"}`, user_tier: ruleId });

    sse(res, "trace", { icon: "👤", text: `User tier: ${tier} → TrueFoundry rule: "${ruleId}"`, ms: Date.now() - t0 });

    if (gp.input.length > 0) {
      sse(res, "trace", { icon: "🛡️", text: `Input guardrails active: ${gp.input.join(", ")}`, ms: Date.now() - t0 });
    }

    // System prompt comes from frontend (built from widget config), never hardcoded here
    const hasSystem = messages.some((m) => m.role === "system");
    const fullMessages = (hasSystem || !systemPrompt)
      ? messages
      : [{ role: "system", content: systemPrompt }, ...messages];

    // Fetch ALL MCP tool definitions; auth params stripped so LLM only sees domain args.
    // Then scope down to only the tools the SIMULATED tier may use — this is what makes
    // "Simulate user tier" behave realistically: a Guest literally cannot see (let alone
    // call or hallucinate around) Logged-in/Pro-only tools such as search_docs_standard.
    const { openaiTools, authRequired } = await fetchMcpToolDefs();
    const userTierKey = TOOL_TIER_RANK[userTier] !== undefined ? userTier : "guest";
    const scopedTools = openaiTools.filter((t) => {
      const needsAuth = authRequired.has(t.function.name);
      const toolTier = classifyToolTier(t.function.description, needsAuth);
      return TOOL_TIER_RANK[toolTier] <= TOOL_TIER_RANK[userTierKey];
    });

    if (scopedTools.length > 0) {
      const names = scopedTools.map((t) => t.function.name).join(", ");
      const authNames = scopedTools.filter((t) => authRequired.has(t.function.name)).map((t) => t.function.name);
      sse(res, "trace", {
        icon: "🔌",
        text: `MCP tools available to ${tier} tier: [${names}]${authNames.length > 0 ? ` — ${authNames.length} require auth: [${authNames.join(", ")}]` : ""}`,
        ms: Date.now() - t0,
      });
    } else {
      sse(res, "trace", { icon: "🔌", text: `No MCP tools available to ${tier} tier`, ms: Date.now() - t0 });
    }

    // ── First LLM call ────────────────────────────────────────────────────────
    const first = await streamGatewayRequest({
      url, apiKey, tfyMetadata,
      messages: fullMessages,
      tools: scopedTools,
      modelId: primary,
      streamDeltas: true,
      res, t0,
    });

    if (first.toolCalls.length > 0) {
      sse(res, "trace", { icon: "🤖", text: `Model requested ${first.toolCalls.length} tool call(s)`, ms: Date.now() - t0 });
    }

    // ── Tool calling loop (up to 3 rounds) ────────────────────────────────────
    if (first.toolCalls.length > 0) {
      let conversationMessages = [
        ...fullMessages,
        {
          role: "assistant",
          content: first.text || null,
          tool_calls: first.toolCalls.map((tc) => ({
            id: tc.id || `call_${Math.random().toString(36).slice(2)}`,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        },
      ];
      let pendingCalls = first.toolCalls;

      for (let round = 0; round < 3; round++) {
        for (const tc of pendingCalls) {
          let args = {};
          try { args = JSON.parse(tc.arguments || "{}"); } catch { args = {}; }

          // Backend injects auth transparently — LLM never provided these
          const needsAuth = authRequired.has(tc.name);
          if (needsAuth) {
            if (apiKey)         args.truefoundry_api_key = apiKey;
            if (controlPlaneUrl) args.control_plane_url  = controlPlaneUrl;
          }

          const userArgKeys = Object.keys(args).filter((k) => !MCP_AUTH_PARAMS.includes(k));
          sse(res, "trace", {
            icon: "🔧",
            text: `MCP call → ${tc.name}(${userArgKeys.map((k) => `${k}: "${String(args[k]).slice(0, 40)}"`).join(", ")})${needsAuth ? " [auth injected]" : ""}`,
            ms: Date.now() - t0,
          });

          if (gp.mcpPre.length > 0) {
            sse(res, "trace", { icon: "🛡️", text: `Pre-invoke guardrails: ${gp.mcpPre.join(", ")}`, ms: Date.now() - t0 });
          }

          const { text: result, denied } = await callMcpTool(tc.name, args);

          if (denied) {
            sse(res, "trace", {
              icon: "🚫",
              text: `MCP: ${tc.name} → access denied (${tier} tier insufficient)`,
              ms: Date.now() - t0,
            });
          } else {
            sse(res, "trace", {
              icon: "📄",
              text: `MCP: ${tc.name} → ${result.length} chars returned`,
              ms: Date.now() - t0,
            });
          }

          if (gp.mcpPost.length > 0) {
            sse(res, "trace", { icon: "🛡️", text: `Post-invoke guardrails: ${gp.mcpPost.join(", ")}`, ms: Date.now() - t0 });
          }

          const callId = tc.id || `call_${Math.random().toString(36).slice(2)}`;
          conversationMessages.push({ role: "tool", tool_call_id: callId, content: result });
        }

        sse(res, "trace", { icon: "💬", text: `Generating final answer with tool results…`, ms: Date.now() - t0 });

        const followUp = await streamGatewayRequest({
          url, apiKey, tfyMetadata,
          messages: conversationMessages,
          tools: scopedTools,
          modelId: primary,
          streamDeltas: true,
          res, t0,
        });

        if (followUp.toolCalls.length === 0 || round === 2) {
          const latencyMs = Date.now() - t0;
          if (gp.output.length > 0) {
            sse(res, "trace", { icon: "🛡️", text: `Output guardrails: ${gp.output.join(", ")} — passed`, ms: latencyMs });
          }
          sse(res, "trace", { icon: "✅", text: `Done — ${followUp.usedModel} (${latencyMs}ms, ${pendingCalls.length} tool call(s))`, ms: latencyMs });
          sse(res, "done", { model: followUp.usedModel, latencyMs, traceId: followUp.traceId });
          res.end();
          return;
        }

        // Chain another round
        pendingCalls = followUp.toolCalls;
        sse(res, "trace", { icon: "🔁", text: `Model chained ${pendingCalls.length} more tool call(s)`, ms: Date.now() - t0 });
        conversationMessages = [
          ...conversationMessages,
          {
            role: "assistant",
            content: followUp.text || null,
            tool_calls: followUp.toolCalls.map((tc) => ({
              id: tc.id || `call_${Math.random().toString(36).slice(2)}`,
              type: "function",
              function: { name: tc.name, arguments: tc.arguments },
            })),
          },
        ];
      }
    }

    // ── No tool calls — direct response ──────────────────────────────────────
    const latencyMs = Date.now() - t0;
    if (gp.output.length > 0) {
      sse(res, "trace", { icon: "🛡️", text: `Output guardrails: ${gp.output.join(", ")} — passed`, ms: latencyMs });
    }
    sse(res, "trace", { icon: "✅", text: `Done — ${first.usedModel} (${latencyMs}ms, no tool calls)`, ms: latencyMs });
    sse(res, "done",  { model: first.usedModel, latencyMs, traceId: first.traceId });

  } catch (err) {
    const rawMsg = err.message || "Gateway request failed.";
    // err.statusText carries the FULL untruncated upstream error body — rawMsg may be
    // truncated (see the `.slice(0, 200)` in streamGatewayRequest), which can cut a JSON
    // error body mid-string and make it unparseable. Always extract from the full text.
    const fullText = err.statusText || rawMsg;
    const lc = fullText.toLowerCase();

    // Extract the meaningful part of a JSON error body embedded in the message
    let cleanMsg = null;
    try {
      const jsonMatch = fullText.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        cleanMsg = parsed.message || parsed.error?.message || null;
      }
    } catch { /* fall through to regex fallback below */ }

    // Fallback: even truncated/malformed JSON usually still has a complete "message" field
    // near the start — pull it out directly with a regex if full JSON.parse failed.
    if (!cleanMsg) {
      const msgMatch = fullText.match(/"message"\s*:\s*"([^"]+)"/);
      cleanMsg = msgMatch?.[1] || rawMsg;
    }

    if (gp.input.length > 0 && (lc.includes("guardrail") || lc.includes("blocked") || lc.includes("content"))) {
      sse(res, "trace", { icon: "🚫", text: `Input blocked by guardrail: ${gp.input.join(", ")}`, ms: Date.now() - t0 });
    } else {
      // Always emit a trace row so the error is visible in the timeline
      const is429 = rawMsg.includes("429") || lc.includes("rate limit");
      sse(res, "trace", { icon: "🚫", text: `${is429 ? "Rate limit: " : "Error: "}${cleanMsg}`, ms: Date.now() - t0 });
    }
    sse(res, "error", { message: cleanMsg });
  } finally {
    res.end();
  }
});

// ── MCP tool counts per tier ──────────────────────────────────────────────────
// Derived purely from the MCP server's tool definitions — no hardcoding.
// Guest = tools with no auth requirement
// Logged-in = guest + tools that need auth but aren't pro-only
// Pro = all tools
router.get("/mcp-tools", async (_req, res) => {
  try {
    const { openaiTools, authRequired } = await fetchMcpToolDefs();
    const counts = { guest: 0, loggedIn: 0, pro: 0 };
    const tools = [];

    for (const tool of openaiTools) {
      const name = tool.function.name;
      const needsAuth = authRequired.has(name);
      const tier = classifyToolTier(tool.function.description, needsAuth);
      if (TOOL_TIER_RANK[tier] <= TOOL_TIER_RANK.guest)    counts.guest++;
      if (TOOL_TIER_RANK[tier] <= TOOL_TIER_RANK.loggedIn) counts.loggedIn++;
      if (TOOL_TIER_RANK[tier] <= TOOL_TIER_RANK.pro)      counts.pro++;
      tools.push({ name, tier });
    }

    res.json({ counts, tools, total: openaiTools.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Per-request model fallback chain (from the gateway's trace spans) ────────
// Surfaces exactly which fallback target served (or attempted to serve) a given
// chat response, in call order, with the gateway's own per-attempt error reason —
// e.g. "Rate limit exceeded for model: openai/gpt-5 with rule: guests".
router.post("/model-trace", async (req, res) => {
  const { traceId, controlPlaneUrl, apiKey, dataRoutingDestination } = req.body;
  if (!traceId || !controlPlaneUrl || !apiKey) {
    return res.status(400).json({ error: "traceId, controlPlaneUrl and apiKey are required." });
  }

  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    const base = controlPlaneUrl.replace(/\/+$/, "");

    const upstream = await fetch(`${base}/api/svc/v1/spans/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dataRoutingDestination: dataRoutingDestination || "default",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        traceIds: [traceId],
        limit: 50,
        sortDirection: "asc",
      }),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Spans query failed (${upstream.status})` });
    }

    const body = await upstream.json();
    const spans = body?.data ?? [];

    const root = spans.find((s) => s.spanAttributes?.["tfy.span_type"] === "ChatCompletion") ?? null;
    const modelSpans = spans
      .filter((s) => s.spanAttributes?.["tfy.span_type"] === "Model")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const attempts = (modelSpans.length > 0 ? modelSpans : root ? [root] : []).map((s, i) => {
      const a = s.spanAttributes ?? {};
      return {
        order: i + 1,
        model: a["tfy.model.name"] ?? null,
        status: s.statusCode === "Error" ? "error" : "ok",
        errorType: a["tfy.error_type"] ?? null,
        errorMessage: a["tfy.error_message"] || null,
      };
    });

    res.json({
      traceId,
      found: !!root || attempts.length > 0,
      resolvedModel: root?.spanAttributes?.["tfy.model.name"] ?? null,
      status: root?.statusCode === "Error" ? "error" : "ok",
      errorMessage: root?.spanAttributes?.["tfy.error_message"] || null,
      requestedFirstTarget: root?.spanAttributes?.["tfy.loadbalance.first_target"] ?? null,
      attempts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch model trace." });
  }
});

export { router as chatRouter };
