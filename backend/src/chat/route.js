import { Router } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();

const SNAPSHOT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/existing-foundry-inventory.snapshot.json"
);

let _guardrailCache = null;
async function getGuardrailPolicy() {
  if (_guardrailCache !== null) return _guardrailCache;
  try {
    const data = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
    const gwSection = data.sections?.find((s) => s.key === "guardrailPolicy");
    const policy = gwSection?.raw?.manifest?.default ?? {};
    _guardrailCache = {
      input:   (policy.llm_input_guardrails               ?? []),
      output:  (policy.llm_output_guardrails              ?? []),
      mcpPre:  (policy.mcp_tool_pre_invoke_guardrails     ?? []),
      mcpPost: (policy.mcp_tool_post_invoke_guardrails    ?? []),
    };
  } catch {
    _guardrailCache = { input: [], output: [], mcpPre: [], mcpPost: [] };
  }
  return _guardrailCache;
}

const CHAOS = {
  "rate-limit":    { icon: "🔴", label: "429 Rate limited",           delayMs: 140 },
  "kill-primary":  { icon: "🔴", label: "503 Provider unavailable",   delayMs: 220 },
  "slow":          { icon: "🟡", label: "Response timeout after 3.1s", delayMs: 3100 },
};

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const TIER_RULE_ID  = { guest: "guests", loggedIn: "logged-in", pro: "pro" };
const TIER_LABELS   = { guest: "Guest", loggedIn: "Logged-in", pro: "Pro" };

router.post("/", async (req, res) => {
  const { messages, gatewayUrl, modelId, apiKey, chaosMode, primaryModelLabel, fallbackModelLabel, userTier } = req.body;

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
  const gp = await getGuardrailPolicy();

  try {
    sse(res, "trace", { icon: "🔵", text: `Request received → ${primary}`, ms: 0 });

    if (chaosMode && CHAOS[chaosMode]) {
      const c = CHAOS[chaosMode];
      if (chaosMode === "slow") {
        sse(res, "trace", { icon: "🟡", text: `Primary responding slowly…`, ms: Date.now() - t0 });
        await new Promise((r) => setTimeout(r, c.delayMs));
      } else {
        sse(res, "trace", { icon: "⚡", text: `Calling ${primary}…`, ms: Date.now() - t0 });
        await new Promise((r) => setTimeout(r, c.delayMs));
      }
      sse(res, "trace", { icon: c.icon, text: `${primary} → ${c.label}  (${Date.now() - t0}ms)`, ms: Date.now() - t0 });
      sse(res, "trace", { icon: "↩", text: `Falling back to ${fallback}`, ms: Date.now() - t0 });
    } else {
      sse(res, "trace", { icon: "⚡", text: `Calling ${primary}…`, ms: Date.now() - t0 });
    }

    // Real LLM call via TrueFoundry gateway
    const url = `${gatewayUrl.replace(/\/+$/, "")}/chat/completions`;
    const ruleId = (userTier && TIER_RULE_ID[userTier]) || "guests";
    const tfyMetadata = JSON.stringify({ userId: `sim-${userTier || "guest"}`, user_tier: ruleId });

    sse(res, "trace", { icon: "👤", text: `Tier: ${TIER_LABELS[userTier] || "Guest"} → rule: ${ruleId}`, ms: Date.now() - t0 });

    if (gp.input.length > 0) {
      sse(res, "trace", { icon: "🛡️", text: `llm_input → ${gp.input.join(", ")}`, ms: Date.now() - t0 });
    }

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-TFY-METADATA": tfyMetadata,
      },
      body: JSON.stringify({ model: modelId, messages, stream: true }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      const lc = text.toLowerCase();
      if (gp.input.length > 0 && (lc.includes("guardrail") || lc.includes("blocked") || lc.includes("content") || upstream.status === 400)) {
        sse(res, "trace", { icon: "🚫", text: `llm_input blocked by: ${gp.input.join(", ")}`, ms: Date.now() - t0 });
      }
      throw new Error(`Gateway returned ${upstream.status}: ${text.slice(0, 200)}`);
    }

    // Stream SSE deltas
    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let usedModel = chaosMode ? fallback : primary;

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
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) sse(res, "delta", { content: delta });
          if (chunk.model) usedModel = chunk.model;
        } catch { /* skip malformed */ }
      }
    }

    const latencyMs = Date.now() - t0;
    if (gp.output.length > 0) {
      sse(res, "trace", { icon: "🛡️", text: `llm_output → ${gp.output.join(", ")} — passed`, ms: latencyMs });
    }
    sse(res, "trace", { icon: "✅", text: `Response from ${usedModel}  (${latencyMs}ms total)`, ms: latencyMs });
    sse(res, "done",  { model: usedModel, latencyMs });

  } catch (err) {
    sse(res, "error", { message: err.message || "Gateway request failed." });
  } finally {
    res.end();
  }
});

export { router as chatRouter };
