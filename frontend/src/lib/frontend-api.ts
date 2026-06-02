import type {
  GenerateBotResponse,
  GenerateMode,
  HealthResponse,
} from "./chatbot-types";

type JsonBody = Record<string, unknown>;

function waitForDemoData() {
  return new Promise((resolve) => window.setTimeout(resolve, 250));
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "website-assistant";
}

function demoBotName(mode: GenerateMode, payload: JsonBody) {
  if (typeof payload.bot_name === "string" && payload.bot_name.trim()) {
    return slugify(payload.bot_name);
  }

  if (mode === "docs") return "developer-docs-guide";
  if (mode === "helpdesk") return "campus-helpdesk-agent";
  return "website-support-bot";
}

export async function fetchHealth() {
  await waitForDemoData();
  return {
    status: "ok",
    service: "chatdock-frontend-demo",
    version: "static",
  } satisfies HealthResponse;
}

export async function generateBot(mode: GenerateMode, payload: JsonBody) {
  await waitForDemoData();

  const botName = demoBotName(mode, payload);
  return {
    bot_name: botName,
    output_path: null,
    zip_path: null,
    warnings: ["Frontend-only demo data. No backend request was made."],
    source_metadata: {
      mode,
      demo: true,
      product: "ChatDock",
      audience: payload.audience ?? "website visitors",
    },
    files: [
      {
        relative_path: "chatdock.config.json",
        content:
          `{\n` +
          `  "name": "${botName}",\n` +
          `  "gateway": "truefoundry-ai-gateway",\n` +
          `  "fallback": true,\n` +
          `  "guardrails": ["PII redaction", "tool validation"]\n` +
          `}\n`,
      },
      {
        relative_path: "demo-trace.md",
        content:
          "# Demo Trace\n\nThis helper returns representative ChatDock files for frontend previews.\n",
      },
    ],
  } satisfies GenerateBotResponse;
}
