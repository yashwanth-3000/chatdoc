"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  connectExistingFoundryUser,
  fetchSavedExistingFoundryInventory,
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

const inventoryGroups: Array<{ title: string; keys: string[] }> = [
  { title: "Gateway", keys: ["gatewayHealth", "availableModels", "providerAccounts", "modelIntegrations", "guardrails", "routingConfigs", "rateLimitConfigs", "budgetConfigs"] },
  { title: "Registries", keys: ["mcpServers", "agents", "prompts", "tracingProjects"] },
  { title: "Platform", keys: ["workspaces", "clusters", "applications"] },
  { title: "Access", keys: ["personalAccessTokens", "virtualAccounts", "teams", "secretGroups"] },
  { title: "Ledgers", keys: ["modelUsageLedger", "userUsageLedger", "recentRequestsLedger"] },
];

const gatewayFeatureCards = [
  {
    title: "Virtual model",
    summary: "Expose one stable model name while routing to real provider targets.",
    items: ["Provider group ownership", "Model slug", "Access control"],
  },
  {
    title: "Rerouting on failure",
    summary: "Fallback when a target fails, is overloaded, rate limited, or unhealthy.",
    items: ["401/403/404", "429 rate limit", "500/502/503"],
  },
  {
    title: "Load balancing",
    summary: "Choose the strategy before publishing the chatbot gateway policy.",
    items: ["Priority failover", "Latency optimized", "Weighted canary"],
  },
  {
    title: "Retries",
    summary: "Retry the same target before moving to the next fallback candidate.",
    items: ["Attempts", "Delay", "Retry status codes"],
  },
  {
    title: "Rate limits",
    summary: "Control request or token usage by user, model, virtual account, or metadata.",
    items: ["Requests/minute", "Tokens/hour", "Per user/model"],
  },
  {
    title: "Budget controls",
    summary: "Enforce cost limits and alerts for teams, users, models, or projects.",
    items: ["Daily/weekly/monthly", "Audit mode", "Alerts"],
  },
  {
    title: "Guardrails",
    summary: "Attach input, output, and MCP tool safety rules.",
    items: ["PII", "Moderation", "Prompt injection"],
  },
  {
    title: "Observability",
    summary: "Track traces, costs, tokens, latency, errors, and resolved model headers.",
    items: ["Spans", "Metrics", "Metadata"],
  },
  {
    title: "MCP tools",
    summary: "Attach registered or virtual MCP servers with tool-level guardrails.",
    items: ["Tool registry", "Virtual MCP", "Pre/post checks"],
  },
  {
    title: "Prompt overrides",
    summary: "Override request parameters or prompt versions per routing target.",
    items: ["Temperature", "Max tokens", "Prompt version"],
  },
];

const fallbackStatusCodes = ["401", "403", "404", "429", "500", "502", "503"];

function isRecord(value: unknown): value is InventoryRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecords(value: unknown): InventoryRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.data)) return (value.data as unknown[]).filter(isRecord);
  if (isRecord(value) && Array.isArray(value.items)) return (value.items as unknown[]).filter(isRecord);
  if (isRecord(value) && Array.isArray(value.results)) return (value.results as unknown[]).filter(isRecord);
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
    } else if (isRecord(value) && depth < 1) {
      pairs.push(...flattenRecord(value as InventoryRecord, formatKey(key), depth + 1));
    }
  }

  return pairs;
}

function getItemTitle(record: InventoryRecord, sectionKey: string, index: number): string {
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
  const [inventorySource, setInventorySource] = useState<"live" | "saved" | null>(null);
  const [activeSectionKey, setActiveSectionKey] = useState<string>("availableModels");
  const [addedItems, setAddedItems] = useState<Map<string, string>>(new Map());
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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

  return (
    <div className={stepStyles.designer}>
      {/* Step header — always shown */}
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
            <strong>Publish</strong>
          </div>
        </div>
        <div>
          <h1>
            {inventory
              ? "Foundry inventory"
              : isExisting
                ? "Connect your gateway"
                : "Connect your gateway"}
          </h1>
          <p>
            {inventory
              ? `${inventory.connection.okSections} sections loaded · Browse models, tools, and rules — click + to add to your chatbot.`
              : isExisting
                ? "Enter your TrueFoundry credentials to browse models, guardrails, MCP tools, and workspace resources."
                : "Connect TrueFoundry to bring in models, ledgers, MCP tools, and gateway policy."}
          </p>
        </div>
        <div className={stepStyles.headerActions}>
          <Link className={stepStyles.secondaryButton} href="/builder/step-one">
            Back
          </Link>
          {inventory ? (
            <Link className={stepStyles.primaryButton} href="/builder/final">
              {addedItems.size > 0 ? `Continue (${addedItems.size} added)` : "Continue"}
            </Link>
          ) : null}
        </div>
      </section>

      {/* ── Chooser mode ─────────────────────────────── */}
      {isChooser ? (
        <section className={styles.foundryAccess} aria-label="TrueFoundry connection">
          <div className={styles.chooseLayout}>

            {/* Left — connect */}
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

            {/* Right — feature showcase */}
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
                <label className={styles.gwFormLabel}>
                  Control plane URL
                </label>
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

              <div className={`${styles.gwFormField} ${styles.gwFormFieldFull}`}>
                <label className={styles.gwFormLabel}>
                  Gateway base URL{" "}
                  <span className={styles.gwFormOptional}>optional — defaults to /api/llm</span>
                </label>
                <input
                  className={styles.gwFormInput}
                  type="url"
                  placeholder="https://your-org.truefoundry.cloud/api/llm"
                  value={form.gatewayBaseUrl}
                  onChange={(e) => setForm((c) => ({ ...c, gatewayBaseUrl: e.target.value }))}
                />
              </div>

              {error ? (
                <p className={`${styles.errorText} ${styles.gwFormFieldFull}`}>{error}</p>
              ) : null}

              <div className={`${styles.gwFormActions} ${styles.gwFormFieldFull}`}>
                <button type="submit" className={styles.gwPrimaryBtn} disabled={loading || layoutLoading}>
                  {loading ? "Connecting..." : "Fetch inventory"}
                </button>
                <button
                  type="button"
                  className={styles.gwSecondaryBtn}
                  disabled={loading || layoutLoading}
                  onClick={handleLoadSavedInventory}
                >
                  {layoutLoading ? "Loading…" : "Test with saved data"}
                </button>
              </div>
            </form>
            <p className={styles.gwConnectFoot}>
              Credentials are only used during this request and are never stored by ChatDock.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Existing: inventory browser ──────────────── */}
      {isExisting && inventory ? (
        <div className={styles.gwBrowser}>
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
                    <strong>{inventory.highlights.mcpServers}</strong> MCP tools
                  </span>
                )}
                {inventory.highlights.guardrails > 0 && (
                  <span className={styles.gwStat}>
                    <strong>{inventory.highlights.guardrails}</strong> guardrails
                  </span>
                )}
                <span className={styles.gwStatSource}>
                  {inventorySource === "saved" ? "saved snapshot" : "live"}
                </span>
              </div>
            </div>
            <div className={styles.gwBarRight}>
              {addedItems.size > 0 ? (
                <span className={styles.gwAdded}>{addedItems.size} added to chatbot</span>
              ) : null}
              <button
                className={styles.gwSecondaryBtn}
                onClick={() => {
                  setInventory(null);
                  setInventorySource(null);
                  setAddedItems(new Map());
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
              {groupedInventory.map((group) => (
                <div key={group.title} className={styles.gwNavGroup}>
                  <p className={styles.gwNavGroupLabel}>{group.title}</p>
                  {group.sections.map((section) => (
                    <button
                      key={section.key}
                      className={`${styles.gwNavBtn} ${activeSectionKey === section.key ? styles.gwNavBtnActive : ""}`}
                      onClick={() => { setActiveSectionKey(section.key); setExpandedItemId(null); }}
                    >
                      <span className={styles.gwNavBtnLabel}>{section.title}</span>
                      <span className={styles.gwNavBadge} data-status={section.status}>
                        {section.count}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
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
                    ) : getActiveRecords().length === 0 ? (
                      <div className={styles.gwEmptyState}>
                        <p className={styles.gwEmptyTitle}>No records</p>
                        <p className={styles.gwEmptyDesc}>No items found in this section for your tenant.</p>
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
                                    {meta.map(([label, value]) => (
                                      <span key={label} className={styles.gwItemMetaTag}>
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
                                  {detailPairs.map(([label, value]) => (
                                    <div key={label} className={styles.gwDetailRow}>
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
                        <option value="requests_per_minute">requests/min</option>
                        <option value="tokens_per_minute">tokens/min</option>
                        <option value="tokens_per_hour">tokens/hour</option>
                        <option value="requests_per_day">requests/day</option>
                      </select>
                    </label>
                    <label>
                      Applies per
                      <select defaultValue="user">
                        <option value="user">user</option>
                        <option value="model">model</option>
                        <option value="virtualaccount">virtual account</option>
                        <option value="metadata.project_id">metadata.project_id</option>
                      </select>
                    </label>
                    <label>
                      Budget
                      <input type="number" min="0" defaultValue="100" />
                    </label>
                    <label>
                      Budget period
                      <select defaultValue="cost_per_day">
                        <option value="cost_per_day">daily</option>
                        <option value="cost_per_week">weekly</option>
                        <option value="cost_per_month">monthly</option>
                      </select>
                    </label>
                    <label>
                      Alerts
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
                    <label><input type="checkbox" defaultChecked /> Input PII guardrail</label>
                    <label><input type="checkbox" defaultChecked /> Output PII guardrail</label>
                    <label><input type="checkbox" defaultChecked /> Content moderation</label>
                    <label><input type="checkbox" defaultChecked /> Prompt injection checks</label>
                    <label><input type="checkbox" defaultChecked /> MCP pre-invoke checks</label>
                    <label><input type="checkbox" /> MCP post-invoke checks</label>
                  </div>
                  <label className={styles.gwPolicyField}>
                    Subject scope
                    <input type="text" defaultValue="user:*, team:*, virtualaccount:*" />
                  </label>
                </article>

                <article className={styles.gwPolicyCard}>
                  <div className={styles.gwPolicyCardHead}>
                    <span>04</span>
                    <h4>Observability and request metadata</h4>
                  </div>
                  <div className={styles.gwCheckboxStack}>
                    <label><input type="checkbox" defaultChecked /> Spans and traces</label>
                    <label><input type="checkbox" defaultChecked /> Cost by model and user</label>
                    <label><input type="checkbox" defaultChecked /> Token usage</label>
                    <label><input type="checkbox" defaultChecked /> Latency, TTFT, and inter-token latency</label>
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

              <div className={styles.gwFeatureMatrix}>
                {gatewayFeatureCards.map((feature) => (
                  <article key={feature.title}>
                    <h4>{feature.title}</h4>
                    <p>{feature.summary}</p>
                    <div>
                      {feature.items.map((item) => <span key={item}>{item}</span>)}
                    </div>
                  </article>
                ))}
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
                    <button
                      aria-label={`Remove ${title}`}
                      onClick={() => handleAddItem(id, title)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <Link className={styles.gwPrimaryBtn} href="/builder/final">
                Continue with {addedItems.size} item{addedItems.size !== 1 ? "s" : ""} →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
