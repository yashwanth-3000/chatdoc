"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  connectExistingFoundryUser,
  connectDemoFoundry,
  fetchDemoAvailability,
  fetchSavedExistingFoundryInventory,
  DEMO_API_KEY_SENTINEL,
} from "@/lib/frontend-api";
import type {
  ExistingFoundryConnectResponse,
  FoundryInventorySection,
} from "@/lib/chatbot-types";
import styles from "./builder-start.module.css";
import stepStyles from "./widget-designer.module.css";

type FoundryAccessMode = "chooser" | "existing";
type FoundryAccessProps = { mode?: FoundryAccessMode };

type ExistingUserForm = {
  controlPlaneUrl: string;
  apiKey: string;
  gatewayBaseUrl: string;
  dataRoutingDestination: string;
};

type InventoryRecord = Record<string, unknown>;

// ── Tier types ────────────────────────────────────────────────────────────────

type TierKey = "guest" | "loggedIn" | "pro";

type TierItemRef = { id: string; name: string };

type TierConfig = {
  model: TierItemRef | null;
  rateLimitPolicy: TierItemRef | null;
  guardrails: TierItemRef[];
  mcpTools: TierItemRef[];
};

const EMPTY_TIER: TierConfig = { model: null, rateLimitPolicy: null, guardrails: [], mcpTools: [] };

const TIER_META: Record<TierKey, { label: string; desc: string; color: string }> = {
  guest:    { label: "Guest",     desc: "Unauthenticated users",  color: "#5b5a66" },
  loggedIn: { label: "Logged-in", desc: "Authenticated users",    color: "#2563eb" },
  pro:      { label: "Pro",       desc: "Premium / paid users",   color: "#7c3aed" },
};

// ── Inventory groups ──────────────────────────────────────────────────────────

const inventoryGroups: Array<{ title: string; keys: string[] }> = [
  { title: "Gateway", keys: ["gatewayHealth", "availableModels", "providerAccounts", "modelIntegrations", "guardrails", "routingConfigs", "rateLimitConfigs", "budgetConfigs"] },
  { title: "Registries", keys: ["mcpServers", "agents", "prompts", "tracingProjects"] },
  { title: "Platform", keys: ["workspaces", "clusters", "applications"] },
  { title: "Access", keys: ["personalAccessTokens", "virtualAccounts", "teams", "secretGroups"] },
  { title: "Ledgers", keys: ["modelUsageLedger", "userUsageLedger", "recentRequestsLedger"] },
];

const gatewayFeatureCards = [
  { title: "Virtual model",      summary: "Expose one stable model name while routing to real provider targets.",          items: ["Provider group ownership", "Model slug", "Access control"] },
  { title: "Rerouting on failure", summary: "Fallback when a target fails, is overloaded, rate limited, or unhealthy.",   items: ["401/403/404", "429 rate limit", "500/502/503"] },
  { title: "Load balancing",     summary: "Choose the strategy before publishing the chatbot gateway policy.",             items: ["Priority failover", "Latency optimized", "Weighted canary"] },
  { title: "Retries",            summary: "Retry the same target before moving to the next fallback candidate.",           items: ["Attempts", "Delay", "Retry status codes"] },
  { title: "Rate limits",        summary: "Control request or token usage by user, model, virtual account, or metadata.", items: ["Requests/minute", "Tokens/hour", "Per user/model"] },
  { title: "Budget controls",    summary: "Enforce cost limits and alerts for teams, users, models, or projects.",         items: ["Daily/weekly/monthly", "Audit mode", "Alerts"] },
  { title: "Guardrails",         summary: "Attach input, output, and MCP tool safety rules.",                              items: ["PII", "Moderation", "Prompt injection"] },
  { title: "Observability",      summary: "Track traces, costs, tokens, latency, errors, and resolved model headers.",     items: ["Spans", "Metrics", "Metadata"] },
  { title: "MCP tools",          summary: "Attach registered or virtual MCP servers with tool-level guardrails.",          items: ["Tool registry", "Virtual MCP", "Pre/post checks"] },
  { title: "Prompt overrides",   summary: "Override request parameters or prompt versions per routing target.",            items: ["Temperature", "Max tokens", "Prompt version"] },
];

const fallbackStatusCodes = ["401", "403", "404", "429", "500", "502", "503"];

// ── Type guards ───────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is InventoryRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecords(value: unknown): InventoryRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.data)) return (value.data as unknown[]).filter(isRecord);
  if (isRecord(value) && Array.isArray(value.items)) return (value.items as unknown[]).filter(isRecord);
  if (isRecord(value) && Array.isArray(value.results)) return (value.results as unknown[]).filter(isRecord);
  if (isRecord(value) && Array.isArray(value.configs)) return (value.configs as unknown[]).filter(isRecord);
  return [];
}

function nestedRecord(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const child = value[key];
  return isRecord(child) ? child : null;
}

function textValue(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => textValue(v, "")).filter(Boolean).join(", ") || fallback;
  return fallback;
}

function dateValue(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function findRecords(section: FoundryInventorySection): InventoryRecord[] {
  if (section.records?.length) return asRecords(section.records);
  return asRecords(section.raw);
}

function summarizeLedger(section: FoundryInventorySection): InventoryRecord[] {
  const data = nestedRecord(section.raw, "data");
  return Array.isArray(data?.dataPoints) ? (data.dataPoints as unknown[]).filter(isRecord) : [];
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function flattenRecord(record: InventoryRecord, prefix = "", depth = 0): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const skipKeys = new Set(["_isHealth", "records", "raw", "error", "dataPoints"]);

  for (const [key, value] of Object.entries(record)) {
    if (skipKeys.has(key) || key.startsWith("_")) continue;
    const label = prefix ? `${prefix} · ${formatKey(key)}` : formatKey(key);

    if (typeof value === "string" && value.trim()) {
      pairs.push([label, value.length > 140 ? value.slice(0, 138) + "…" : value]);
    } else if (typeof value === "number") {
      pairs.push([label, value.toLocaleString()]);
    } else if (typeof value === "boolean") {
      pairs.push([label, value ? "Yes" : "No"]);
    } else if (Array.isArray(value) && value.length > 0) {
      if (value.every((v) => typeof v === "string" || typeof v === "number")) {
        pairs.push([label, (value as (string | number)[]).join(", ")]);
      } else {
        pairs.push([label, `${value.length} item${value.length !== 1 ? "s" : ""}`]);
      }
    } else if (isRecord(value) && depth < 2) {
      pairs.push(...flattenRecord(value as InventoryRecord, formatKey(key), depth + 1));
    }
  }

  return pairs;
}

// ── Item display helpers ──────────────────────────────────────────────────────

function getItemTitle(record: InventoryRecord, sectionKey: string, index: number): string {
  // Gateway config sections — configs have name in root, metadata, or spec
  if (sectionKey === "routingConfigs") {
    // Virtual model provider accounts: name from manifest or root
    const manifest = isRecord(record.manifest) ? record.manifest as InventoryRecord : null;
    const title = record.name ?? manifest?.name ?? record.id;
    return textValue(title, `Virtual model ${index + 1}`);
  }

  if (sectionKey === "rateLimitConfigs" || sectionKey === "budgetConfigs") {
    // Rate limit / budget rules have `id` as name, no `name` field
    const title = record.id ?? record.name ?? record.configName;
    return textValue(title, `Rule ${index + 1}`);
  }

  if (sectionKey === "mcpServers") {
    const mfst = isRecord(record.manifest) ? record.manifest as InventoryRecord : null;
    const title = record.name ?? mfst?.name ?? record.serverName ?? record.displayName ?? record.id;
    return textValue(title, `MCP Server ${index + 1}`);
  }

  if (sectionKey === "guardrails") {
    const title = record.name ?? record.displayName ?? record.guardrailName ?? record.id;
    return textValue(title, `Guardrail ${index + 1}`);
  }

  const manifest = isRecord(record.manifest) ? record.manifest as InventoryRecord : null;
  const title = record.name ?? record.id ?? manifest?.name ?? record.modelName ?? record.userEmail;
  return textValue(title, `${sectionKey} ${index + 1}`);
}

function getItemMeta(record: InventoryRecord, sectionKey: string): Array<[string, string]> {
  const manifest = isRecord(record.manifest) ? record.manifest as InventoryRecord : null;
  const providerAccount = nestedRecord(record, "providerAccount");
  const pairs: Array<[string, string]> = [];

  if (sectionKey === "recentRequestsLedger") {
    const time = dateValue(record.startTime ?? record.Timestamp ?? record.createdAt);
    const status = textValue(record.statusCode ?? record.status, "");
    if (time !== "—") pairs.push(["Time", time]);
    if (status) pairs.push(["Status", status]);
    if (record.traceId) pairs.push(["Trace", textValue(record.traceId).slice(0, 12) + "…"]);
    return pairs;
  }

  if (sectionKey === "modelUsageLedger" || sectionKey === "userUsageLedger") {
    if (record.count) pairs.push(["Requests", textValue(record.count)]);
    if (record.costInUSD) pairs.push(["Cost", `$${textValue(record.costInUSD)}`]);
    if (record.inputTokens) pairs.push(["Tokens in", textValue(record.inputTokens)]);
    return pairs;
  }

  if (sectionKey === "routingConfigs") {
    // Virtual model provider account: manifest contains integrations with routing
    const manifest = isRecord(record.manifest) ? record.manifest as InventoryRecord : null;
    const integrations = Array.isArray(manifest?.integrations) ? manifest!.integrations as InventoryRecord[] : [];
    const provider = textValue(record.provider ?? manifest?.provider, "");
    if (provider) pairs.push(["Provider", provider]);
    if (integrations.length > 0) pairs.push(["Models", String(integrations.length)]);
    const fqn = textValue(record.fqn, "");
    if (fqn && pairs.length < 3) pairs.push(["FQN", fqn.length > 40 ? fqn.slice(0, 38) + "…" : fqn]);
    return pairs;
  }

  if (sectionKey === "rateLimitConfigs") {
    // Rule object: { id, when, limit_to, unit, rate_limit_applies_per }
    const limitTo = textValue(record.limit_to ?? record.limit ?? record.requestsPerMinute, "");
    const unit = textValue(record.unit, "").replace(/_/g, " ");
    const appliesPer = Array.isArray(record.rate_limit_applies_per)
      ? (record.rate_limit_applies_per as string[]).join(", ")
      : textValue(record.rate_limit_applies_per, "");
    if (limitTo) pairs.push(["Limit", limitTo]);
    if (unit) pairs.push(["Unit", unit]);
    if (appliesPer) pairs.push(["Per", appliesPer]);
    return pairs;
  }

  if (sectionKey === "budgetConfigs") {
    // Rule object: { id, when, limit_to, unit, budget_applies_per, audit_mode }
    const limitTo = textValue(record.limit_to ?? record.budget ?? record.maxCost, "");
    const unit = textValue(record.unit, "").replace(/_/g, " ");
    const appliesPer = Array.isArray(record.budget_applies_per)
      ? (record.budget_applies_per as string[]).join(", ")
      : textValue(record.budget_applies_per, "");
    const auditMode = record.audit_mode === true ? "audit only" : "";
    if (limitTo) pairs.push(["Budget $", limitTo]);
    if (unit) pairs.push(["Period", unit]);
    if (appliesPer) pairs.push(["Per", appliesPer]);
    else if (auditMode) pairs.push(["Mode", auditMode]);
    return pairs;
  }

  if (sectionKey === "guardrails") {
    const rawType = isRecord(record.manifest) ? (record.manifest as InventoryRecord).type as string : undefined;
    const type = textValue(
      (typeof rawType === "string" ? rawType.split("/").pop() : undefined) ?? record.type ?? record.guardrailType ?? record.checkerType,
      ""
    );
    const provider = textValue(record.provider ?? record.providerName, "");
    const mode = textValue(record.mode ?? record.action, "");
    if (type) pairs.push(["Type", type]);
    if (provider) pairs.push(["Provider", provider]);
    if (mode && pairs.length < 3) pairs.push(["Mode", mode]);
    return pairs;
  }

  if (sectionKey === "mcpServers") {
    const mfst = isRecord(record.manifest) ? record.manifest as InventoryRecord : null;
    const url = textValue(record.url ?? record.serverUrl ?? mfst?.url ?? record.proxyUrl, "");
    const serverType = textValue(mfst?.type ?? record.type ?? record.transport, "");
    const desc = textValue(mfst?.description ?? record.description, "");
    if (url) pairs.push(["URL", url.length > 42 ? url.slice(0, 40) + "…" : url]);
    if (serverType) pairs.push(["Type", serverType.replace("mcp-server/", "")]);
    else if (desc) pairs.push(["Desc", desc.length > 40 ? desc.slice(0, 38) + "…" : desc]);
    return pairs;
  }

  const provider = textValue(record.provider ?? manifest?.provider ?? providerAccount?.provider, "");
  const type = textValue(record.type ?? manifest?.type, "");
  const modelId = textValue(manifest?.model_id ?? record.model_id, "");
  const fqn = textValue(record.fqn, "");
  const status = textValue(record.status, "");

  if (provider) pairs.push(["Provider", provider]);
  if (modelId) pairs.push(["Model ID", modelId]);
  else if (type) pairs.push(["Type", type]);
  if (fqn && pairs.length < 2) pairs.push(["FQN", String(fqn).length > 40 ? String(fqn).slice(0, 38) + "…" : fqn]);
  if (status && pairs.length < 3) pairs.push(["Status", status]);

  return pairs.slice(0, 3);
}

// ── Main component ────────────────────────────────────────────────────────────

export function FoundryAccess({ mode = "chooser" }: FoundryAccessProps) {
  const [form, setForm] = useState<ExistingUserForm>({
    controlPlaneUrl: "",
    apiKey: "",
    gatewayBaseUrl: "",
    dataRoutingDestination: "default",
  });
  const [inventory, setInventory] = useState<ExistingFoundryConnectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventorySource, setInventorySource] = useState<"live" | "saved" | "demo" | null>(null);
  const [demoAvailable, setDemoAvailable] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [activeSectionKey, setActiveSectionKey] = useState<string>("availableModels");
  const [addedItems, setAddedItems] = useState<Map<string, string>>(new Map());
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [browserPhase, setBrowserPhase] = useState<"browse" | "tiers">("browse");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [tiers, setTiers] = useState<Record<TierKey, TierConfig>>({
    guest:    { ...EMPTY_TIER },
    loggedIn: { ...EMPTY_TIER },
    pro:      { ...EMPTY_TIER },
  });
  const [tierSaved, setTierSaved] = useState(false);
  // When >1 virtual model exists, show a picker before continuing
  const [modelPickerTier, setModelPickerTier] = useState<Record<TierKey, TierItemRef | null>>({ guest: null, loggedIn: null, pro: null });
  const [showModelPicker, setShowModelPicker] = useState(false);

  const isExisting = mode === "existing";
  const isChooser = mode === "chooser";

  const groupedInventory = useMemo(() => {
    if (!inventory) return [];
    return inventoryGroups.map((group) => {
      const sections = group.keys
        .map((key) => inventory.sections.find((s) => s.key === key))
        .filter((s): s is FoundryInventorySection => Boolean(s));
      return { ...group, sections };
    }).filter((g) => g.sections.length);
  }, [inventory]);

  const activeSection = inventory?.sections.find((s) => s.key === activeSectionKey) ?? null;

  useEffect(() => {
    if (!inventory) return;
    const firstWithCount = inventoryGroups
      .flatMap((g) => g.keys)
      .find((key) => inventory.sections.find((s) => s.key === key && s.count > 0));
    if (firstWithCount) setActiveSectionKey(firstWithCount);
  }, [inventory]);

  // Restore saved tier config on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("chatdock_tier_config");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.tiers) setTiers(saved.tiers);
      }
    } catch { /* ignore */ }
  }, []);

  // Judge/demo mode is only offered when the backend has demo credentials configured
  useEffect(() => {
    if (!isExisting) return;
    fetchDemoAvailability()
      .then((r) => setDemoAvailable(r.available))
      .catch(() => setDemoAvailable(false));
  }, [isExisting]);

  async function handleDemoConnect() {
    setDemoLoading(true);
    setError(null);
    try {
      const result = await connectDemoFoundry();
      // Sentinel instead of a real key — the backend swaps it server-side
      try { sessionStorage.setItem("chatdock_api_key", DEMO_API_KEY_SENTINEL); } catch { /* ignore */ }
      setInventory(result);
      setInventorySource("demo");
    } catch (e) {
      setInventory(null);
      setError(e instanceof Error ? e.message : "Unable to connect with the demo tenant.");
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleExistingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await connectExistingFoundryUser({
        controlPlaneUrl: form.controlPlaneUrl,
        apiKey: form.apiKey,
        gatewayBaseUrl: form.gatewayBaseUrl || undefined,
        dataRoutingDestination: form.dataRoutingDestination || "default",
      });
      // Keep the API key in session so Step 3 live demo works without re-entry
      try { sessionStorage.setItem("chatdock_api_key", form.apiKey); } catch { /* ignore */ }
      setInventory(result);
      setInventorySource("live");
      setForm((c) => ({ ...c, apiKey: "" }));
    } catch (e) {
      setInventory(null);
      setError(e instanceof Error ? e.message : "Unable to connect to TrueFoundry.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadSavedInventory() {
    setLayoutLoading(true);
    setError(null);
    try {
      const result = await fetchSavedExistingFoundryInventory();
      setInventory(result);
      setInventorySource("saved");
      // Saved snapshot has no credentials — clear any stale key so Step 3 shows accurate offline state
      try { sessionStorage.removeItem("chatdock_api_key"); } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load saved inventory.");
    } finally {
      setLayoutLoading(false);
    }
  }

  function handleAddItem(id: string, title: string) {
    setAddedItems((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, title);
      return next;
    });
  }

  function getInventoryItems(sectionKey: string): TierItemRef[] {
    if (!inventory) return [];
    const section = inventory.sections.find((s) => s.key === sectionKey);
    if (!section) return [];
    const records = findRecords(section);
    return records.map((rec, i) => ({
      id: textValue(rec.id ?? rec.name ?? rec.configName ?? `${sectionKey}-${i}`, `${sectionKey}-${i}`),
      name: getItemTitle(rec, sectionKey, i),
    }));
  }

  // Auto-populate tiers from inventory when it loads
  useEffect(() => {
    if (!inventory) return;

    const vms = getVirtualModels();
    const allGuardrails = getInventoryItems("guardrails");
    const allMcpTools = getInventoryItems("mcpServers");
    const allRateLimits = getInventoryItems("rateLimitConfigs");

    const tierRateLimits: Record<TierKey, TierItemRef | null> = { guest: null, loggedIn: null, pro: null };
    allRateLimits.forEach((r) => {
      const idLower = r.id.toLowerCase();
      if (idLower.includes("guest")) tierRateLimits.guest = r;
      else if (idLower.includes("logged") || idLower.includes("login")) tierRateLimits.loggedIn = r;
      else if (idLower.includes("pro")) tierRateLimits.pro = r;
    });

    if (vms.length > 1) {
      setModelPickerTier({ guest: vms[0], loggedIn: vms[0], pro: vms[0] });
      setShowModelPicker(true);
      setTiers({
        guest:    { model: null, rateLimitPolicy: tierRateLimits.guest,    guardrails: allGuardrails, mcpTools: allMcpTools },
        loggedIn: { model: null, rateLimitPolicy: tierRateLimits.loggedIn, guardrails: allGuardrails, mcpTools: allMcpTools },
        pro:      { model: null, rateLimitPolicy: tierRateLimits.pro,      guardrails: allGuardrails, mcpTools: allMcpTools },
      });
    } else {
      const modelRef = vms[0] ?? null;
      setShowModelPicker(false);
      setTiers({
        guest:    { model: modelRef, rateLimitPolicy: tierRateLimits.guest,    guardrails: allGuardrails, mcpTools: allMcpTools },
        loggedIn: { model: modelRef, rateLimitPolicy: tierRateLimits.loggedIn, guardrails: allGuardrails, mcpTools: allMcpTools },
        pro:      { model: modelRef, rateLimitPolicy: tierRateLimits.pro,      guardrails: allGuardrails, mcpTools: allMcpTools },
      });
    }

    // Sync addedItems so the browser view shows "✓ applied" for every auto-configured item.
    // The browser uses index-based keys ("mcpServers-0", "guardrails-1", etc.) — match that format.
    const autoAdded = new Map<string, string>();
    allMcpTools.forEach((item, i)    => autoAdded.set(`mcpServers-${i}`,       item.name));
    allGuardrails.forEach((item, i)  => autoAdded.set(`guardrails-${i}`,        item.name));
    allRateLimits.forEach((item, i)  => autoAdded.set(`rateLimitConfigs-${i}`,  item.name));
    if (vms.length === 1 && vms[0]) autoAdded.set(`providerAccounts-0`, vms[0].name);
    setAddedItems(autoAdded);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory]);

  // Returns only virtual-model provider accounts — these are the names TrueFoundry gateway accepts
  function getVirtualModels(): TierItemRef[] {
    if (!inventory) return [];
    const section = inventory.sections.find((s) => s.key === "providerAccounts");
    if (!section) return [];
    return findRecords(section)
      .filter((rec) => {
        const manifest = isRecord(rec.manifest) ? rec.manifest as InventoryRecord : null;
        return manifest?.type === "provider-account/virtual-model";
      })
      .map((rec, i) => {
        const name = textValue(rec.name ?? rec.id ?? `vm-${i}`, `vm-${i}`);
        return { id: name, name };
      });
  }

  function handleSaveTierConfig() {
    try {
      sessionStorage.setItem("chatdock_tier_config", JSON.stringify({
        tiers,
        gatewayUrl: inventory?.connection.gatewayBaseUrl,
        controlPlaneUrl: inventory?.connection.controlPlaneUrl,
        savedAt: new Date().toISOString(),
      }));
      setTierSaved(true);
      setTimeout(() => setTierSaved(false), 2500);
    } catch { /* ignore */ }
  }

  function handleContinueToLiveTest() {
    const gatewayUrl = inventory?.connection.gatewayBaseUrl;
    if (!gatewayUrl) return;
    try { new URL(gatewayUrl); } catch { return; }

    // Merge picker model choices if multiple VMs were detected
    const finalTiers = showModelPicker
      ? {
          guest:    { ...tiers.guest,    model: modelPickerTier.guest },
          loggedIn: { ...tiers.loggedIn, model: modelPickerTier.loggedIn },
          pro:      { ...tiers.pro,      model: modelPickerTier.pro },
        }
      : tiers;

    try {
      sessionStorage.setItem("chatdock_tier_config", JSON.stringify({
        tiers: finalTiers,
        gatewayUrl,
        controlPlaneUrl: inventory?.connection.controlPlaneUrl,
        savedAt: new Date().toISOString(),
      }));
    } catch { /* ignore */ }
  }

  function getActiveRecords(): InventoryRecord[] {
    if (!activeSection) return [];
    if (activeSection.key === "gatewayHealth") {
      const raw = isRecord(activeSection.raw) ? activeSection.raw : {};
      return [{ _isHealth: true, status: raw.status ?? "ok", message: raw.message, version: raw.version }];
    }
    if (activeSection.key === "modelUsageLedger" || activeSection.key === "userUsageLedger") {
      return summarizeLedger(activeSection);
    }
    return findRecords(activeSection);
  }

  // ── Tier configurator ───────────────────────────────────────────────────────

  function TierConfigurator() {
    const virtualModels = getVirtualModels();
    // Use gateway-routable virtual model names; fall back to callable models if tenant has none
    const availableModels = virtualModels.length > 0 ? virtualModels : getInventoryItems("availableModels");
    const availableRateLimits = getInventoryItems("rateLimitConfigs");
    const availableGuardrails = getInventoryItems("guardrails");
    const availableMcpTools = getInventoryItems("mcpServers");

    const tierSummaryConfigured = (["guest", "loggedIn", "pro"] as TierKey[]).some(
      (k) => tiers[k].model !== null
    );

    return (
      <div className={styles.gwTierSection}>
        <div className={styles.gwTierHead}>
          <div>
            <p className={styles.kicker}>Step 2b · User Access Tiers</p>
            <h3>Configure per-tier policies</h3>
            <p>
              Assign models, rate limit policies, guardrails, and MCP tools for each user access level.
              These are used to generate your gateway integration code in the next step.
            </p>
          </div>
          {tierSummaryConfigured && (
            <span className={styles.gwTierConfiguredBadge}>Configured</span>
          )}
        </div>

        <div className={styles.gwTierGrid}>
          {(["guest", "loggedIn", "pro"] as TierKey[]).map((tierKey) => {
            const meta = TIER_META[tierKey];
            const tierConf = tiers[tierKey];

            return (
              <div key={tierKey} className={styles.gwTierCard}>
                <div className={styles.gwTierCardHead}>
                  <span className={styles.gwTierBadge} style={{ background: meta.color }}>
                    {meta.label}
                  </span>
                  <span className={styles.gwTierCardDesc}>{meta.desc}</span>
                </div>

                {/* Model */}
                <div className={styles.gwTierField}>
                  <label>AI Model</label>
                  {availableModels.length > 0 ? (
                    <select
                      value={tierConf.model?.id ?? ""}
                      onChange={(e) => {
                        const opt = availableModels.find((m) => m.id === e.target.value) ?? null;
                        setTiers((prev) => ({ ...prev, [tierKey]: { ...prev[tierKey], model: opt } }));
                      }}
                    >
                      <option value="">— None selected —</option>
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className={styles.gwTierEmpty}>
                      No callable models found. Connect gateway to load.
                    </div>
                  )}
                </div>

                {/* Rate limit */}
                <div className={styles.gwTierField}>
                  <label>Rate limit policy</label>
                  {availableRateLimits.length > 0 ? (
                    <select
                      value={tierConf.rateLimitPolicy?.id ?? ""}
                      onChange={(e) => {
                        const opt = availableRateLimits.find((r) => r.id === e.target.value) ?? null;
                        setTiers((prev) => ({ ...prev, [tierKey]: { ...prev[tierKey], rateLimitPolicy: opt } }));
                      }}
                    >
                      <option value="">— No policy —</option>
                      {availableRateLimits.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className={styles.gwTierEmpty}>
                      No rate limit configs found in this tenant.
                    </div>
                  )}
                </div>

                {/* Guardrails */}
                <div className={styles.gwTierMulti}>
                  <p>Guardrails</p>
                  {availableGuardrails.length > 0 ? (
                    availableGuardrails.map((g) => {
                      const checked = tierConf.guardrails.some((x) => x.id === g.id);
                      return (
                        <label key={g.id} className={styles.gwTierMultiItem}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setTiers((prev) => {
                                const cur = prev[tierKey].guardrails;
                                const next = checked
                                  ? cur.filter((x) => x.id !== g.id)
                                  : [...cur, g];
                                return { ...prev, [tierKey]: { ...prev[tierKey], guardrails: next } };
                              });
                            }}
                          />
                          {g.name}
                        </label>
                      );
                    })
                  ) : (
                    <div className={styles.gwTierEmpty}>
                      No guardrails configured in your Foundry tenant.
                    </div>
                  )}
                </div>

                {/* MCP tools */}
                <div className={styles.gwTierMulti}>
                  <p>MCP tools</p>
                  {availableMcpTools.length > 0 ? (
                    availableMcpTools.map((t) => {
                      const checked = tierConf.mcpTools.some((x) => x.id === t.id);
                      return (
                        <label key={t.id} className={styles.gwTierMultiItem}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setTiers((prev) => {
                                const cur = prev[tierKey].mcpTools;
                                const next = checked
                                  ? cur.filter((x) => x.id !== t.id)
                                  : [...cur, t];
                                return { ...prev, [tierKey]: { ...prev[tierKey], mcpTools: next } };
                              });
                            }}
                          />
                          {t.name}
                        </label>
                      );
                    })
                  ) : (
                    <div className={styles.gwTierEmpty}>
                      No MCP servers registered in your Foundry tenant yet.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.gwTierActions}>
          <p className={styles.gwTierNote}>
            Guest tier restricts model and tool access. Logged-in and Pro tiers unlock progressively more capability.
            MCP tools enable documentation search: user query → tool call → docs → AI answer.
          </p>
          <button
            className={`${styles.gwPrimaryBtn} ${tierSaved ? styles.gwPrimaryBtnSaved : ""}`}
            onClick={handleSaveTierConfig}
          >
            {tierSaved ? "✓ Saved" : "Save tier configuration →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={stepStyles.designer}>
      {/* Step header */}
      <section className={stepStyles.header}>
        <div className={stepStyles.stepRail} aria-label="Builder progress">
          <div className={stepStyles.stepNode}>
            <span>1</span>
            <strong>Widget UI</strong>
          </div>
          <i />
          <div className={`${stepStyles.stepNode} ${stepStyles.stepActive}`}>
            <span>2</span>
            <strong>Gateway</strong>
          </div>
          <i />
          <div className={stepStyles.stepNode}>
            <span>3</span>
            <strong>Live test</strong>
          </div>
          <i />
          <div className={stepStyles.stepNode}>
            <span>4</span>
            <strong>Publish</strong>
          </div>
        </div>
        <div>
          <h1>
            {inventory ? "Foundry inventory" : "Connect your gateway"}
          </h1>
          <p>
            {inventory
              ? `${inventory.connection.okSections} sections loaded · Browse models, tools, and rules — click + to add to your chatbot.`
              : "Enter your TrueFoundry credentials to browse models, guardrails, MCP tools, and workspace resources."}
          </p>
        </div>
        <div className={stepStyles.headerActions}>
          <Link className={stepStyles.secondaryButton} href="/builder/step-one">Back</Link>
          {inventory ? (
            <Link className={stepStyles.primaryButton} href="/builder/step-three" onClick={handleContinueToLiveTest}>
              Continue →
            </Link>
          ) : null}
        </div>
      </section>

      {/* ── Chooser mode ─────────────────────────────── */}
      {isChooser ? (
        <section className={styles.foundryAccess} aria-label="TrueFoundry connection">
          <div className={styles.chooseLayout}>
            <div className={styles.chooseLeft}>
              <div>
                <p className={styles.kicker}>Step 2 · Gateway</p>
                <h1 className={styles.chooseHeading}>Connect your Foundry tenant</h1>
                <p className={styles.chooseSubhead}>
                  Use your existing TrueFoundry tenant to load models, ledgers, MCP tools,
                  guardrails, routing, budgets, and gateway policy.
                </p>
              </div>

              <article className={styles.connectCard}>
                <span>Existing tenant</span>
                <h2>I&apos;m already on Foundry</h2>
                <p>Paste your control-plane URL and PAT/VAT to pull models, ledgers, tools, and gateway policy.</p>
                <Link className={styles.connectCardCta} href="/builder/step-two/existing-foundry-user">
                  Connect tenant →
                </Link>
              </article>

              <div className={styles.trustRow}>
                <span>🔒 Credentials never stored</span>
                <span>⚡ Live inventory fetch</span>
                <span>🧩 19+ inventory sections</span>
              </div>
            </div>

            <div className={styles.chooseRight}>
              <p className={styles.featureLabel}>Gateway capabilities you unlock</p>
              <div className={styles.featureGrid}>
                {gatewayFeatureCards.map((card, idx) => (
                  <div key={card.title} className={styles.featureCard} data-idx={idx % 5}>
                    <strong>{card.title}</strong>
                    <p>{card.summary}</p>
                    <div className={styles.featurePills}>
                      {card.items.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Existing: connect form ────────────────────── */}
      {isExisting && !inventory ? (
        <div className={styles.gwConnect}>
          <div className={styles.gwConnectCard}>
            <div className={styles.gwConnectHead}>
              <p className={styles.kicker}>Existing Tenant</p>
              <h2>Connect Foundry Gateway</h2>
              <p>API key is the default connection method. Use a PAT or Virtual Account Token to pull models, guardrails, routing, limits, budgets, tools, and ledgers.</p>
            </div>

            <form className={styles.gwConnectBody} onSubmit={handleExistingSubmit}>
              <div className={styles.gwFormField}>
                <label className={styles.gwFormLabel}>Control plane URL</label>
                <input
                  className={styles.gwFormInput}
                  type="url"
                  placeholder="https://your-org.truefoundry.cloud"
                  value={form.controlPlaneUrl}
                  onChange={(e) => setForm((c) => ({ ...c, controlPlaneUrl: e.target.value }))}
                  required
                />
              </div>

              <div className={styles.gwFormField}>
                <label className={styles.gwFormLabel}>API key (PAT or VAT)</label>
                <input
                  className={styles.gwFormInput}
                  type="password"
                  placeholder="tfy-..."
                  value={form.apiKey}
                  onChange={(e) => setForm((c) => ({ ...c, apiKey: e.target.value }))}
                  required
                />
              </div>

              {error ? (
                <p className={`${styles.errorText} ${styles.gwFormFieldFull}`}>{error}</p>
              ) : null}

              <div className={`${styles.gwFormActions} ${styles.gwFormFieldFull}`}>
                <button type="submit" className={styles.gwPrimaryBtn} disabled={loading || layoutLoading || demoLoading}>
                  {loading ? "Connecting..." : "Fetch inventory"}
                </button>
                <button
                  type="button"
                  className={styles.gwSecondaryBtn}
                  disabled={loading || layoutLoading || demoLoading}
                  onClick={handleLoadSavedInventory}
                >
                  {layoutLoading ? "Loading…" : "Test with saved data"}
                </button>
              </div>
            </form>
            {demoAvailable ? (
              <div className={styles.gwConnectBody} style={{ paddingTop: 0 }}>
                <div className={styles.gwFormFieldFull} style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 10px" }}>
                    <strong>No TrueFoundry account?</strong> Judges and evaluators can connect
                    with ChatDock&apos;s own demo tenant — credentials stay on the server and are
                    never sent to your browser.
                  </p>
                  <button
                    type="button"
                    className={styles.gwSecondaryBtn}
                    disabled={loading || layoutLoading || demoLoading}
                    onClick={handleDemoConnect}
                  >
                    {demoLoading ? "Connecting…" : "Continue as judge — use demo tenant"}
                  </button>
                </div>
              </div>
            ) : null}
            <p className={styles.gwConnectFoot}>
              Credentials are only used during this request and are never stored by ChatDock.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Existing: inventory browser ──────────────── */}
      {isExisting && inventory ? (
        <div className={styles.gwBrowser}>
          {/* Auto-config summary banner */}
          {(() => {
            const vms = getVirtualModels();
            const allGuardrails = getInventoryItems("guardrails");
            const allMcpTools = getInventoryItems("mcpServers");
            const allRateLimits = getInventoryItems("rateLimitConfigs");
            return (
              <div className={styles.gwAutoConfigBanner}>
                <div className={styles.gwAutoConfigLeft}>
                  <span className={styles.gwAutoConfigCheck}>✓</span>
                  <span className={styles.gwAutoConfigText}>
                    Auto-configured from inventory —{" "}
                    {vms.length === 1 ? <><strong>{vms[0].name}</strong> virtual model</> : `${vms.length} virtual models`}
                    {allRateLimits.length > 0 ? `, ${allRateLimits.length} rate limit rule${allRateLimits.length !== 1 ? "s" : ""}` : ""}
                    {allGuardrails.length > 0 ? `, ${allGuardrails.length} guardrail${allGuardrails.length !== 1 ? "s" : ""}` : ""}
                    {allMcpTools.length > 0 ? `, ${allMcpTools.length} MCP tool${allMcpTools.length !== 1 ? "s" : ""}` : ""}
                    {" "}applied to all tiers
                  </span>
                </div>
                {showModelPicker && vms.length > 1 && (
                  <div className={styles.gwModelPicker}>
                    <span className={styles.gwModelPickerLabel}>Pick model per tier:</span>
                    {(["guest", "loggedIn", "pro"] as TierKey[]).map((tierKey) => (
                      <label key={tierKey} className={styles.gwModelPickerField}>
                        <span>{TIER_META[tierKey].label}</span>
                        <select
                          value={modelPickerTier[tierKey]?.id ?? ""}
                          onChange={(e) => {
                            const opt = vms.find((v) => v.id === e.target.value) ?? null;
                            setModelPickerTier((prev) => ({ ...prev, [tierKey]: opt }));
                          }}
                        >
                          {vms.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Status bar */}
          <div className={styles.gwBar}>
            <div className={styles.gwBarLeft}>
              <span className={styles.gwDot} data-status={inventory.connection.status} />
              <span className={styles.gwTenant}>{inventory.connection.controlPlaneUrl}</span>
              <div className={styles.gwStats}>
                <span className={styles.gwStat}>
                  <strong>{inventory.highlights.models}</strong> models
                </span>
                <span className={styles.gwStat}>
                  <strong>{inventory.highlights.providerAccounts}</strong> providers
                </span>
                {inventory.highlights.mcpServers > 0 && (
                  <span className={styles.gwStat}>
                    <strong>{inventory.highlights.mcpServers}</strong> MCP
                  </span>
                )}
                {inventory.highlights.guardrails > 0 && (
                  <span className={styles.gwStat}>
                    <strong>{inventory.highlights.guardrails}</strong> guardrails
                  </span>
                )}
                <span className={styles.gwStatSource}>
                  {inventorySource === "saved" ? "saved snapshot" : inventorySource === "demo" ? "demo tenant (judge mode)" : "live"}
                </span>
              </div>
            </div>
            <div className={styles.gwBarRight}>
              {addedItems.size > 0 ? (
                <span className={styles.gwAdded}>{addedItems.size} added</span>
              ) : null}
              {tierSaved ? (
                <span className={styles.gwTierSavedTag}>✓ Tiers saved</span>
              ) : null}
              <button
                className={styles.gwSecondaryBtn}
                onClick={() => {
                  setInventory(null);
                  setInventorySource(null);
                  setAddedItems(new Map());
                  setBrowserPhase("browse");
                  try {
                    sessionStorage.removeItem("chatdock_tier_config");
                    sessionStorage.removeItem("chatdock_api_key");
                  } catch { /* ignore */ }
                }}
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Two-column browser */}
          <div className={styles.gwLayout}>
                {/* Left nav */}
                <nav className={styles.gwNav} aria-label="Inventory sections">
                  {groupedInventory.map((group) => {
                    const isGroupExpanded = expandedGroups.has(group.title);
                    const visibleSections = group.sections.filter(
                      (s) => s.count > 0 || s.status === "error" || s.status === "unavailable"
                    );
                    const hiddenSections = group.sections.filter(
                      (s) => s.count === 0 && s.status !== "error" && s.status !== "unavailable"
                    );
                    const displayedSections = isGroupExpanded
                      ? group.sections
                      : visibleSections;

                    if (displayedSections.length === 0 && hiddenSections.length === 0) return null;

                    return (
                    <div key={group.title} className={styles.gwNavGroup}>
                      <p className={styles.gwNavGroupLabel}>{group.title}</p>
                      {displayedSections.map((section) => (
                        <button
                          key={section.key}
                          className={`${styles.gwNavBtn} ${activeSectionKey === section.key ? styles.gwNavBtnActive : ""}`}
                          onClick={() => { setActiveSectionKey(section.key); setExpandedItemId(null); }}
                        >
                          <span className={styles.gwNavBtnLabel}>{section.title}</span>
                          <span
                            className={styles.gwNavBadge}
                            data-status={section.status === "unavailable" ? "unavailable" : section.status}
                            title={section.status === "unavailable" ? "Could not load — click to see details" : undefined}
                          >
                            {section.status === "unavailable" ? "!" : section.count}
                          </span>
                        </button>
                      ))}
                      {hiddenSections.length > 0 && (
                        <button
                          className={styles.gwNavShowMore}
                          onClick={() => setExpandedGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(group.title)) next.delete(group.title);
                            else next.add(group.title);
                            return next;
                          })}
                        >
                          {isGroupExpanded
                            ? "Show less"
                            : `${hiddenSections.length} more not configured`}
                        </button>
                      )}
                    </div>
                    );
                  })}
                </nav>

                {/* Right main */}
                <main className={styles.gwMain}>
                  {activeSection ? (
                    <>
                      <div className={styles.gwMainHead}>
                        <div>
                          <h3 className={styles.gwMainTitle}>{activeSection.title}</h3>
                          <p className={styles.gwMainDesc}>{activeSection.description}</p>
                        </div>
                        <span className={styles.gwSectionCount}>{activeSection.count}</span>
                      </div>

                      <div className={styles.gwItemList}>
                        {activeSection.status === "error" ? (
                          <div className={styles.gwEmptyState}>
                            <p className={styles.gwEmptyTitle}>Failed to load</p>
                            <p className={styles.gwEmptyDesc}>{activeSection.error?.message || "Unknown error."}</p>
                          </div>
                        ) : activeSection.status === "unavailable" ? (
                          <div className={styles.gwEmptyState}>
                            <p className={styles.gwEmptyTitle} style={{ color: "#c04010" }}>Could not load this section</p>
                            <p className={styles.gwEmptyDesc}>
                              {isRecord(activeSection.raw) && textValue((activeSection.raw as InventoryRecord).hint, "")}
                            </p>
                            {isRecord(activeSection.raw) && Array.isArray((activeSection.raw as InventoryRecord).errors) && (
                              <details className={styles.gwUnavailableDetails}>
                                <summary>Show attempted paths</summary>
                                <ul>
                                  {((activeSection.raw as InventoryRecord).errors as Array<{path: string; status: number; message: string}>).map((e) => (
                                    <li key={e.path}><code>{e.path}</code> → HTTP {e.status}: {e.message}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                            <p className={styles.gwEmptyDescSub}>
                              If you have created these policies in TrueFoundry, your API token may lack
                              the required read permissions, or the endpoint path differs for your tenant version.
                            </p>
                          </div>
                        ) : getActiveRecords().length === 0 ? (
                          <div className={styles.gwEmptyState}>
                            <p className={styles.gwEmptyTitle}>No records</p>
                            <p className={styles.gwEmptyDesc}>
                              No items found in this section for your tenant.
                            </p>
                          </div>
                        ) : (
                          getActiveRecords().map((record, i) => {
                            const id = `${activeSectionKey}-${i}`;
                            const isAdded = addedItems.has(id);
                            const isExpanded = expandedItemId === id;
                            const isHealth = Boolean(record._isHealth);
                            const title = isHealth
                              ? `Gateway — ${textValue(record.status, "ok")}`
                              : getItemTitle(record, activeSectionKey, i);
                            const meta = getItemMeta(record, activeSectionKey);
                            const detailPairs = isExpanded ? flattenRecord(record) : [];

                            return (
                              <div key={id} className={styles.gwItemWrapper}>
                                <div
                                  className={`${styles.gwItem} ${isAdded ? styles.gwItemAdded : ""} ${isExpanded ? styles.gwItemExpanded : ""}`}
                                  onClick={() => setExpandedItemId((prev) => (prev === id ? null : id))}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setExpandedItemId((prev) => (prev === id ? null : id));
                                    }
                                  }}
                                >
                                  <span className={styles.gwItemChevron} aria-hidden>
                                    {isExpanded ? "▾" : "▸"}
                                  </span>
                                  <div className={styles.gwItemInfo}>
                                    <div className={styles.gwItemTitle}>{title}</div>
                                    {meta.length > 0 ? (
                                      <div className={styles.gwItemMeta}>
                                        {meta.map(([label, value], mi) => (
                                          <span key={`${label}-${mi}`} className={styles.gwItemMetaTag}>
                                            <span className={styles.gwItemMetaLabel}>{label}</span>
                                            <span className={styles.gwItemMetaValue}>{value}</span>
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                  {!isHealth ? (
                                    <button
                                      className={`${styles.gwAddBtn} ${isAdded ? styles.gwAddBtnOn : ""}`}
                                      onClick={(e) => { e.stopPropagation(); handleAddItem(id, title); }}
                                      title={isAdded ? "Remove from chatbot" : "Add to chatbot"}
                                    >
                                      {isAdded ? "✓" : "+"}
                                    </button>
                                  ) : null}
                                </div>
                                {isExpanded && detailPairs.length > 0 ? (
                                  <div className={styles.gwItemDetail}>
                                    <dl className={styles.gwDetailGrid}>
                                      {detailPairs.map(([label, value], pairIdx) => (
                                        <div key={`${label}-${pairIdx}`} className={styles.gwDetailRow}>
                                          <dt className={styles.gwDetailLabel}>{label}</dt>
                                          <dd className={styles.gwDetailValue}>{value}</dd>
                                        </div>
                                      ))}
                                    </dl>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={styles.gwEmptyState}>
                      <p className={styles.gwEmptyDesc}>Select a section from the left.</p>
                    </div>
                  )}
                </main>
              </div>

              {/* Policy builder */}
              {addedItems.size > 0 ? (
                <section className={styles.gwPolicy} aria-label="Gateway policy builder">
                  <div className={styles.gwPolicyHead}>
                    <div>
                      <p className={styles.kicker}>Selected configuration</p>
                      <h3>Gateway policy for this chatbot</h3>
                      <p>Use the selected models, tools, guardrails, and accounts to shape a publish-ready TrueFoundry gateway policy.</p>
                    </div>
                    <span>{addedItems.size} selected</span>
                  </div>

                  <div className={styles.gwPolicyGrid}>
                    <article className={styles.gwPolicyCard}>
                      <div className={styles.gwPolicyCardHead}>
                        <span>01</span>
                        <h4>Model routing and fallback</h4>
                      </div>
                      <label className={styles.gwPolicyField}>
                        Routing strategy
                        <select defaultValue="priority-based-routing">
                          <option value="priority-based-routing">Priority failover</option>
                          <option value="latency-based-routing">Latency optimized</option>
                          <option value="weight-based-routing">Weighted canary</option>
                        </select>
                      </label>
                      <div className={styles.gwCheckboxGrid}>
                        {fallbackStatusCodes.map((code) => (
                          <label key={code}>
                            <input type="checkbox" defaultChecked />
                            {code}
                          </label>
                        ))}
                      </div>
                      <div className={styles.gwMiniFields}>
                        <label>
                          Retry attempts
                          <input type="number" min="0" defaultValue="1" />
                        </label>
                        <label>
                          Delay ms
                          <input type="number" min="0" defaultValue="100" />
                        </label>
                        <label>
                          SLA cutoff
                          <input type="text" defaultValue="50ms / token" />
                        </label>
                      </div>
                    </article>

                    <article className={styles.gwPolicyCard}>
                      <div className={styles.gwPolicyCardHead}>
                        <span>02</span>
                        <h4>Usage and cost governance</h4>
                      </div>
                      <div className={styles.gwMiniFields}>
                        <label>
                          Rate limit
                          <input type="number" min="1" defaultValue="500" />
                        </label>
                        <label>
                          Unit
                          <select defaultValue="requests_per_minute">
                            <option value="requests_per_minute">req/min</option>
                            <option value="tokens_per_minute">tokens/min</option>
                            <option value="tokens_per_hour">tokens/hour</option>
                            <option value="requests_per_day">req/day</option>
                          </select>
                        </label>
                        <label>
                          Per
                          <select defaultValue="user">
                            <option value="user">user</option>
                            <option value="model">model</option>
                            <option value="virtualaccount">virtual account</option>
                          </select>
                        </label>
                        <label>
                          Budget $
                          <input type="number" min="0" defaultValue="100" />
                        </label>
                        <label>
                          Period
                          <select defaultValue="cost_per_day">
                            <option value="cost_per_day">daily</option>
                            <option value="cost_per_week">weekly</option>
                            <option value="cost_per_month">monthly</option>
                          </select>
                        </label>
                        <label>
                          Alert %
                          <input type="text" defaultValue="75, 90, 100" />
                        </label>
                      </div>
                    </article>

                    <article className={styles.gwPolicyCard}>
                      <div className={styles.gwPolicyCardHead}>
                        <span>03</span>
                        <h4>Safety, access, and tools</h4>
                      </div>
                      <div className={styles.gwCheckboxStack}>
                        {getInventoryItems("guardrails").length > 0
                          ? getInventoryItems("guardrails").map((g) => (
                              <label key={g.id}><input type="checkbox" defaultChecked /> {g.name}</label>
                            ))
                          : <span style={{ fontSize: 12, color: "#9b9aa6" }}>No guardrails configured</span>
                        }
                      </div>
                      <label className={styles.gwPolicyField}>
                        Subject scope
                        <input type="text" defaultValue="user:*, team:*, virtualaccount:*" />
                      </label>
                    </article>

                    <article className={styles.gwPolicyCard}>
                      <div className={styles.gwPolicyCardHead}>
                        <span>04</span>
                        <h4>Observability and metadata</h4>
                      </div>
                      <div className={styles.gwCheckboxStack}>
                        <label><input type="checkbox" defaultChecked /> Spans and traces</label>
                        <label><input type="checkbox" defaultChecked /> Cost by model and user</label>
                        <label><input type="checkbox" defaultChecked /> Token usage</label>
                        <label><input type="checkbox" defaultChecked /> Latency and TTFT</label>
                        <label><input type="checkbox" defaultChecked /> Resolved model headers</label>
                      </div>
                      <div className={styles.gwMiniFields}>
                        <label>
                          Metadata key
                          <input type="text" defaultValue="project_id" />
                        </label>
                        <label>
                          Destination
                          <input type="text" defaultValue={inventory.connection.dataRoutingDestination} />
                        </label>
                      </div>
                    </article>
                  </div>
                </section>
              ) : null}

              {/* Footer — added items */}
              {addedItems.size > 0 ? (
                <div className={styles.gwFooter}>
                  <div className={styles.gwFooterItems}>
                    {Array.from(addedItems.entries()).map(([id, title]) => (
                      <span key={id} className={styles.gwFooterChip}>
                        <span>{title}</span>
                        <button aria-label={`Remove ${title}`} onClick={() => handleAddItem(id, title)}>×</button>
                      </span>
                    ))}
                  </div>
                  <Link className={styles.gwPrimaryBtn} href="/builder/step-three" onClick={handleContinueToLiveTest}>
                    Continue with {addedItems.size} item{addedItems.size !== 1 ? "s" : ""} →
                  </Link>
                </div>
              ) : null}
        </div>
      ) : null}
    </div>
  );
}
