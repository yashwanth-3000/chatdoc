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
    // Correct path: /api/svc/v1/llm-gateway/mcp-servers (not /api/svc/v1/mcp-servers)
    path: `/api/svc/v1/llm-gateway/mcp-servers?limit=${LIST_LIMIT}`,
    softFail: true,
  },
  {
    key: "guardrails",
    title: "Guardrails",
    description: "Guardrail config groups and their individual integrations (content moderation, PII, SQL sanitizer, etc.).",
    method: "GET",
    path: `/api/svc/v1/provider-accounts?limit=${LIST_LIMIT}`,
    filterFn: (record) => record?.manifest?.type === "provider-account/guardrail-config-group",
    expandIntegrations: true,
    softFail: true,
  },
  {
    key: "routingConfigs",
    title: "Routing configs",
    description: "Virtual model routing: load balancing, fallback, retry, and rerouting configuration.",
    method: "GET",
    // Virtual models live in provider accounts filtered by manifest.type === "provider-account/virtual-model"
    path: `/api/svc/v1/provider-accounts?limit=${LIST_LIMIT}`,
    filterFn: (record) => record?.manifest?.type === "provider-account/virtual-model",
    softFail: true,
  },
  {
    key: "rateLimitConfigs",
    title: "Rate limits",
    description: "Gateway request and token limits by user, model, virtual account, or metadata.",
    method: "GET",
    // TrueFoundry SDK path: /api/svc/v1/llm-gateway/config/{type} with lowercase type
    // Returns a single config object { id, tenantName, type, manifest: { rules: [...] } }
    path: "/api/svc/v1/llm-gateway/config/gateway-rate-limiting-config",
    softFail: true,
    gatewayConfig: true,
  },
  {
    key: "budgetConfigs",
    title: "Budget controls",
    description: "Gateway cost budgets, budget scope, audit mode, and alert thresholds.",
    method: "GET",
    // TrueFoundry SDK path: /api/svc/v1/llm-gateway/config/{type} with lowercase type
    path: "/api/svc/v1/llm-gateway/config/gateway-budget-config",
    softFail: true,
    gatewayConfig: true,
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
    // Correct path per TrueFoundry API docs — tracing uses /api/ml/v1/, not /api/svc/v1/
    path: `/api/ml/v1/tracing-projects?limit=${LIST_LIMIT}`,
    softFail: true,
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
    // 200 with empty body means "resource exists but no config saved yet"
    const parsed = (text && text.trim()) ? parseJson(text) : null;

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
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.configs)) return payload.configs;
  if (Array.isArray(payload.servers)) return payload.servers;            // llm-gateway/mcp-servers
  if (payload.manifest && Array.isArray(payload.manifest.rules)) return payload.manifest.rules;  // llm-gateway/config/* with rules
  if (payload.manifest && Array.isArray(payload.manifest.guardrails)) return payload.manifest.guardrails;
  if (Array.isArray(payload.rules)) return payload.rules;
  return [payload];
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
  const url = joinUrl(controlPlaneUrl, section.path);
  try {
    const raw = await fetchJson({ url, apiKey, method: section.method, body: section.body });
    // null = 200 with empty body → resource exists but no config saved yet
    if (raw === null) {
      return {
        key: section.key,
        title: section.title,
        description: section.description,
        status: "ok",
        count: 0,
        records: [],
        raw: { data: [], notConfigured: true, message: "No configuration found for this resource on your tenant." },
        resolvedPath: section.path,
      };
    }
    const allRecords = getRecords(raw);
    // Apply client-side filter if defined (e.g. virtual models from provider accounts)
    let records = section.filterFn ? allRecords.filter(section.filterFn) : allRecords;
    // Expand integrations if flagged (e.g. guardrail-config-group → individual integrations)
    if (section.expandIntegrations) {
      records = records.flatMap((r) => r.integrations ?? []);
    }
    const sanitized = redactSensitive(raw);
    return {
      key: section.key,
      title: section.title,
      description: section.description,
      status: "ok",
      count: records.length,
      records: redactSensitive(records),
      raw: sanitized,
      resolvedPath: section.path,
    };
  } catch (err) {
    const isNotFound = err.status === 404;
    const isPermission = err.status === 401 || err.status === 403;

    if (section.softFail || section.optionalOn404 || section.optionalOnFailure) {
      // 404 = not configured yet → show 0 (ok, no policies yet)
      if (isNotFound) {
        return {
          key: section.key,
          title: section.title,
          description: section.description,
          status: "ok",
          count: 0,
          records: [],
          raw: { data: [], notConfigured: true, message: "No configuration found for this resource on your tenant." },
        };
      }

      // Permission error or server error → show ! with details
      const hint = isPermission
        ? `Permission denied (HTTP ${err.status}). Your API token (PAT/VAT) may not have read access to this resource. Check your role bindings in the TrueFoundry dashboard.`
        : `Request failed with HTTP ${err.status ?? "?"}: ${err.message || "unknown error"}. Check your control-plane URL and API key.`;

      return {
        key: section.key,
        title: section.title,
        description: section.description,
        status: "unavailable",
        count: 0,
        records: [],
        raw: { data: [], unavailable: true, hint, triedPath: url, httpStatus: err.status, errors: [{ path: section.path, status: err.status, message: err.message }] },
      };
    }

    return {
      key: section.key,
      title: section.title,
      description: section.description,
      status: "error",
      count: 0,
      error: {
        status: err.status || 500,
        message: err.message || "Unable to fetch this section.",
      },
    };
  }
}

async function runGatewaySection({ apiKey, gatewayBaseUrl, controlPlaneUrl }) {
  const urls = [
    joinUrl(gatewayBaseUrl, "/models"),
    joinUrl(controlPlaneUrl, "/api/llm/models"),
    // virtual models (provider-registered models visible to this key)
    joinUrl(controlPlaneUrl, "/api/svc/v1/llm-gateway/virtual-models"),
    joinUrl(controlPlaneUrl, "/api/svc/v1/gateway/virtual-models"),
    joinUrl(gatewayBaseUrl, "/v1/models"),
  ];

  let lastError = null;
  for (const url of [...new Set(urls)]) {
    try {
      const raw = await fetchJson({ url, apiKey });
      // Normalize: OpenAI /models returns { data: [...] }, virtual-models may return { data: [...] } or []
      const records = getRecords(raw);
      if (records.length === 0 && url.includes("virtual-models")) continue; // try next
      return {
        key: "availableModels",
        title: "Callable models",
        description: "OpenAI-compatible models this token can call through AI Gateway.",
        status: "ok",
        count: countRecords(raw),
        records: redactSensitive(records),
        raw: redactSensitive(raw),
        resolvedUrl: url,
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

// Internal: apply guardrail policy using an already-loaded snapshot object.
// Returns { applied, policy } on success or { applied: false, reason } on soft failure.
async function _applyGuardrailPolicyFromSnapshot(snapshot, apiKey, controlPlaneUrl) {
  const guardrailSection = snapshot.sections?.find((s) => s.key === "guardrails");
  const records = guardrailSection?.records ?? [];
  const contentRec = records.find((r) => r.name === "content-moderation");
  const sqlRec     = records.find((r) => r.name === "sql-sanitizer");

  if (!contentRec && !sqlRec) {
    return { applied: false, reason: "No guardrail integrations found in inventory." };
  }

  const llmGuardrails = contentRec ? [contentRec.fqn] : [];
  const mcpGuardrails = sqlRec     ? [sqlRec.fqn]     : [];

  const policyManifest = {
    default: {
      llm_input_guardrails:            llmGuardrails,
      llm_output_guardrails:           llmGuardrails,
      mcp_tool_pre_invoke_guardrails:  mcpGuardrails,
      mcp_tool_post_invoke_guardrails: [],
    },
  };

  const url = joinUrl(controlPlaneUrl, "/api/svc/v1/llm-gateway/config/gateway-guardrails-config");
  try {
    await fetchJson({ url, apiKey, method: "PUT", body: { manifest: policyManifest } });
  } catch (err) {
    return { applied: false, reason: `TrueFoundry rejected the guardrail policy: ${err.message}` };
  }

  // Store readable display names (not full FQNs) in the snapshot so trace labels stay short
  const resolvedPolicy = {
    default: {
      llm_input_guardrails:            contentRec ? [contentRec.name] : [],
      llm_output_guardrails:           contentRec ? [contentRec.name] : [],
      mcp_tool_pre_invoke_guardrails:  sqlRec     ? [sqlRec.name]     : [],
      mcp_tool_post_invoke_guardrails: [],
    },
  };

  const policySection = {
    key: "guardrailPolicy",
    title: "Gateway guardrail policy",
    description: "Active guardrail policy attached to the AI Gateway (input, output, MCP).",
    status: "ok",
    count: llmGuardrails.length + mcpGuardrails.length,
    records: [],
    raw: { manifest: resolvedPolicy },
    resolvedPath: "/api/svc/v1/llm-gateway/config/gateway-guardrails-config",
    appliedAt: new Date().toISOString(),
  };

  const idx = (snapshot.sections ?? []).findIndex((s) => s.key === "guardrailPolicy");
  if (idx >= 0) snapshot.sections[idx] = policySection;
  else          snapshot.sections.push(policySection);

  await saveInventorySnapshot(snapshot);
  return { applied: true, policy: resolvedPolicy.default };
}

// Exported for the utility route (reads snapshot from disk)
export async function applyGuardrailPolicy({ apiKey }) {
  const snapshot = await getSavedExistingFoundryInventory();
  const controlPlaneUrl = snapshot.connection?.controlPlaneUrl;
  if (!controlPlaneUrl) {
    const err = new Error("No saved control plane URL. Reconnect in Step 2 first.");
    err.status = 400;
    throw err;
  }
  const result = await _applyGuardrailPolicyFromSnapshot(snapshot, apiKey, controlPlaneUrl);
  if (!result.applied) {
    const err = new Error(result.reason);
    err.status = 400;
    throw err;
  }
  return result;
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

  // Automatically wire guardrails to the gateway — soft failure so connect always succeeds
  await _applyGuardrailPolicyFromSnapshot(result, input.apiKey, controlPlaneUrl).catch(() => {});

  return result;
}
