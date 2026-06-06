"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MiniWidget, BACKEND_URL } from "./mini-widget";
import type { LiveConfig, TraceEntry, WidgetConfig } from "./mini-widget";
import styles from "./live-test-page.module.css";
import stepStyles from "./widget-designer.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type TierKey = "guest" | "loggedIn" | "pro";
type TierItemRef = { id: string; name: string };
type TierConfig = { model: TierItemRef | null; rateLimitPolicy: TierItemRef | null; guardrails: TierItemRef[]; mcpTools: TierItemRef[] };
type SavedTierConfig = {
  tiers: Record<TierKey, TierConfig>;
  gatewayUrl?: string;
  controlPlaneUrl?: string;
  savedAt?: string;
} | null;

// ── Tier meta ─────────────────────────────────────────────────────────────────

const TIER_KEYS: TierKey[] = ["guest", "loggedIn", "pro"];

const TIER_LABELS: Record<TierKey, string> = {
  guest:    "Guest",
  loggedIn: "Logged-in",
  pro:      "Pro",
};

const TIER_COLORS: Record<TierKey, string> = {
  guest:    "#5b5a66",
  loggedIn: "#2563eb",
  pro:      "#7c3aed",
};

// ── Session readers ───────────────────────────────────────────────────────────

const WIDGET_DEFAULT: WidgetConfig = {
  assistantName: "Acme Support Copilot",
  launcherLabel: "AI",
  greeting: "Need help choosing a plan?",
  subGreeting: "I can answer product questions, compare pricing, and create a support ticket.",
  panelSize: "standard",
  animation: "slide",
  shadow: "deep",
  accentColor: "#f75c30",
  panelColor: "#ffffff",
  messageColor: "#161425",
  messageTextColor: "#ffffff",
  userBubbleColor: "#ffffff",
  userTextColor: "#0d1221",
  launcherColor: "#f75c30",
  stageBackground: "#fcfbfa",
  surfaceStyle: "matte",
  cornerRadius: 18,
};

function readWidgetConfig(): WidgetConfig {
  if (typeof window === "undefined") return WIDGET_DEFAULT;
  try {
    const raw = sessionStorage.getItem("chatdock_widget_config");
    if (raw) return { ...WIDGET_DEFAULT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return WIDGET_DEFAULT;
}

function readTierConfig(): SavedTierConfig {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("chatdock_tier_config");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function readApiKey(): string {
  if (typeof window === "undefined") return "";
  try { return sessionStorage.getItem("chatdock_api_key") ?? ""; } catch { return ""; }
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return url.length > 35 ? url.slice(0, 35) + "…" : url;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unitLabel(unit: string): string {
  if (unit === "requests_per_day")    return "req/day";
  if (unit === "requests_per_hour")   return "req/hr";
  if (unit === "requests_per_minute") return "req/min";
  if (unit === "tokens_per_day")      return "tok/day";
  return unit.replace(/_/g, " ");
}

const RULE_TO_TIER: Record<string, TierKey> = {
  guests: "guest",
  "logged-in": "loggedIn",
  pro: "pro",
};

// ── Live test page ────────────────────────────────────────────────────────────

export function LiveTestPage() {
  const [cfg] = useState<WidgetConfig>(readWidgetConfig);
  const [tierCfg, setTierCfg] = useState<SavedTierConfig>(readTierConfig);
  const [liveKey] = useState(readApiKey);
  const [activeTier, setActiveTier] = useState<TierKey>("guest");
  const [traceLog, setTraceLog] = useState<TraceEntry[]>([]);

  useEffect(() => {
    const saved = readTierConfig();

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 5000);

    fetch(`${BACKEND_URL}/api/existing-foundry-user/saved-inventory`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        clearTimeout(timeoutId);
        if (!data) return;

        const gwUrl: string = saved?.gatewayUrl ?? data.connection?.gatewayBaseUrl ?? "";
        const allSections: Array<{ key: string; records?: unknown[] }> = data.sections ?? [];

        // ── Rate limit overlay — map rule IDs to tier keys ──
        const rlSection = allSections.find((s) => s.key === "rateLimitConfigs");
        const rlRecords = (rlSection?.records ?? []) as Array<Record<string, unknown>>;
        const rateLimitByTier: Partial<Record<TierKey, TierItemRef>> = {};
        for (const rec of rlRecords) {
          const ruleId = rec.id as string;
          const tierKey = RULE_TO_TIER[ruleId];
          if (tierKey) {
            rateLimitByTier[tierKey] = {
              id: ruleId,
              name: `${rec.limit_to as number} ${unitLabel(rec.unit as string)}`,
            };
          }
        }

        // ── Model — only needed if saved config has no model ──
        const hasModel =
          saved?.tiers.guest.model ||
          saved?.tiers.loggedIn.model ||
          saved?.tiers.pro.model;
        let modelRef: TierItemRef | null = null;
        if (!hasModel && gwUrl) {
          for (const sectionKey of ["providerAccounts", "availableModels"]) {
            const section = allSections.find((s) => s.key === sectionKey);
            const recs = (section?.records ?? []) as Array<Record<string, unknown>>;
            const virtualRec = recs.find(
              (r) => (r.manifest as Record<string, unknown>)?.type === "provider-account/virtual-model"
            );
            const candidate = virtualRec ?? recs[0];
            if (candidate) {
              const name = (candidate.name as string) ?? (candidate.id as string) ?? "";
              if (name) { modelRef = { id: name, name }; break; }
            }
          }
        }

        setTierCfg((prev) => {
          const gw = gwUrl || prev?.gatewayUrl;
          if (!gw) return prev;

          const emptyTier: TierConfig = { model: null, rateLimitPolicy: null, guardrails: [], mcpTools: [] };
          const base: NonNullable<SavedTierConfig> = prev ?? {
            tiers: { guest: emptyTier, loggedIn: emptyTier, pro: emptyTier },
            gatewayUrl: gw,
            controlPlaneUrl: data.connection?.controlPlaneUrl ?? "",
            savedAt: new Date().toISOString(),
          };

          return {
            ...base,
            gatewayUrl: gw,
            tiers: {
              guest:    { ...base.tiers.guest,    model: base.tiers.guest.model    ?? modelRef, rateLimitPolicy: rateLimitByTier.guest    ?? base.tiers.guest.rateLimitPolicy },
              loggedIn: { ...base.tiers.loggedIn, model: base.tiers.loggedIn.model ?? modelRef, rateLimitPolicy: rateLimitByTier.loggedIn ?? base.tiers.loggedIn.rateLimitPolicy },
              pro:      { ...base.tiers.pro,      model: base.tiers.pro.model      ?? modelRef, rateLimitPolicy: rateLimitByTier.pro      ?? base.tiers.pro.rateLimitPolicy },
            },
          };
        });
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") return;
      });

    return () => {
      ctrl.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  const liveGatewayUrl = tierCfg?.gatewayUrl ?? null;

  // The first available model across any tier (for fallback)
  const firstModel =
    tierCfg?.tiers.guest.model ??
    tierCfg?.tiers.loggedIn.model ??
    tierCfg?.tiers.pro.model ??
    null;

  // Active tier's model — falls back to firstModel so chat always has something to use
  const activeTierData = tierCfg?.tiers[activeTier] ?? null;
  const activeModel = activeTierData?.model ?? firstModel;

  const liveConfig: LiveConfig | null =
    liveGatewayUrl && activeModel && liveKey
      ? {
          gatewayUrl: liveGatewayUrl,
          modelId: activeModel.id,
          apiKey: liveKey,
          chaosMode: null,
          primaryModelLabel: activeModel.name,
          fallbackModelLabel: activeModel.name,
          userTier: activeTier,
        }
      : null;

  function addTrace(entry: TraceEntry) {
    setTraceLog((prev) => [entry, ...prev.slice(0, 29)]);
  }

  const botSlug = cfg.assistantName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "my-assistant";

  return (
    <div className={stepStyles.designer}>
      <section className={stepStyles.header}>
        <div className={stepStyles.stepRail} aria-label="Builder progress">
          <div className={stepStyles.stepNode}><span>1</span><strong>Widget UI</strong></div>
          <i />
          <div className={stepStyles.stepNode}><span>2</span><strong>Gateway</strong></div>
          <i />
          <div className={`${stepStyles.stepNode} ${stepStyles.stepActive}`}><span>3</span><strong>Live test</strong></div>
          <i />
          <div className={stepStyles.stepNode}><span>4</span><strong>Publish</strong></div>
        </div>
        <div>
          <h1>Test your chatbot live</h1>
          <p>Switch user tiers to see how each policy set shapes the chatbot experience.</p>
        </div>
        <div className={stepStyles.headerActions}>
          <Link className={stepStyles.secondaryButton} href="/builder/step-two/existing-foundry-user">Back</Link>
          <Link className={stepStyles.primaryButton} href="/builder/final">Continue to Publish</Link>
        </div>
      </section>

      <div className={styles.layout}>

        {/* ── Left: controls ── */}
        <div className={styles.controlsCol}>

          {/* Connection status */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Connection</h3>
            {liveConfig ? (
              <div className={styles.connCard}>
                <div className={styles.connRow}>
                  <span className={styles.connKey}>Model</span>
                  <span className={styles.connVal}>{activeModel?.name}</span>
                </div>
                <div className={styles.connRow}>
                  <span className={styles.connKey}>Gateway</span>
                  <span className={styles.connVal}>{truncateUrl(liveGatewayUrl ?? "")}</span>
                </div>
                <div className={styles.connStatus}>
                  <span className={styles.connDot} />
                  <span>Ready — send a message to test</span>
                </div>
              </div>
            ) : (
              <div className={styles.connCard}>
                <p className={styles.connEmpty}>
                  {liveGatewayUrl && !liveKey
                    ? "API key not found. Go back to Step 2 and reconnect."
                    : "Go back to Step 2 to connect your TrueFoundry gateway."}
                </p>
              </div>
            )}
          </div>

          {/* ── Break It — redesigned ── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Break It
              <span className={styles.sectionSub}> — simulate user tiers</span>
            </h3>

            {/* Part 1: Tier policy display — reads from tierCfg, nothing hardcoded */}
            {tierCfg ? (
              <div className={styles.tierPolicyGrid}>
                {TIER_KEYS.map((tier) => {
                  const t = tierCfg.tiers[tier];
                  const isActive = activeTier === tier;
                  return (
                    <div
                      key={tier}
                      className={`${styles.tierPolicyCard} ${isActive ? styles.tierPolicyCardActive : ""}`}
                      style={isActive ? { borderColor: TIER_COLORS[tier] } : undefined}
                    >
                      <span
                        className={styles.tierPolicyBadge}
                        style={{ background: TIER_COLORS[tier] }}
                      >
                        {TIER_LABELS[tier]}
                      </span>
                      <div className={styles.tierPolicyRows}>
                        <div className={styles.tierPolicyRow}>
                          <span>Model</span>
                          <strong style={!t.model ? { color: "#c8c7d4" } : undefined}>
                            {t.model?.name ?? "—"}
                          </strong>
                        </div>
                        <div className={styles.tierPolicyRow}>
                          <span>Rate limit</span>
                          <strong style={!t.rateLimitPolicy ? { color: "#c8c7d4" } : undefined}>
                            {t.rateLimitPolicy?.name ?? "—"}
                          </strong>
                        </div>
                        {t.guardrails.length > 0 ? (
                          <div className={styles.tierPolicyRow}>
                            <span>Guardrails</span>
                            <strong>{t.guardrails.length}</strong>
                          </div>
                        ) : null}
                        {t.mcpTools.length > 0 ? (
                          <div className={styles.tierPolicyRow}>
                            <span>MCP tools</span>
                            <strong>{t.mcpTools.length}</strong>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.connEmpty}>
                Connect gateway in Step 2 to load tier policies.
              </p>
            )}

            {/* Divider */}
            <div className={styles.tierDivider} />

            {/* Part 2: Tier simulator buttons */}
            <div className={styles.tierBtnRow}>
              {TIER_KEYS.map((tier) => {
                const isActive = activeTier === tier;
                return (
                  <button
                    key={tier}
                    className={`${styles.tierBtn} ${isActive ? styles.tierBtnActive : ""}`}
                    style={isActive ? { borderColor: TIER_COLORS[tier], color: TIER_COLORS[tier] } : undefined}
                    onClick={() => setActiveTier(tier)}
                    disabled={!liveGatewayUrl || !liveKey}
                  >
                    {isActive && <span className={styles.tierBtnCheck}>✓</span>}
                    {TIER_LABELS[tier]}
                  </button>
                );
              })}
            </div>

            <p className={styles.tierActiveNote}>
              Active:{" "}
              <span
                className={styles.tierBadgeInline}
                style={{ background: TIER_COLORS[activeTier] }}
              >
                {TIER_LABELS[activeTier]}
              </span>
              {" "}→ model:{" "}
              <code>{activeModel?.name ?? "not configured"}</code>
            </p>
          </div>

          {/* Trace log */}
          {traceLog.length > 0 && (
            <div className={styles.section}>
              <div className={styles.traceHead}>
                <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Gateway trace</h3>
                <button className={styles.traceClearBtn} onClick={() => setTraceLog([])}>Clear</button>
              </div>
              <div className={styles.traceList}>
                {traceLog.map((e, i) => (
                  <div key={i} className={styles.traceRow}>
                    <span className={styles.traceIcon}>{e.icon}</span>
                    <span className={styles.traceText}>{e.text}</span>
                    <span className={styles.traceMs}>{e.ms}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Right: browser preview ── */}
        <div className={styles.previewCol}>
          <div className={styles.browser}>
            <div className={styles.browserBar}>
              <span className={styles.browserDot} style={{ background: cfg.accentColor }} />
              <span className={styles.browserDot} />
              <span className={styles.browserDot} />
              <div className={styles.browserUrl}>{botSlug}.yoursite.com</div>
            </div>
            <div className={styles.browserBody} style={{ background: cfg.stageBackground }}>
              <div className={styles.pageLines}>
                <span /><span /><span /><span />
              </div>
              <MiniWidget cfg={cfg} liveConfig={liveConfig} onTrace={addTrace} />
            </div>
            <div className={styles.browserFooter}>
              {liveConfig
                ? <span className={styles.liveBadge}>live · {activeModel?.name}</span>
                : <span className={styles.offlineBadge}>offline</span>
              }
              <span
                className={styles.tierFooterBadge}
                style={{ background: TIER_COLORS[activeTier] }}
              >
                {TIER_LABELS[activeTier]}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
