"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteAssistant } from "@/components/product/site-assistant";
import styles from "./page.module.css";

const easeOut = [0.22, 1, 0.36, 1] as const;

const fade = (delay = 0) => ({
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, delay, ease: easeOut } },
});

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: easeOut } },
});

const wordLine = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

const wordDrop = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: easeOut } },
};

const vp = { once: true, amount: 0.15 } as const;

function AnimWord({ children }: { children: string }) {
  return (
    <motion.h2 className={styles.chapterTitle} variants={wordLine} initial="hidden" whileInView="show" viewport={vp}>
      {children.split(" ").map((word, i) => (
        <motion.span key={i} className={styles.chapterWord} variants={wordDrop}>{word}</motion.span>
      ))}
    </motion.h2>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const TITLE_WORDS = ["Resilient", "agents,", "governed", "from", "day", "one."];

const STATS = [
  { n: "6", l: "Failure modes handled" },
  { n: "3", l: "User tiers" },
  { n: "4", l: "Governance layers" },
  { n: "0", l: "Context lost on fallback" },
];

const GATEWAY_CARDS = [
  {
    tag: "Primary routing",
    name: "TrueFoundry AI Gateway",
    desc: "Every request routes through TrueFoundry's managed AI Gateway instead of calling a model directly. Primary model, fallback chain, rate limits, and daily budget caps live in gateway policy not in application code.",
    detail: "Primary model · Fallback chain · Rate limit policy · Budget cap",
  },
  {
    tag: "Failure recovery",
    name: "Automatic fallback",
    desc: "When the primary model hits a 429, times out, or the provider goes down, the gateway silently routes to the configured fallback model. The conversation state is preserved. The visitor never sees the failure.",
    detail: "429 recovery · Timeout fallback · State preservation",
  },
  {
    tag: "Observability",
    name: "Real-time trace log",
    desc: "Every routing decision is visible in the live-test panel model selected, fallback triggered, tokens used, latency per step. The trace emits as SSE events alongside the token stream so judges can watch recovery happen.",
    detail: "SSE trace events · Model selection visible · Fallback event logged",
  },
  {
    tag: "Governance",
    name: "Per-tier access policy",
    desc: "Guest, logged-in, and pro users are served by different model routes and rate limit policies declared once in the gateway, enforced at every request. No per-endpoint configuration, no scattered logic.",
    detail: "Guest policy · Logged-in policy · Pro policy · Centralised enforcement",
  },
];

const MCP_CARDS = [
  {
    tag: "Tool scoping",
    name: "Per-tier MCP access",
    desc: "Each user tier is granted only the MCP tools it needs. Guests get lightweight common tools. Logged-in users get the chatdock-mcp server. Pro users get the full set. The MCP Gateway enforces this at every tool call.",
    detail: "common-tools (all tiers) · chatdock-mcp (logged-in, pro)",
  },
  {
    tag: "Auth boundary",
    name: "Server-side credential injection",
    desc: "The MCP server runs at a dedicated Railway endpoint. Auth credentials are injected server-side by the backend proxy. The React widget never sees a key, a token, or a bearer header. The browser has no gateway access.",
    detail: "chatdock-mcp-production.up.railway.app · Auth injected · Widget is public-safe",
  },
  {
    tag: "Protocol",
    name: "HTTP JSON-RPC 2.0",
    desc: "Tool calls go over the Model Context Protocol a structured, auditable, vendor-neutral protocol. Every tool invocation is a named JSON-RPC call. The trace log captures tool name, arguments, and result for every step.",
    detail: "MCP over HTTP · Named tool calls · Argument-level audit trail",
  },
  {
    tag: "Safety default",
    name: "No destructive actions by default",
    desc: "The MCP tool list is allowlisted, not blocklisted. A new tier starts with zero tools. Actions like write, delete, or admin are never exposed unless explicitly granted. Least-privilege access is the starting point.",
    detail: "Allowlist model · Least-privilege default · Explicit grant required",
  },
];

const GUARDRAIL_ROWS = [
  {
    name: "content-moderation",
    phase: "Input + Output",
    action: "Blocks unsafe prompts before the model sees them. Inspects the final answer before it reaches the visitor.",
    tier: "All tiers",
  },
  {
    name: "sql-sanitizer",
    phase: "Tool arguments",
    action: "Validates tool call arguments before the MCP server executes them. Prevents injection through tool inputs.",
    tier: "All tiers",
  },
];

const FAILURE_MODES = [
  {
    n: "01",
    mode: "Rate limit (429)",
    how: "Primary model returns 429. The AI Gateway immediately routes to the fallback model. The SSE trace emits a 🚫 rate-limit event that is visible in the live-test panel. No user-facing error.",
  },
  {
    n: "02",
    mode: "Provider outage",
    how: "Primary provider is unreachable. The gateway's fallback chain activates. The session continues from exactly where it left off conversation history intact, tool context preserved.",
  },
  {
    n: "03",
    mode: "Slow response / timeout",
    how: "Requests that exceed the gateway's timeout threshold are rerouted. The streaming connection stays open so the widget does not show a broken state while the fallback model picks up.",
  },
  {
    n: "04",
    mode: "Tool failure",
    how: "If an MCP tool call returns an error, the backend catches it and emits a 🔧 error trace event. The model is informed the tool failed and can respond with partial context or a graceful message.",
  },
  {
    n: "05",
    mode: "Unsafe input / blocked prompt",
    how: "Content-moderation guardrail fires at the input stage. The request is blocked before reaching the model. A 🚫 guardrail trace event is emitted. The visitor sees a clear policy message, not a raw error.",
  },
  {
    n: "06",
    mode: "Bad or unsafe tool output",
    how: "Guardrails run on tool results before the model sees them. If a tool returns sensitive data the guardrail should redact, it is stripped at the middleware layer before the model processes the response.",
  },
];

const TIERS = [
  {
    key: "Guest",
    color: "#374151",
    model: "chat-bot-llm",
    rateLimit: "guests policy",
    guardrails: "content-moderation, sql-sanitizer",
    tools: "common-tools",
  },
  {
    key: "Logged-in",
    color: "#1d4ed8",
    model: "chat-bot-llm",
    rateLimit: "logged-in policy",
    guardrails: "content-moderation, sql-sanitizer",
    tools: "common-tools, chatdock-mcp",
  },
  {
    key: "Pro",
    color: "#7c3aed",
    model: "chat-bot-llm",
    rateLimit: "pro policy",
    guardrails: "content-moderation, sql-sanitizer",
    tools: "common-tools, chatdock-mcp",
  },
];

const DEMO_STEPS = [
  {
    title: "Open the live-test panel",
    detail: "Navigate to the Live Test step in the ChatDock builder. The widget is running against the real TrueFoundry gateway with all three tiers, MCP tools, and guardrails active.",
  },
  {
    title: "Ask a normal question as a guest",
    detail: "Send a basic question like 'What is ChatDock?'. The trace shows the model route selected, tool calls made to common-tools, guardrail pass, and the streamed response.",
  },
  {
    title: "Switch to logged-in tier and ask a tool-heavy question",
    detail: "With chatdock-mcp unlocked, ask something that requires product-specific context. Watch the trace show a 📄 MCP call event, the tool result, and the model incorporating it into the answer.",
  },
  {
    title: "Trigger the guardrail",
    detail: "Send a prompt the content-moderation guardrail is designed to catch. The trace emits a 🚫 guardrail event. The model never sees the input. The visitor gets a policy message.",
  },
  {
    title: "Simulate a rate limit",
    detail: "The gateway emits a 429 when the guests policy is exceeded. The trace shows a 🚫 rate-limit event. If a fallback model is configured, the gateway reroutes and the response continues.",
  },
  {
    title: "Read the trace end to end",
    detail: "Point to each card: ⚡ model route, 🤖 tool calls requested, 🔧 MCP execution, 👤 guardrail check, ✅ final model response. Every step of the resilient request path is visible and labelled.",
  },
];

const TECH_STACK = [
  {
    title: "React widget (client)",
    body: "Self-contained component. All styles injected via a runtime style tag no CSS files, no packages beyond React. Renders markdown responses, streams token-by-token via SSE, and preserves conversation history across fallback events.",
    bullets: ["Streaming SSE display", "Markdown rendering", "Tier prop for model routing", "No gateway secrets in browser"],
  },
  {
    title: "Next.js API route (proxy)",
    body: "The server route keeps the TrueFoundry gateway key private. It forwards messages to the AI Gateway using the OpenAI-compatible client, injects auth for MCP tool calls, and streams SSE events delta, trace, done, error back to the widget.",
    bullets: ["Server-side credentials", "OpenAI-compatible client", "Trace event emission", "MCP auth injection"],
  },
  {
    title: "TrueFoundry AI Gateway",
    body: "All model routing, fallback, rate limits, and budget enforcement live here in gateway policy, not application code. The gateway supports AWS Bedrock models as the backend. Tier-based access is declared once and enforced centrally.",
    bullets: ["Primary + fallback routing", "Per-tier rate limits", "AWS Bedrock backend", "Observable route decisions"],
  },
  {
    title: "MCP Gateway + Guardrails",
    body: "The MCP server runs at a dedicated Railway endpoint and exposes structured tool calls over HTTP JSON-RPC 2.0. Guardrails content-moderation and sql-sanitizer run at input, tool-argument, and output phases on the backend before any response reaches the visitor.",
    bullets: ["MCP over HTTP JSON-RPC 2.0", "Per-tier tool allowlist", "content-moderation guardrail", "sql-sanitizer on tool args"],
  },
];

const CRITERIA = [
  {
    n: "01",
    criterion: "AI Gateway routing, fallback, observability, governance",
    how: "Every request routes through TrueFoundry AI Gateway. Primary model, fallback chain, rate limits, and budgets are gateway policy. Every routing event is visible in the SSE trace log. Per-tier policies enforce governance centrally.",
  },
  {
    n: "02",
    criterion: "MCP Gateway safe tool access, permissions, auth, audit",
    how: "The MCP server enforces a per-tier allowlist. common-tools is available to all. chatdock-mcp is restricted to logged-in and pro. Auth is injected server-side. Every tool call is a named JSON-RPC event captured in the trace.",
  },
  {
    n: "03",
    criterion: "Guardrails unsafe input, sensitive data, argument validation",
    how: "content-moderation blocks unsafe prompts before the model. sql-sanitizer validates tool arguments before MCP execution. Both guardrails run at the backend middleware layer and emit trace events when they fire.",
  },
  {
    n: "04",
    criterion: "Resilience retries, fallback, state, graceful degradation",
    how: "Rate-limit 429s, provider outages, tool failures, and unsafe inputs each produce a specific recovery path. The conversation state is preserved across fallback events. The trace shows exactly which failure mode triggered and how the system recovered.",
  },
  {
    n: "05",
    criterion: "Real-world applicability and user value",
    how: "ChatDock's own website assistant was built using ChatDock. Three tiers, two guardrails, two MCP servers, and a full fallback policy all configured through the same builder judges are viewing. The output is a production-ready React widget and Next.js API route.",
  },
  {
    n: "06",
    criterion: "Demo clarity failure recovery demonstrated",
    how: "The live-test panel in the builder is the demo surface. Judges can trigger guardrail blocks, read per-step trace cards, see model routing decisions, and watch MCP tool calls resolve all in a single scrollable panel with no context switching.",
  },
];

const CTA_WORDS = ["Configure", "your", "resilient", "agent."];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  return (
    <div className={styles.page}>
      <SiteHeader currentPage="demo" />

      <article className={styles.article}>

        {/* ── OPENING ─────────────────────────────────────────── */}
        <motion.span className={styles.openKicker} variants={fade(0)} initial="hidden" animate="show">
          Resilient Agents · TrueFoundry Hackathon · June 2026
        </motion.span>

        <motion.h1 className={styles.mainTitle} variants={wordLine} initial="hidden" animate="show">
          {TITLE_WORDS.map((word, i) => (
            <motion.span key={i} className={styles.titleWord} variants={wordDrop}>{word}</motion.span>
          ))}
        </motion.h1>

        <motion.p className={styles.lead} variants={fade(0.35)} initial="hidden" animate="show">
          ChatDock is a governed chatbot maker for any website. It wraps TrueFoundry AI Gateway,
          MCP Gateway, and guardrails into a single builder so teams can design a chat widget,
          configure model fallback, scope tool access by user tier, enforce safety at runtime,
          and publish a production embed in one flow. To prove the system works, we built the
          ChatDock website assistant using ChatDock itself.
        </motion.p>

        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" animate="show" />

        {/* ── THE RESILIENCE PROBLEM ──────────────────────────── */}
        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          The challenge
        </motion.p>

        <AnimWord>Production agents fail in six predictable ways.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            The hackathon theme is resilience: agents that maintain functionality when infrastructure
            fails, rate limits are hit, timeouts occur, or tools break. This is not a theoretical
            concern. Every agent that reaches real traffic will encounter at least one of these
            failure modes within its first week.
          </p>
          <p>
            The difference between a fragile agent and a resilient one is not the model it uses.
            It is the governance layer underneath: routing policy, fallback chain, tool boundary,
            and runtime safety all running independently of the agent&apos;s code.
          </p>
        </motion.div>

        <motion.div className={styles.statStrip} variants={fade(0.1)} initial="hidden" whileInView="show" viewport={vp}>
          {STATS.map((s) => (
            <div key={s.l} className={styles.statCell}>
              <p className={styles.statNumber}>{s.n}</p>
              <p className={styles.statLabel}>{s.l}</p>
            </div>
          ))}
        </motion.div>

        {/* Failure modes */}
        <motion.div className={styles.failureList} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          {FAILURE_MODES.map((f) => (
            <div key={f.n} className={styles.failureRow}>
              <p className={styles.failureNum}>{f.n}</p>
              <div>
                <p className={styles.failureMode}>{f.mode}</p>
                <p className={styles.failureHow}>{f.how}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        {/* ── AI GATEWAY ──────────────────────────────────────── */}
        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Judging criterion 1 · AI Gateway
        </motion.p>

        <AnimWord>Routing, fallback, and observability live in the gateway not in code.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            ChatDock sends every assistant request through TrueFoundry AI Gateway using the
            OpenAI-compatible client. The gateway is the single point of truth for model routing.
            Primary model, fallback order, rate limit policy, and daily budget all declared once,
            enforced for every request, observable in real time.
          </p>
          <p>
            When the primary model returns a 429 or the provider is unreachable, the gateway
            reroutes to the fallback model without any code change. The backend proxy emits a
            dedicated SSE trace event so the live-test panel shows exactly when and why a fallback
            fired. Rate limit events are surfaced as <code className={styles.inlineCode}>🚫 Rate limit: [message]</code> trace
            cards with the gateway&apos;s error detail parsed and displayed.
          </p>
        </motion.div>

        <motion.div className={styles.msGrid} variants={fadeUp(0.08)} initial="hidden" whileInView="show" viewport={vp}>
          {GATEWAY_CARDS.map((card, i) => (
            <motion.div key={card.name} className={styles.msCard} variants={fadeUp(i * 0.05)} initial="hidden" whileInView="show" viewport={vp}>
              <p className={styles.msCardTag}>{card.tag}</p>
              <p className={styles.msCardName}>{card.name}</p>
              <p className={styles.msCardDesc}>{card.desc}</p>
              <p className={styles.msCardDetail}>{card.detail}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        {/* ── MCP GATEWAY ─────────────────────────────────────── */}
        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Judging criterion 2 · MCP Gateway
        </motion.p>

        <AnimWord>Tools are a permission layer, not an open door.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            ChatDock uses MCP Model Context Protocol over HTTP JSON-RPC 2.0. The MCP server
            is deployed on Railway at a dedicated endpoint. Every tool the assistant can invoke is
            declared in an allowlist. The backend proxy injects auth credentials server-side before
            each MCP call. The React widget in the browser never touches a gateway key.
          </p>
          <p>
            Tool access is enforced per user tier. A guest user can invoke <code className={styles.inlineCode}>common-tools</code>.
            A logged-in or pro user also gets <code className={styles.inlineCode}>chatdock-mcp</code> which
            surfaces ChatDock-specific context. Each tier&apos;s allowlist is declared once in the
            gateway config and applied to every request for that tier. No per-endpoint configuration,
            no scattered conditionals.
          </p>
        </motion.div>

        <motion.div className={styles.msGrid} variants={fadeUp(0.08)} initial="hidden" whileInView="show" viewport={vp}>
          {MCP_CARDS.map((card, i) => (
            <motion.div key={card.name} className={`${styles.msCard} ${styles.msCardGreen}`} variants={fadeUp(i * 0.05)} initial="hidden" whileInView="show" viewport={vp}>
              <p className={`${styles.msCardTag} ${styles.msCardTagGreen}`}>{card.tag}</p>
              <p className={styles.msCardName}>{card.name}</p>
              <p className={styles.msCardDesc}>{card.desc}</p>
              <p className={`${styles.msCardDetail} ${styles.msCardDetailGreen}`}>{card.detail}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        {/* ── GUARDRAILS ──────────────────────────────────────── */}
        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Judging criterion 3 · Guardrails
        </motion.p>

        <AnimWord>Safety runs at input, tool call, and output not as a disclaimer.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            Two guardrails are active on every request: <strong>content-moderation</strong> and
            <strong> sql-sanitizer</strong>. They run at the backend middleware layer, before any
            data reaches the model or an MCP tool. When a guardrail fires, the backend emits a
            <code className={styles.inlineCode}> 🚫</code> trace event with the rule name and action so the
            live-test panel shows the safety system working, not just the final answer.
          </p>
        </motion.div>

        <motion.div className={styles.guardrailTable} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <div className={styles.guardrailHeader}>
            <span>Guardrail</span>
            <span>Phase</span>
            <span>Action</span>
            <span>Scope</span>
          </div>
          {GUARDRAIL_ROWS.map((row) => (
            <div key={row.name} className={styles.guardrailRow}>
              <code className={styles.guardrailName}>{row.name}</code>
              <span className={styles.guardrailPhase}>{row.phase}</span>
              <span className={styles.guardrailAction}>{row.action}</span>
              <span className={styles.guardrailTier}>{row.tier}</span>
            </div>
          ))}
        </motion.div>

        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        {/* ── REAL WORLD PROOF ────────────────────────────────── */}
        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Judging criterion 5 · Real-world applicability
        </motion.p>

        <AnimWord>The ChatDock assistant was configured inside ChatDock.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            The chat widget running on the ChatDock website is the exact output of the builder
            flow: widget design, gateway config, MCP tool selection, and guardrail attachment —
            all configured through the same UI judges are viewing right now. This is a
            self-referential proof: the product that builds chatbots was tested by building itself.
          </p>
          <p>
            Three user tiers, each with a different model route, rate limit policy, tool allowlist,
            and guardrail set all controlled through TrueFoundry AI Gateway. The tier the
            assistant operates under is determined by the request context. Governance is centrally
            declared, not scattered across routes.
          </p>
        </motion.div>

        <motion.div className={styles.tierTable} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <div className={styles.tierTableHead}>
            <span>Tier</span>
            <span>Model</span>
            <span>Rate limit</span>
            <span>Guardrails</span>
            <span>MCP tools</span>
          </div>
          {TIERS.map((tier) => (
            <div key={tier.key} className={styles.tierTableRow}>
              <span>
                <span className={styles.tierPill} style={{ background: tier.color }}>{tier.key}</span>
              </span>
              <code className={styles.tierCode}>{tier.model}</code>
              <span className={styles.tierMuted}>{tier.rateLimit}</span>
              <span className={styles.tierMuted}>{tier.guardrails}</span>
              <span className={styles.tierMuted}>{tier.tools}</span>
            </div>
          ))}
        </motion.div>

        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        {/* ── DEMO FLOW ───────────────────────────────────────── */}
        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Judging criterion 6 · Demo clarity
        </motion.p>

        <AnimWord>Every failure mode is observable in one panel.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            The live-test panel in the ChatDock builder is the demo surface. It runs the real
            widget against the real TrueFoundry gateway. Every step of every request model route,
            MCP tool call, guardrail result, fallback event appears as a labelled, collapsible
            trace card alongside the streamed response. Judges do not need to read logs or inspect
            network requests: the recovery story is inline with the answer.
          </p>
        </motion.div>

        <motion.div className={styles.logCard} variants={fadeUp(0.08)} initial="hidden" whileInView="show" viewport={vp}>
          <div className={styles.logCardHeader}>
            <p className={styles.logCardTitle}>Demo run-of-show</p>
            <p className={styles.logCardMeta}>normal request → tool call → guardrail block → rate-limit recovery → trace</p>
          </div>
          <div className={styles.logPanel}>
            {DEMO_STEPS.map((step, i) => (
              <motion.div key={step.title} className={styles.logStep} variants={fadeUp(i * 0.05)} initial="hidden" whileInView="show" viewport={vp}>
                <div className={styles.logBulletCol}>
                  <span className={styles.logBullet} />
                  {i < DEMO_STEPS.length - 1 && <span className={styles.logLine} />}
                </div>
                <div className={styles.logStepContent}>
                  <p className={styles.logStepTitle}>{step.title}</p>
                  <p className={styles.logStepDetail}>{step.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        {/* ── ARCHITECTURE ────────────────────────────────────── */}
        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Architecture
        </motion.p>

        <AnimWord>Four protocol boundaries keep the agent legible under failure.</AnimWord>

        <motion.div className={styles.techGrid} variants={fadeUp(0.08)} initial="hidden" whileInView="show" viewport={vp}>
          {TECH_STACK.map((s, i) => (
            <motion.div key={s.title} className={styles.techCard} variants={fadeUp(i * 0.05)} initial="hidden" whileInView="show" viewport={vp}>
              <p className={styles.techCardTitle}>{s.title}</p>
              <p className={styles.techCardBody}>{s.body}</p>
              <ul className={styles.techCardList}>
                {s.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        {/* ── JUDGING CRITERIA MAP ────────────────────────────── */}
        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Judging criteria · How ChatDock covers each one
        </motion.p>

        <AnimWord>Six criteria. Six answers.</AnimWord>

        <motion.div className={styles.valuesList} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          {CRITERIA.map((c, i) => (
            <motion.div key={c.n} className={styles.valueRow} variants={fade(i * 0.05)} initial="hidden" whileInView="show" viewport={vp}>
              <p className={styles.valueNum}>{c.n}</p>
              <div className={styles.valueContent}>
                <p className={styles.valueTitle}>{c.criterion}</p>
                <p className={styles.valueBody}>{c.how}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div className={styles.pullQuote} variants={fade(0.08)} initial="hidden" whileInView="show" viewport={vp}>
          <motion.p className={styles.pullQuoteText} variants={wordLine} initial="hidden" whileInView="show" viewport={vp}>
            {"The strongest resilient agent is not one that never fails it is one that shows the failure, names the recovery, and proves the governance held.".split(" ").map((word, i) => (
              <motion.span key={i} variants={wordDrop}>{word} </motion.span>
            ))}
          </motion.p>
        </motion.div>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <motion.div className={styles.ctaBanner} variants={fade(0.04)} initial="hidden" whileInView="show" viewport={vp}>
          <p className={styles.ctaBannerKicker}>Try it yourself</p>
          <motion.h2 className={styles.ctaBannerTitle} variants={wordLine} initial="hidden" whileInView="show" viewport={vp}>
            {CTA_WORDS.map((word, i) => (
              <motion.span key={i} variants={wordDrop}>{word} </motion.span>
            ))}
          </motion.h2>
          <p className={styles.ctaBannerBody}>
            Log in with your TrueFoundry credentials. Pick your models, MCP servers, and guardrails.
            Design the widget, run the live test, and publish the full implementation widget component,
            backend proxy, environment checklist, and AI implementation prompt in one step.
          </p>
          <div className={styles.ctaBannerActions}>
            <Link href="/builder" className={styles.ctaPrimary}>
              <Sparkles size={13} />
              Open builder
            </Link>
            <Link href="/" className={styles.ctaSecondary}>Back to home</Link>
          </div>
        </motion.div>

      </article>

      <SiteAssistant />

      <footer className={styles.footer}>
        <p>© 2026 ChatDock · Built for the TrueFoundry Resilient Agents Hackathon</p>
        <div className={styles.footerLinks}>
          <Link href="/">Home</Link>
          <Link href="/builder">Builder</Link>
          <Link href="/demo">Project</Link>
        </div>
      </footer>
    </div>
  );
}
