import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 12000;
const LIST_LIMIT = 100;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.resolve(__dirname, "../../data/existing-foundry-inventory.snapshot.json");

const INVENTORY_ENDPOINTS = [
  {
    key: "providerAccounts",
    title: "Provider accounts",
    description: "Provider accounts and attached model integrations.",
    method: "GET",
    path: `/api/svc/v1/provider-accounts?limit=${LIST_LIMIT}`,
  },
  {
    key: "modelIntegrations",
    title: "Model integrations",
    description: "All model integrations registered in the tenant.",
    method: "GET",
    path: `/api/svc/v1/provider-integrations?type=model&limit=${LIST_LIMIT * 2}`,
  },
  {
    key: "mcpServers",
    title: "MCP servers",
    description: "MCP Gateway servers available to the token.",
    method: "GET",
    path: `/api/svc/v1/mcp-servers?limit=${LIST_LIMIT}`,
  },
  {
    key: "guardrails",
    title: "Guardrails",
    description: "Gateway guardrail configurations.",
    method: "GET",
    path: `/api/svc/v1/gateway-guardrails-configs?limit=${LIST_LIMIT}`,
    optionalOn404: true,
  },
  {
    key: "routingConfigs",
    title: "Routing configs",
    description: "Gateway load balancing, fallback, retry, and rerouting configuration.",
    method: "GET",
    path: "/api/svc/v1/gateway/configs?type=gateway-load-balancing-config",
    optionalOnFailure: true,
    optionalMessage: "No gateway routing config was returned for this tenant.",
  },
  {
    key: "rateLimitConfigs",
    title: "Rate limits",
    description: "Gateway request and token limits by user, model, virtual account, or metadata.",
    method: "GET",
    path: "/api/svc/v1/gateway/configs?type=gateway-rate-limiting-config",
    optionalOnFailure: true,
    optionalMessage: "No gateway rate limit config was returned for this tenant.",
  },
  {
    key: "budgetConfigs",
    title: "Budget controls",
    description: "Gateway cost budgets, budget scope, audit mode, and alert thresholds.",
    method: "GET",
    path: "/api/svc/v1/gateway/configs?type=gateway-budget-config",
    optionalOnFailure: true,
    optionalMessage: "No gateway budget config was returned for this tenant.",
  },
  {
    key: "virtualAccounts",
    title: "Virtual accounts",
    description: "Virtual accounts and application identities.",
    method: "GET",
    path: `/api/svc/v1/virtual-accounts?limit=${LIST_LIMIT}`,
  },
  {
    key: "personalAccessTokens",
    title: "Personal access tokens",
    description: "Personal access token records visible to the current token.",
    method: "GET",
    path: `/api/svc/v1/personal-access-tokens?limit=${LIST_LIMIT}`,
  },
  {
    key: "workspaces",
    title: "Workspaces",
    description: "TrueFoundry workspaces visible to this account.",
    method: "GET",
    path: `/api/svc/v1/workspaces?limit=${LIST_LIMIT}`,
  },
  {
    key: "clusters",
    title: "Clusters",
    description: "Connected clusters and cluster metadata.",
    method: "GET",
    path: `/api/svc/v1/clusters?limit=${LIST_LIMIT}`,
  },
  {
    key: "teams",
    title: "Teams",
    description: "Teams available for access control.",
    method: "GET",
    path: `/api/svc/v1/teams?limit=${LIST_LIMIT}`,
    optionalOn404: true,
  },
  {
    key: "secretGroups",
    title: "Secret groups",
    description: "Secret group names and metadata. Secret values are redacted.",
    method: "GET",
    path: `/api/svc/v1/secret-groups?limit=${LIST_LIMIT}`,
  },
  {
    key: "applications",
    title: "Applications",
    description: "Applications visible across the tenant or selected workspace scope.",
    method: "GET",
    path: `/api/svc/v1/apps?limit=${LIST_LIMIT}`,
    optionalOn404: true,
  },
  {
    key: "agents",
    title: "Agents",
    description: "TrueFoundry Agent Registry entries visible to this token.",
    method: "GET",
    path: `/api/svc/v1/agents?limit=${LIST_LIMIT}`,
  },
  {
    key: "prompts",
    title: "Prompts",
    description: "Prompt Registry entries visible to this token.",
    method: "GET",
    path: `/api/ml/v1/prompts?limit=${LIST_LIMIT}`,
  },
  {
    key: "tracingProjects",
    title: "Tracing projects",
    description: "Tracing projects used for Gateway observability.",
    method: "GET",
    path: `/api/svc/v1/tracing-projects?limit=${LIST_LIMIT}`,
  },
];

function normalizeUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    const error = new Error(`${label} must be a valid URL.`);
    error.status = 400;
    throw error;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    const error = new Error(`${label} must use http or https.`);
    error.status = 400;
    throw error;
  }

  return url.toString().replace(/\/+$/, "");
}

function joinUrl(baseUrl, path) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function startOfDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

async function fetchJson({ url, apiKey, method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const parsed = text ? parseJson(text) : null;

    if (!response.ok) {
      const error = new Error(extractErrorMessage(parsed, response.statusText));
      error.status = response.status;
      error.payload = parsed;
      throw error;
    }

    return parsed;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("TrueFoundry request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function extractErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback || "Request failed.";
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.detail === "string") return payload.detail;
  return fallback || "Request failed.";
}

function getRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return payload ? [payload] : [];
}

function countRecords(payload) {
  const paginationTotal = payload?.pagination?.total;
  if (typeof paginationTotal === "number") return paginationTotal;
  return getRecords(payload).length;
}

function redactSensitive(value, parentKey = "") {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, parentKey));
  }

  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (isSensitiveKey(key) || isSensitiveKey(parentKey)) {
        return [key, "[redacted]"];
      }

      return [key, redactSensitive(entry, key)];
    }),
  );
}

function isSensitiveKey(key) {
  return /(^|_|\b)(authorization|auth_data|api_?key|access_?token|refresh_?token|bearer|credential|client_?secret|password|secret|token|value)$/i.test(key);
}

async function runSection({ controlPlaneUrl, apiKey, section }) {
  try {
    const raw = await fetchJson({
      url: joinUrl(controlPlaneUrl, section.path),
      apiKey,
      method: section.method,
      body: section.body,
    });

    const sanitized = redactSensitive(raw);
    return {
      key: section.key,
      title: section.title,
      description: section.description,
      status: "ok",
      count: countRecords(raw),
      records: redactSensitive(getRecords(raw)),
      raw: sanitized,
    };
  } catch (error) {
    if ((section.optionalOn404 && error.status === 404) || section.optionalOnFailure) {
      return {
        key: section.key,
        title: section.title,
        description: section.description,
        status: "ok",
        count: 0,
        records: [],
        raw: {
          data: [],
          unavailable: true,
          message: section.optionalMessage || "This optional TrueFoundry API is not available on this tenant.",
        },
      };
    }

    return {
      key: section.key,
      title: section.title,
      description: section.description,
      status: "error",
      count: 0,
      error: {
        status: error.status || 500,
        message: error.message || "Unable to fetch this section.",
      },
    };
  }
}

async function runGatewaySection({ apiKey, gatewayBaseUrl, controlPlaneUrl }) {
  const urls = [
    joinUrl(gatewayBaseUrl, "/models"),
    joinUrl(controlPlaneUrl, "/api/llm/models"),
  ];

  let lastError = null;
  for (const url of [...new Set(urls)]) {
    try {
      const raw = await fetchJson({ url, apiKey });
      return {
        key: "availableModels",
        title: "Callable models",
        description: "OpenAI-compatible models this token can call through AI Gateway.",
        status: "ok",
        count: countRecords(raw),
        records: redactSensitive(getRecords(raw)),
        raw: redactSensitive(raw),
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    key: "availableModels",
    title: "Callable models",
    description: "OpenAI-compatible models this token can call through AI Gateway.",
    status: "error",
    count: 0,
    error: {
      status: lastError?.status || 500,
      message: lastError?.message || "Unable to list callable models.",
    },
  };
}

async function runGatewayHealth({ apiKey, gatewayBaseUrl, controlPlaneUrl }) {
  const urls = [
    joinUrl(gatewayBaseUrl, "/health"),
    joinUrl(controlPlaneUrl, "/api/llm/health"),
  ];

  let lastError = null;
  for (const url of [...new Set(urls)]) {
    try {
      const raw = await fetchJson({ url, apiKey, timeoutMs: 8000 });
      return {
        key: "gatewayHealth",
        title: "Gateway health",
        description: "AI Gateway health response.",
        status: "ok",
        count: 1,
        records: [redactSensitive(raw)],
        raw: redactSensitive(raw),
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    key: "gatewayHealth",
    title: "Gateway health",
    description: "AI Gateway health response.",
    status: "error",
    count: 0,
    error: {
      status: lastError?.status || 500,
      message: lastError?.message || "Unable to reach the AI Gateway health endpoint.",
    },
  };
}

function metricsSection({ key, title, groupBy, startTs, endTs }) {
  return {
    key,
    title,
    description: `Gateway usage ledger grouped by ${groupBy.join(", ")} for the last 30 days.`,
    method: "POST",
    path: "/api/svc/v1/llm-gateway/metrics/query",
    body: {
      startTs,
      endTs,
      datasource: "modelMetrics",
      type: "distribution",
      aggregations: [
        { type: "count", column: "costInUSD" },
        { type: "sum", column: "costInUSD" },
        { type: "sum", column: "inputTokens" },
        { type: "sum", column: "outputTokens" },
        { type: "p90", column: "latencyMs" },
      ],
      groupBy,
    },
    optionalOnFailure: true,
    optionalMessage: "No usage ledger data returned in time for this tenant.",
  };
}

function recentRequestsSection({ startTime, dataRoutingDestination }) {
  return {
    key: "recentRequestsLedger",
    title: "Recent request ledger",
    description: "Recent Gateway request traces from the selected data routing destination.",
    method: "POST",
    path: "/api/svc/v1/spans/query",
    body: {
      dataRoutingDestination,
      startTime,
      limit: 20,
      sortDirection: "desc",
    },
    optionalOnFailure: true,
    optionalMessage: "No recent request ledger data returned in time for this destination.",
  };
}

function buildHighlights(sections) {
  const byKey = Object.fromEntries(sections.map((section) => [section.key, section]));

  return {
    models: byKey.availableModels?.count || byKey.modelIntegrations?.count || 0,
    providerAccounts: byKey.providerAccounts?.count || 0,
    mcpServers: byKey.mcpServers?.count || 0,
    guardrails: byKey.guardrails?.count || 0,
    workspaces: byKey.workspaces?.count || 0,
    ledgers: [
      byKey.modelUsageLedger?.status === "ok",
      byKey.userUsageLedger?.status === "ok",
      byKey.recentRequestsLedger?.status === "ok",
    ].filter(Boolean).length,
  };
}

async function saveInventorySnapshot(payload) {
  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function getSavedExistingFoundryInventory() {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  } catch (error) {
    const notFound = new Error("No saved Foundry inventory snapshot exists yet. Run Fetch Foundry inventory once first.");
    notFound.status = error.code === "ENOENT" ? 404 : 500;
    throw notFound;
  }
}

export async function connectExistingFoundryUser(input) {
  const controlPlaneUrl = normalizeUrl(input.controlPlaneUrl, "Control plane URL");
  const gatewayBaseUrl = input.gatewayBaseUrl
    ? normalizeUrl(input.gatewayBaseUrl, "Gateway base URL")
    : joinUrl(controlPlaneUrl, "/api/llm");
  const dataRoutingDestination = input.dataRoutingDestination || "default";
  const endTs = new Date().toISOString();
  const start30Ts = startOfDaysAgo(30);
  const start7Ts = startOfDaysAgo(7);

  const sections = await Promise.all([
    runGatewayHealth({ apiKey: input.apiKey, gatewayBaseUrl, controlPlaneUrl }),
    runGatewaySection({ apiKey: input.apiKey, gatewayBaseUrl, controlPlaneUrl }),
    ...INVENTORY_ENDPOINTS.map((section) => runSection({
      controlPlaneUrl,
      apiKey: input.apiKey,
      section,
    })),
    runSection({
      controlPlaneUrl,
      apiKey: input.apiKey,
      section: metricsSection({
        key: "modelUsageLedger",
        title: "Model usage ledger",
        groupBy: ["modelName"],
        startTs: start30Ts,
        endTs,
      }),
    }),
    runSection({
      controlPlaneUrl,
      apiKey: input.apiKey,
      section: metricsSection({
        key: "userUsageLedger",
        title: "User usage ledger",
        groupBy: ["userEmail"],
        startTs: start30Ts,
        endTs,
      }),
    }),
    runSection({
      controlPlaneUrl,
      apiKey: input.apiKey,
      section: recentRequestsSection({
        startTime: start7Ts,
        dataRoutingDestination,
      }),
    }),
  ]);

  const okSections = sections.filter((section) => section.status === "ok").length;
  const failedSections = sections.length - okSections;
  const connected = okSections > 0 && sections.some((section) => section.key === "availableModels" || section.key === "providerAccounts");

  const result = {
    connected,
    connection: {
      status: failedSections === 0 ? "connected" : connected ? "partial" : "failed",
      checkedAt: endTs,
      controlPlaneUrl,
      gatewayBaseUrl,
      dataRoutingDestination,
      okSections,
      failedSections,
    },
    credentialHandling: {
      stored: false,
      message: "The PAT/VAT was used only for this inventory request and was not stored by ChatDock.",
    },
    highlights: buildHighlights(sections),
    sections,
  };

  await saveInventorySnapshot(result);
  return result;
}
