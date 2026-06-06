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
  try { return new URL(url).hostname; } catch {
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

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function traceRowVariant(icon: string): string {
  if (icon === "✅") return styles.traceRowSuccess;
  if (icon === "🚫" || icon === "🔴") return styles.traceRowError;
  if (icon === "🔧") return styles.traceRowTool;
  if (icon === "📄") return styles.traceRowResult;
  if (icon === "🛡️") return styles.traceRowGuard;
  if (icon === "🤖" || icon === "💬") return styles.traceRowModel;
  if (icon === "🔌") return styles.traceRowMcp;
  if (icon === "🔁") return styles.traceRowChain;
  if (icon === "👤") return styles.traceRowTier;
  return styles.traceRowDefault;
}

// ── Sample prompts (tier-tagged) ──────────────────────────────────────────────

const SAMPLE_PROMPTS: { tier: TierKey; text: string; desc: string }[] = [
  { tier: "guest",    text: "What is this chatbot and how do I embed it?",        desc: "Triggers search_docs_basic MCP tool — no auth needed" },
  { tier: "guest",    text: "How do I get started quickly?",                       desc: "Triggers get_quick_start MCP tool — returns 5-step guide" },
  { tier: "loggedIn", text: "What widget animation options are available?",        desc: "Triggers search_docs_standard — requires Logged-in tier" },
  { tier: "loggedIn", text: "Generate a purple-themed chatbot config called Aria", desc: "Triggers generate_widget_config — returns TypeScript config" },
  { tier: "pro",      text: "Explain the SSE streaming protocol in detail",        desc: "Triggers search_docs_expert — full internals, Pro only" },
  { tier: "pro",      text: "Give me a complete integration blueprint with code",  desc: "Triggers get_integration_blueprint — Pro tier required" },
];

// ── Live test page ────────────────────────────────────────────────────────────

export function LiveTestPage() {
  const [cfg] = useState<WidgetConfig>(readWidgetConfig);
  const [tierCfg, setTierCfg] = useState<SavedTierConfig>(readTierConfig);
  const [liveKey] = useState(readApiKey);
  const [activeTier, setActiveTier] = useState<TierKey>("guest");
  const [traceLog, setTraceLog] = useState<TraceEntry[]>([]);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [mcpCounts, setMcpCounts] = useState<Record<TierKey, number> | null>(null);

  // Fetch real tool counts per tier from MCP server (via backend)
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/chat/mcp-tools`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.counts) setMcpCounts(data.counts as Record<TierKey, number>);
      })
      .catch(() => {});
  }, []);

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

        const hasModel =
          saved?.tiers.guest.model || saved?.tiers.loggedIn.model || saved?.tiers.pro.model;
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

    return () => { ctrl.abort(); clearTimeout(timeoutId); };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const liveGatewayUrl = tierCfg?.gatewayUrl ?? null;
  const firstModel =
    tierCfg?.tiers.guest.model ?? tierCfg?.tiers.loggedIn.model ?? tierCfg?.tiers.pro.model ?? null;
  const activeTierData = tierCfg?.tiers[activeTier] ?? null;
  const activeModel = activeTierData?.model ?? firstModel;

  const builtSystemPrompt = [
    `You are ${cfg.assistantName}.`,
    cfg.greeting,
    cfg.subGreeting,
    `You have tools available — use them whenever they can help answer the user's question accurately.`,
    `If a tool tells you the user doesn't have access at their current tier, relay that clearly.`,
  ].filter(Boolean).join(" ");

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
          controlPlaneUrl: tierCfg?.controlPlaneUrl ?? "",
          systemPrompt: builtSystemPrompt,
        }
      : null;

  function addTrace(entry: TraceEntry) {
    setTraceLog((prev) => [entry, ...prev.slice(0, 49)]);
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedPrompt(text);
    setTimeout(() => setCopiedPrompt(null), 1500);
  }

  const botSlug = cfg.assistantName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-assistant";
  const canSwitchTier = !!(liveGatewayUrl && liveKey);

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
          <p>Click a tier card to simulate that user's access level, then chat on the right.</p>
        </div>
        <div className={stepStyles.headerActions}>
          <Link className={stepStyles.secondaryButton} href="/builder/step-two/existing-foundry-user">Back</Link>
          <Link className={stepStyles.primaryButton} href="/builder/final">Continue to Publish</Link>
        </div>
      </section>

      <div className={styles.layout}>

        {/* ── Left: controls ── */}
        <div className={styles.controlsCol}>

          {/* ── Status bar ── */}
          <div className={styles.statusBar}>
            {liveConfig ? (
              <>
                <span className={styles.statusDot} />
                <span className={styles.statusText}>Connected</span>
                <span className={styles.statusSep}>·</span>
                <code className={styles.statusCode}>{activeModel?.name}</code>
                <span className={styles.statusSep}>·</span>
                <span className={styles.statusText}>{truncateUrl(liveGatewayUrl ?? "")}</span>
              </>
            ) : (
              <>
                <span className={styles.statusDotOff} />
                <span className={styles.statusTextOff}>
                  {liveGatewayUrl && !liveKey
                    ? "API key missing — reconnect in Step 2"
                    : "Not connected — go back to Step 2"}
                </span>
              </>
            )}
            <span
              className={styles.statusTierPill}
              style={{ background: TIER_COLORS[activeTier] }}
            >
              {TIER_LABELS[activeTier]}
            </span>
          </div>

          {/* ── Tier simulator — cards ARE the selector ── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Simulate user tier
              <span className={styles.sectionSub}> — click a card to switch</span>
            </h3>

            {tierCfg ? (
              <div className={styles.tierGrid}>
                {TIER_KEYS.map((tier) => {
                  const t = tierCfg.tiers[tier];
                  const isActive = activeTier === tier;
                  return (
                    <button
                      key={tier}
                      className={`${styles.tierCard} ${isActive ? styles.tierCardActive : ""}`}
                      style={isActive ? { borderColor: TIER_COLORS[tier] } : undefined}
                      onClick={() => canSwitchTier && setActiveTier(tier)}
                      disabled={!canSwitchTier}
                      aria-pressed={isActive}
                    >
                      <div className={styles.tierCardHead}>
                        <span
                          className={styles.tierCardBadge}
                          style={{ background: TIER_COLORS[tier] }}
                        >
                          {isActive && <span className={styles.tierCardCheck}>✓ </span>}
                          {TIER_LABELS[tier]}
                        </span>
                      </div>
                      <div className={styles.tierCardRows}>
                        <div className={styles.tierCardRow}>
                          <span>Model</span>
                          <strong style={!t.model ? { color: "#c8c7d4" } : undefined}>
                            {t.model?.name ?? "—"}
                          </strong>
                        </div>
                        <div className={styles.tierCardRow}>
                          <span>Rate</span>
                          <strong style={!t.rateLimitPolicy ? { color: "#c8c7d4" } : undefined}>
                            {t.rateLimitPolicy?.name ?? "—"}
                          </strong>
                        </div>
                        {t.guardrails.length > 0 && (
                          <div className={styles.tierCardRow}>
                            <span>Guardrails</span>
                            <strong>{t.guardrails.length}</strong>
                          </div>
                        )}
                        {(mcpCounts ? mcpCounts[tier] > 0 : t.mcpTools.length > 0) && (
                          <div className={styles.tierCardRow}>
                            <span>MCP tools</span>
                            <strong>{mcpCounts ? mcpCounts[tier] : t.mcpTools.length}</strong>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={styles.emptyNote}>Connect gateway in Step 2 to load tier policies.</p>
            )}
          </div>

          {/* ── Gateway trace (always visible, chronological) ── */}
          <div className={styles.section}>
            <div className={styles.traceHead}>
              <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
                Gateway trace
                {traceLog.length > 0 && (
                  <span className={styles.traceCount}>{traceLog.length}</span>
                )}
              </h3>
              {traceLog.length > 0 && (
                <button className={styles.traceClearBtn} onClick={() => setTraceLog([])}>Clear</button>
              )}
            </div>
            <div className={styles.traceList}>
              {traceLog.length === 0 ? (
                <div className={styles.traceEmpty}>
                  Send a message to see the full gateway trace — model routing, MCP tool calls, guardrail checks, and latency.
                </div>
              ) : (
                traceLog.map((e, i) => (
                  <div key={i} className={`${styles.traceRow} ${traceRowVariant(e.icon)}`}>
                    <span className={styles.traceIcon}>{e.icon}</span>
                    <span className={styles.traceText}>{e.text}</span>
                    <span className={styles.traceMs}>{formatMs(e.ms)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Sample prompts ── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Sample prompts
              <span className={styles.sectionSub}> — click to copy, paste in chatbot</span>
            </h3>
            <div className={styles.promptList}>
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p.text}
                  className={`${styles.promptChip} ${copiedPrompt === p.text ? styles.promptChipCopied : ""}`}
                  onClick={() => copyPrompt(p.text)}
                  title="Click to copy"
                >
                  <span
                    className={styles.promptDot}
                    style={{ background: TIER_COLORS[p.tier] }}
                    title={TIER_LABELS[p.tier]}
                  />
                  <span className={styles.promptChipBody}>
                    <span className={styles.promptChipText}>{p.text}</span>
                    <span className={styles.promptChipDesc}>{p.desc}</span>
                  </span>
                  <span className={styles.promptChipAction}>
                    {copiedPrompt === p.text ? "✓" : "⎘"}
                  </span>
                </button>
              ))}
            </div>
          </div>

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
