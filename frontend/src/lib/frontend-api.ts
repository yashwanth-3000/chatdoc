import type {
  ExistingFoundryConnectPayload,
  ExistingFoundryConnectResponse,
  GenerateBotResponse,
  GenerateMode,
  HealthResponse,
} from "./chatbot-types";

type JsonBody = Record<string, unknown>;

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_CHATDOCK_BACKEND_URL || "http://localhost:4000"
).trim().replace(/\/+$/, "");

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

async function fetchBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : "The ChatDock backend did not accept the request.";
    throw new Error(message);
  }

  return payload as T;
}

export async function connectExistingFoundryUser(
  payload: ExistingFoundryConnectPayload,
) {
  return fetchBackend<ExistingFoundryConnectResponse>(
    "/api/existing-foundry-user/connect",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchSavedExistingFoundryInventory() {
  return fetchBackend<ExistingFoundryConnectResponse>(
    "/api/existing-foundry-user/saved-inventory",
  );
}

// Judge/demo mode - the backend connects with ChatDock's own TrueFoundry
// credentials (env vars on the server). The browser stores this sentinel in
// place of an API key; the real key never reaches the frontend.
export const DEMO_API_KEY_SENTINEL = "__chatdock_demo__";

export async function fetchDemoAvailability() {
  return fetchBackend<{
    available: boolean;
    controlPlaneUrl?: string;
    gatewayUrl?: string;
    modelId?: string;
  }>("/api/existing-foundry-user/demo-availability");
}

export async function connectDemoFoundry() {
  return fetchBackend<ExistingFoundryConnectResponse>(
    "/api/existing-foundry-user/demo-connect",
    { method: "POST", body: "{}" },
  );
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
