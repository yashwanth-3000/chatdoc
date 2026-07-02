"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./chatbot-builder.module.css";
import { ConfigViewer } from "./config-viewer";
import { fetchHealth } from "@/lib/frontend-api";
import type { GenerateBotResponse } from "@/lib/chatbot-types";

type BotForm = {
  botName: string;
  business: string;
  goal: string;
  tone: string;
  position: "bottom-right" | "bottom-left" | "inline";
  primaryModel: string;
  fallbackModel: string;
  routingMode: "priority" | "weighted" | "latency";
  dailyBudget: string;
  rateLimit: string;
  tools: string[];
  guardrails: string[];
};

const toolOptions = [
  "docs.search",
  "linear.create_ticket",
  "billing.lookup_plan",
  "calendar.find_slot",
  "github.search_issues",
  "crm.lookup_customer",
];

const guardrailOptions = [
  "PII redaction",
  "Unsafe input block",
  "Tool argument validation",
  "Tool result inspection",
  "Budget exceeded block",
  "Profanity validation",
];

const initialForm: BotForm = {
  botName: "ChatDock Assistant",
  business: "B2B SaaS - chat widget platform for AI-powered customer support",
  goal: "Help visitors choose a ChatDock plan, answer product and pricing questions, and guide them through integration.",
  tone: "calm, concise, helpful",
  position: "bottom-right",
  primaryModel: "bedrock/deepseek-v3",
  fallbackModel: "openai/gpt-5.5",
  routingMode: "priority",
  dailyBudget: "50",
  rateLimit: "10 requests per minute",
  tools: ["docs.search", "linear.create_ticket", "billing.lookup_plan"],
  guardrails: ["PII redaction", "Unsafe input block", "Tool argument validation", "Tool result inspection"],
};

function buildBotSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "website-assistant";
}

function buildResult(form: BotForm): GenerateBotResponse {
  const slug = buildBotSlug(form.botName);
  const allowedTools = form.tools.join(", ") || "none selected";
  const guardrails = form.guardrails.join(", ") || "none selected";

  return {
    bot_name: slug,
    output_path: null,
    zip_path: null,
    warnings: ["Frontend demo configuration. Wire these settings to TrueFoundry before production use."],
    source_metadata: {
      product: "ChatDock",
      business: form.business,
      routing_mode: form.routingMode,
      primary_model: form.primaryModel,
      fallback_model: form.fallbackModel,
      budget_usd_per_day: form.dailyBudget,
    },
    files: [
      {
        relative_path: "chatdock.config.json",
        content: JSON.stringify(
          {
            name: form.botName,
            business: form.business,
            goal: form.goal,
            widget: {
              position: form.position,
              tone: form.tone,
              launcherLabel: "AI",
            },
            truefoundry: {
              aiGateway: {
                virtualModel: "prod-support",
                routingMode: form.routingMode,
                primary: form.primaryModel,
                fallback: form.fallbackModel,
                rateLimit: form.rateLimit,
                dailyBudgetUsd: Number(form.dailyBudget) || 0,
              },
              mcpGateway: {
                allowedTools: form.tools,
                disabledExamples: ["linear.delete_attachment", "crm.delete_contact"],
              },
              guardrails: form.guardrails,
            },
          },
          null,
          2,
        ),
      },
      {
        relative_path: "embed.js",
        content:
          `// ChatDock website embed\n` +
          `window.ChatDock = window.ChatDock || {};\n` +
          `window.ChatDock.mount({\n` +
          `  bot: "${slug}",\n` +
          `  position: "${form.position}",\n` +
          `  gateway: "/api/chatdock/${slug}",\n` +
          `  traceRecovery: true\n` +
          `});\n`,
      },
      {
        relative_path: "guardrails.md",
        content:
          `# Guardrails\n\n` +
          `Configured checks: ${guardrails}.\n\n` +
          `- Mutate sensitive data before LLM calls when PII is found.\n` +
          `- Reject unsafe visitor input before it reaches the model.\n` +
          `- Validate MCP tool arguments before execution.\n` +
          `- Inspect tool output before returning it to the assistant.\n`,
      },
      {
        relative_path: "demo-trace.md",
        content:
          `# Demo Trace\n\n` +
          `1. Visitor asks a support question on the website.\n` +
          `2. ${form.primaryModel} hits a simulated rate-limit policy.\n` +
          `3. TrueFoundry AI Gateway retries through ${form.fallbackModel}.\n` +
          `4. MCP Gateway exposes only these tools: ${allowedTools}.\n` +
          `5. Guardrails run before model calls and around tool calls.\n` +
          `6. ChatDock preserves state and shows the recovery trace.\n`,
      },
    ],
  };
}

function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`${styles.checkOption} ${checked ? styles.checkOptionOn : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function ChatbotBuilder() {
  const [form, setForm] = useState<BotForm>(initialForm);
  const [health, setHealth] = useState("checking");
  const [result, setResult] = useState<GenerateBotResponse>(() => buildResult(initialForm));

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((response) => {
        if (!cancelled) setHealth(response.status === "ok" ? "ready" : "offline");
      })
      .catch(() => {
        if (!cancelled) setHealth("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedGuardrailSummary = useMemo(
    () => form.guardrails.slice(0, 3).join(" / ") || "No guardrails selected",
    [form.guardrails],
  );

  function updateField<K extends keyof BotForm>(key: K, value: BotForm[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      setResult(buildResult(next));
      return next;
    });
  }

  function toggleValue(key: "tools" | "guardrails", value: string, checked: boolean) {
    setForm((current) => {
      const set = new Set(current[key]);
      if (checked) set.add(value);
      else set.delete(value);
      const next = { ...current, [key]: Array.from(set) };
      setResult(buildResult(next));
      return next;
    });
  }

  return (
    <div className={styles.builder}>
      <section className={styles.header}>
        <div>
          <p className={styles.kicker}>Chatbot builder</p>
          <h1>Configure a resilient website assistant.</h1>
          <p>
            Shape the widget, route models through TrueFoundry, scope MCP tools,
            add guardrails, and generate the files your demo needs.
          </p>
        </div>
        <div className={styles.statusPanel}>
          <span className={`${styles.statusDot} ${styles[`status_${health}`]}`} />
          <div>
            <strong>{health === "checking" ? "Checking" : health}</strong>
            <small>frontend demo service</small>
          </div>
        </div>
      </section>

      <section className={styles.workspace}>
        <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
          <div className={styles.formSection}>
            <div className={styles.sectionHeader}>
              <span>01</span>
              <h2>Assistant identity</h2>
            </div>
            <label className={styles.field}>
              <span>Bot name</span>
              <input
                value={form.botName}
                onChange={(event) => updateField("botName", event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Website or business</span>
              <input
                value={form.business}
                onChange={(event) => updateField("business", event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Assistant goal</span>
              <textarea
                rows={3}
                value={form.goal}
                onChange={(event) => updateField("goal", event.target.value)}
              />
            </label>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Tone</span>
                <input
                  value={form.tone}
                  onChange={(event) => updateField("tone", event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Widget position</span>
                <select
                  value={form.position}
                  onChange={(event) => updateField("position", event.target.value as BotForm["position"])}
                >
                  <option value="bottom-right">Bottom right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="inline">Inline block</option>
                </select>
              </label>
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.sectionHeader}>
              <span>02</span>
              <h2>AI Gateway route</h2>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Primary model</span>
                <input
                  value={form.primaryModel}
                  onChange={(event) => updateField("primaryModel", event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Fallback model</span>
                <input
                  value={form.fallbackModel}
                  onChange={(event) => updateField("fallbackModel", event.target.value)}
                />
              </label>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Routing mode</span>
                <select
                  value={form.routingMode}
                  onChange={(event) => updateField("routingMode", event.target.value as BotForm["routingMode"])}
                >
                  <option value="priority">Priority fallback</option>
                  <option value="weighted">Weighted traffic split</option>
                  <option value="latency">Latency aware</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Rate limit</span>
                <input
                  value={form.rateLimit}
                  onChange={(event) => updateField("rateLimit", event.target.value)}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Daily budget cap in USD</span>
              <input
                inputMode="numeric"
                value={form.dailyBudget}
                onChange={(event) => updateField("dailyBudget", event.target.value)}
              />
            </label>
          </div>

          <div className={styles.formSection}>
            <div className={styles.sectionHeader}>
              <span>03</span>
              <h2>Tools and guardrails</h2>
            </div>
            <div className={styles.optionBlock}>
              <p>Allowed MCP tools</p>
              <div className={styles.optionGrid}>
                {toolOptions.map((tool) => (
                  <CheckOption
                    key={tool}
                    label={tool}
                    checked={form.tools.includes(tool)}
                    onChange={(checked) => toggleValue("tools", tool, checked)}
                  />
                ))}
              </div>
            </div>
            <div className={styles.optionBlock}>
              <p>Guardrails</p>
              <div className={styles.optionGrid}>
                {guardrailOptions.map((guardrail) => (
                  <CheckOption
                    key={guardrail}
                    label={guardrail}
                    checked={form.guardrails.includes(guardrail)}
                    onChange={(checked) => toggleValue("guardrails", guardrail, checked)}
                  />
                ))}
              </div>
            </div>
          </div>
        </form>

        <aside className={styles.previewColumn}>
          <div className={styles.widgetCard}>
            <div className={styles.widgetHeader}>
              <div>
                <span>Live widget</span>
                <strong>{form.botName || "Untitled bot"}</strong>
              </div>
              <em>{form.position}</em>
            </div>
            <div className={styles.websiteMock}>
              <span />
              <span />
              <span />
              <div className={styles.messageMock}>
                <p>Hi, I can help with plans, docs, and support tickets.</p>
                <small>{selectedGuardrailSummary}</small>
              </div>
              <div className={styles.launcherMock}>AI</div>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <div>
              <span>Fallback route</span>
              <strong>{form.primaryModel} {"->"} {form.fallbackModel}</strong>
            </div>
            <div>
              <span>Budget policy</span>
              <strong>${form.dailyBudget || "0"} per day, {form.rateLimit}</strong>
            </div>
            <div>
              <span>Tool surface</span>
              <strong>{form.tools.length} allowed tools</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.outputSection}>
        <div className={styles.outputHeader}>
          <div>
            <p className={styles.kicker}>Generated output</p>
            <h2>Config, embed script, guardrails, and demo trace.</h2>
          </div>
        </div>
        <ConfigViewer
          files={result.files}
          botName={result.bot_name}
          downloadFileUrl={() => "#"}
        />
      </section>
    </div>
  );
}
