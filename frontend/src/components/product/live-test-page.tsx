"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bot, Gauge, ShieldCheck, Plug2, Globe, CheckCircle2,
  WifiOff, Clock, Copy, Check, Cpu,
} from "lucide-react";
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
  guest:    "#52525b",
  loggedIn: "#2563eb",
  pro:      "#7c3aed",
};

const TIER_BG: Record<TierKey, string> = {
  guest:    "rgba(82,82,91,0.08)",
  loggedIn: "rgba(37,99,235,0.08)",
  pro:      "rgba(124,58,237,0.08)",
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

type TraceMeta = { cls: string; badge: string; dot: string };

function traceRowMeta(icon: string): TraceMeta {
  if (icon === "✅") return { cls: styles.traceRowSuccess, badge: "DONE",  dot: "#22c55e" };
  if (icon === "🚫" || icon === "🔴") return { cls: styles.traceRowError,  badge: "ERR",   dot: "#ef4444" };
  if (icon === "🔧") return { cls: styles.traceRowTool,   badge: "TOOL",  dot: "#3b82f6" };
  if (icon === "📄") return { cls: styles.traceRowResult, badge: "RES",   dot: "#06b6d4" };
  if (icon === "🛡️") return { cls: styles.traceRowGuard,  badge: "GUARD", dot: "#f59e0b" };
  if (icon === "🤖" || icon === "💬") return { cls: styles.traceRowModel, badge: "LLM", dot: "#a855f7" };
  if (icon === "🔌" || icon === "🔩") return { cls: styles.traceRowMcp,   badge: "MCP",   dot: "#6366f1" };
  if (icon === "🔁") return { cls: styles.traceRowChain,  badge: "LOOP",  dot: "#8b5cf6" };
  if (icon === "👤") return { cls: styles.traceRowTier,   badge: "TIER",  dot: "#52525b" };
  if (icon === "⚡") return { cls: styles.traceRowDefault, badge: "REQ",  dot: "#71717a" };
  return { cls: styles.traceRowDefault, badge: "LOG", dot: "#3f3f46" };
}

// ── Sample prompts ────────────────────────────────────────────────────────────

const SAMPLE_PROMPTS: { tier: TierKey; text: string; desc: string }[] = [
  { tier: "guest",    text: "What is this chatbot and how do I embed it?",        desc: "search_docs_basic — no auth needed" },
  { tier: "guest",    text: "How do I get started quickly?",                       desc: "get_quick_start — returns 5-step guide" },
  { tier: "loggedIn", text: "What widget animation options are available?",        desc: "search_docs_standard — Logged-in tier" },
  { tier: "loggedIn", text: "Generate a purple-themed chatbot config called Aria", desc: "generate_widget_config — returns TypeScript" },
  { tier: "pro",      text: "Explain the SSE streaming protocol in detail",        desc: "search_docs_expert — Pro tier only" },
  { tier: "pro",      text: "Give me a complete integration blueprint with code",  desc: "get_integration_blueprint — Pro tier only" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveTestPage() {
  const [cfg] = useState<WidgetConfig>(readWidgetConfig);
  const [tierCfg, setTierCfg] = useState<SavedTierConfig>(readTierConfig);
  const [liveKey] = useState(readApiKey);
  const [activeTier, setActiveTier] = useState<TierKey>("guest");
  const [traceLog, setTraceLog] = useState<TraceEntry[]>([]);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [mcpCounts, setMcpCounts] = useState<Record<TierKey, number> | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/chat/mcp-tools`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.counts) setMcpCounts(data.counts as Record<TierKey, number>); })
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
          if (tierKey) rateLimitByTier[tierKey] = { id: ruleId, name: `${rec.limit_to as number} ${unitLabel(rec.unit as string)}` };
        }
        const hasModel = saved?.tiers.guest.model || saved?.tiers.loggedIn.model || saved?.tiers.pro.model;
        let modelRef: TierItemRef | null = null;
        if (!hasModel && gwUrl) {
          for (const sectionKey of ["providerAccounts", "availableModels"]) {
            const section = allSections.find((s) => s.key === sectionKey);
            const recs = (section?.records ?? []) as Array<Record<string, unknown>>;
            const virtualRec = recs.find((r) => (r.manifest as Record<string, unknown>)?.type === "provider-account/virtual-model");
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
            gatewayUrl: gw, controlPlaneUrl: data.connection?.controlPlaneUrl ?? "",
            savedAt: new Date().toISOString(),
          };
          return {
            ...base, gatewayUrl: gw,
            tiers: {
              guest:    { ...base.tiers.guest,    model: base.tiers.guest.model    ?? modelRef, rateLimitPolicy: rateLimitByTier.guest    ?? base.tiers.guest.rateLimitPolicy },
              loggedIn: { ...base.tiers.loggedIn, model: base.tiers.loggedIn.model ?? modelRef, rateLimitPolicy: rateLimitByTier.loggedIn ?? base.tiers.loggedIn.rateLimitPolicy },
              pro:      { ...base.tiers.pro,      model: base.tiers.pro.model      ?? modelRef, rateLimitPolicy: rateLimitByTier.pro      ?? base.tiers.pro.rateLimitPolicy },
            },
          };
        });
      })
      .catch((err) => { clearTimeout(timeoutId); if (err instanceof Error && err.name === "AbortError") return; });
    return () => { ctrl.abort(); clearTimeout(timeoutId); };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const liveGatewayUrl = tierCfg?.gatewayUrl ?? null;
  const firstModel = tierCfg?.tiers.guest.model ?? tierCfg?.tiers.loggedIn.model ?? tierCfg?.tiers.pro.model ?? null;
  const activeTierData = tierCfg?.tiers[activeTier] ?? null;
  const activeModel = activeTierData?.model ?? firstModel;
  const canSwitch = !!(liveGatewayUrl && liveKey);

  const builtSystemPrompt = `You are ${cfg.assistantName}, an AI assistant. Only answer specific questions by using your available tools — never invent product details, pricing, or technical specifications. For greetings and general conversation, respond naturally and briefly. If a tool indicates the user's tier lacks access, explain that clearly.`;

  const liveConfig: LiveConfig | null = liveGatewayUrl && activeModel && liveKey ? {
    gatewayUrl: liveGatewayUrl, modelId: activeModel.id, apiKey: liveKey,
    chaosMode: null, primaryModelLabel: activeModel.name, fallbackModelLabel: activeModel.name,
    userTier: activeTier, controlPlaneUrl: tierCfg?.controlPlaneUrl ?? "",
    systemPrompt: builtSystemPrompt,
  } : null;

  function addTrace(entry: TraceEntry) {
    setTraceLog((prev) => [entry, ...prev.slice(0, 49)]);
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedPrompt(text);
    setTimeout(() => setCopiedPrompt(null), 1500);
  }

  const botSlug = cfg.assistantName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-assistant";

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
        <div className={styles.controlsCol}>

          {/* ── Connection status bar ── */}
          <div className={styles.statusBar}>
            {liveConfig ? (
              <div className={styles.statusConnected}>
                <span className={styles.statusIndicator}>
                  <CheckCircle2 size={13} strokeWidth={2.5} />
                  Connected
                </span>
                <span className={styles.statusDivider} />
                <span className={styles.statusItem}>
                  <Cpu size={11} strokeWidth={2.5} />
                  <code>{activeModel?.name}</code>
                </span>
                <span className={styles.statusDivider} />
                <span className={styles.statusItem}>
                  <Globe size={11} strokeWidth={2.5} />
                  {truncateUrl(liveGatewayUrl ?? "")}
                </span>
                <span
                  className={styles.statusTierPill}
                  style={{ background: TIER_COLORS[activeTier], boxShadow: `0 0 0 1px ${TIER_COLORS[activeTier]}33` }}
                >
                  {TIER_LABELS[activeTier]}
                </span>
              </div>
            ) : (
              <div className={styles.statusDisconnected}>
                <WifiOff size={13} strokeWidth={2} />
                <span>{liveGatewayUrl && !liveKey ? "API key missing — reconnect in Step 2" : "Not connected — go back to Step 2"}</span>
              </div>
            )}
          </div>

          {/* ── Tier simulator ── */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Simulate user tier</h3>
              <span className={styles.sectionHint}>click card to switch</span>
            </div>

            {tierCfg ? (
              <div className={styles.tierGrid}>
                {TIER_KEYS.map((tier) => {
                  const t = tierCfg.tiers[tier];
                  const isActive = activeTier === tier;
                  const mcpCount = mcpCounts ? mcpCounts[tier] : t.mcpTools.length;
                  return (
                    <button
                      key={tier}
                      className={`${styles.tierCard} ${isActive ? styles.tierCardActive : ""}`}
                      style={isActive ? {
                        borderColor: TIER_COLORS[tier],
                        background: TIER_BG[tier],
                        boxShadow: `0 0 0 1px ${TIER_COLORS[tier]}22, 0 4px 16px ${TIER_COLORS[tier]}18`,
                      } : undefined}
                      onClick={() => canSwitch && setActiveTier(tier)}
                      disabled={!canSwitch}
                      aria-pressed={isActive}
                    >
                      <div className={styles.tierCardHeader}>
                        <span
                          className={styles.tierCardBadge}
                          style={{ background: isActive ? TIER_COLORS[tier] : "transparent", color: isActive ? "#fff" : TIER_COLORS[tier], border: `1.5px solid ${TIER_COLORS[tier]}55` }}
                        >
                          {isActive && <Check size={9} strokeWidth={3} style={{ marginRight: 3 }} />}
                          {TIER_LABELS[tier]}
                        </span>
                      </div>

                      <div className={styles.tierCardMetrics}>
                        <div className={styles.metric}>
                          <span className={styles.metricIcon}><Bot size={10} strokeWidth={2} /></span>
                          <span className={styles.metricLabel}>Model</span>
                          <strong className={styles.metricValue} style={!t.model ? { color: "#d1d5db" } : undefined}>
                            {t.model?.name ?? "—"}
                          </strong>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricIcon}><Gauge size={10} strokeWidth={2} /></span>
                          <span className={styles.metricLabel}>Rate</span>
                          <strong className={styles.metricValue} style={!t.rateLimitPolicy ? { color: "#d1d5db" } : undefined}>
                            {t.rateLimitPolicy?.name ?? "—"}
                          </strong>
                        </div>
                        {t.guardrails.length > 0 && (
                          <div className={styles.metric}>
                            <span className={styles.metricIcon}><ShieldCheck size={10} strokeWidth={2} /></span>
                            <span className={styles.metricLabel}>Guardrails</span>
                            <strong className={styles.metricValue}>{t.guardrails.length}</strong>
                          </div>
                        )}
                        {mcpCount > 0 && (
                          <div className={styles.metric}>
                            <span className={styles.metricIcon}><Plug2 size={10} strokeWidth={2} /></span>
                            <span className={styles.metricLabel}>MCP tools</span>
                            <strong className={styles.metricValue}>{mcpCount}</strong>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={styles.emptyNote}>Connect your gateway in Step 2 to load tier policies.</p>
            )}
          </div>

          {/* ── Gateway trace ── */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>
                Gateway trace
                {traceLog.length > 0 && <span className={styles.traceCount}>{traceLog.length}</span>}
              </h3>
              {traceLog.length > 0 && (
                <button className={styles.traceClearBtn} onClick={() => setTraceLog([])}>Clear</button>
              )}
            </div>
            <div className={styles.traceList}>
              {traceLog.length === 0 ? (
                <div className={styles.traceEmpty}>
                  <Clock size={14} strokeWidth={1.5} style={{ opacity: 0.4 }} />
                  <span>Send a message to see model routing, MCP tool calls, guardrail checks, and latency.</span>
                </div>
              ) : (
                traceLog.map((e, i) => {
                  const { cls, badge, dot } = traceRowMeta(e.icon);
                  const seq = traceLog.length - i;
                  return (
                    <div key={i} className={`${styles.traceRow} ${cls}`} title={e.text}>
                      <span className={styles.traceSeq}>{seq}</span>
                      <span className={styles.traceBadge} style={{ background: dot + "22", color: dot, borderColor: dot + "44" }}>{badge}</span>
                      <span className={styles.traceText}>{e.text}</span>
                      {e.ms > 0 && <span className={styles.traceMs}>{formatMs(e.ms)}</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Sample prompts ── */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Sample prompts</h3>
              <span className={styles.sectionHint}>click to copy</span>
            </div>
            <div className={styles.promptList}>
              {SAMPLE_PROMPTS.map((p) => {
                const copied = copiedPrompt === p.text;
                return (
                  <button
                    key={p.text}
                    className={`${styles.promptChip} ${copied ? styles.promptChipCopied : ""}`}
                    onClick={() => copyPrompt(p.text)}
                  >
                    <span className={styles.promptDot} style={{ background: TIER_COLORS[p.tier] }} />
                    <span className={styles.promptChipBody}>
                      <span className={styles.promptChipText}>{p.text}</span>
                      <span className={styles.promptChipDesc}>{p.desc}</span>
                    </span>
                    <span className={styles.promptChipAction}>
                      {copied
                        ? <Check size={12} strokeWidth={2.5} />
                        : <Copy size={11} strokeWidth={2} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Right: browser preview ── */}
        <div className={styles.previewCol}>
          <div className={styles.browser}>
            <div className={styles.browserBar}>
              <div className={styles.browserDots}>
                <span style={{ background: "#ef4444" }} />
                <span style={{ background: "#f59e0b" }} />
                <span style={{ background: "#22c55e" }} />
              </div>
              <div className={styles.browserUrl}>
                <Globe size={10} strokeWidth={2} style={{ opacity: 0.5 }} />
                {botSlug}.yoursite.com
              </div>
            </div>
            <div className={styles.browserBody} style={{ background: cfg.stageBackground }}>
              <div className={styles.pageLines}>
                <span /><span /><span /><span />
              </div>
              <MiniWidget cfg={cfg} liveConfig={liveConfig} onTrace={addTrace} />
            </div>
            <div className={styles.browserFooter}>
              {liveConfig
                ? <span className={styles.liveBadge}><span className={styles.liveDot} />{activeModel?.name}</span>
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
