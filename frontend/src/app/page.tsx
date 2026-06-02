import Link from "next/link";
import styles from "./page.module.css";
import { SiteHeader } from "@/components/site-header";

const judgeSignals = [
  {
    title: "AI Gateway",
    body: "Virtual model routes, provider fallback, usage controls, cost dashboards, and request traces are core to the builder.",
  },
  {
    title: "MCP Gateway",
    body: "Each chatbot gets a scoped tool room instead of raw access to every MCP server and every destructive command.",
  },
  {
    title: "Guardrails",
    body: "The demo shows PII mutation, blocked unsafe input, validated tool arguments, and inspected tool output.",
  },
  {
    title: "Resilience",
    body: "When the primary model fails, the bot keeps the conversation state and recovers through the fallback route.",
  },
];

const templates = [
  {
    name: "SaaS support",
    tools: "Docs search, Linear ticket creation, billing lookup",
    guardrail: "PII redaction before every model call",
    body: "For product websites where visitors ask pricing, plan, integration, and account questions before they are ready to talk to sales.",
  },
  {
    name: "Campus helpdesk",
    tools: "FAQ search, calendar lookup, support handoff",
    guardrail: "Unsafe request block with safe escalation",
    body: "For public helpdesks that need useful answers while keeping sensitive student or user data out of model logs.",
  },
  {
    name: "Developer docs",
    tools: "Docs search, GitHub issue lookup, changelog context",
    guardrail: "Tool argument validation and result inspection",
    body: "For technical docs sites where the assistant needs to search real sources, avoid hallucinated APIs, and show traceable answers.",
  },
];

const capabilityCards = [
  {
    eyebrow: "Widget",
    title: "Design the chat surface",
    body:
      "Set launcher position, greeting, tone, colors, escalation copy, and preview the right-corner assistant before publishing.",
    meta: ["Live preview", "One embed"],
  },
  {
    eyebrow: "AI Gateway",
    title: "Route models with fallback",
    body:
      "Choose a primary model, fallback order, rate limits, and budget caps through TrueFoundry virtual model routes.",
    meta: ["429 recovery", "Budget cap"],
  },
  {
    eyebrow: "MCP Gateway",
    title: "Scope the tool room",
    body:
      "Expose only approved actions like docs search, ticket creation, billing lookup, and CRM reads with central auth.",
    meta: ["Scoped access", "Audit trail"],
  },
  {
    eyebrow: "Guardrails",
    title: "Check risky behavior",
    body:
      "Redact PII, block unsafe prompts, validate tool arguments, and inspect tool results before the assistant sees them.",
    meta: ["PII redaction", "Tool validation"],
  },
];

const buildFlow = [
  {
    title: "Describe the assistant",
    body: "Name the bot, define the website it serves, write the support goal, and choose the voice visitors should hear.",
  },
  {
    title: "Choose the reliability policy",
    body: "Select the primary model, fallback model, routing mode, rate limit, and daily budget before the bot is published.",
  },
  {
    title: "Scope the tool room",
    body: "Pick approved Gateway actions from docs, billing, CRM, GitHub, calendar, or ticket systems, while disabling destructive actions.",
  },
  {
    title: "Add safety checks",
    body: "Attach guardrails for PII, unsafe input, tool argument validation, tool output inspection, and budget-exceeded behavior.",
  },
  {
    title: "Publish and monitor",
    body: "Ship one embed script, preserve state during fallback, and use request traces to show exactly how recovery happened.",
  },
];

function HeroVideo() {
  return (
    <div className={styles.videoFrame} aria-label="ChatDock demo video preview">
      <div className={styles.videoPoster}>
        <div className={styles.videoChrome}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.videoScene}>
          <div className={styles.videoPanel}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.videoWidget}>
            <span />
            <span />
          </div>
          <div className={styles.playButton}>
            <span />
          </div>
        </div>
        <div className={styles.videoTimeline}>
          <span />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundBoxes} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <SiteHeader currentPage="home" />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AI assistant maker for websites</p>
            <h1>Build chatbots that survive real traffic.</h1>
            <p className={styles.heroText}>
              ChatDock lets teams design a website chat widget, choose model routes,
              scope Gateway actions, add guardrails, set budgets, and ship one embed that
              can recover when a provider fails.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/builder">
                Configure a bot
              </Link>
              <Link className={styles.secondaryButton} href="/architecture">
                View architecture
              </Link>
            </div>
          </div>

          <HeroVideo />
        </section>

        <section className={styles.storySection} aria-labelledby="feature-title">
          <div className={styles.overviewShell}>
            <div className={styles.overviewLead}>
              <p className={styles.eyebrow}>What we are building</p>
              <h2 id="feature-title">A governed chatbot maker for real websites.</h2>
              <p>
                One builder for the visible widget, model routing, safe tool
                access, guardrails, budgets, and recovery traces.
              </p>
              <div className={styles.overviewStats} aria-label="Product summary">
                <span>Widget UI</span>
                <span>Gateway routes</span>
                <span>Scoped tools</span>
                <span>Guardrails</span>
              </div>
            </div>

            <div className={styles.capabilityGrid}>
              {capabilityCards.map((card, index) => (
                <article key={card.title} className={styles.capabilityCard}>
                  <div className={styles.capabilityTop}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{card.eyebrow}</p>
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <div className={styles.capabilityMeta}>
                    {card.meta.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.flowSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>Builder flow</p>
            <h2>From idea to embedded assistant.</h2>
            <p>
              The builder is meant to feel like a guided product workflow, not a
              pile of infrastructure settings. A user should understand each
              decision, see why it matters, and leave with a chatbot config that
              can be demoed clearly.
            </p>
          </div>
          <ol className={styles.flowGrid}>
            {buildFlow.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.judgingSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>Hackathon fit</p>
            <h2>Built around the TrueFoundry judging criteria.</h2>
            <p>
              The demo should not only say “we use TrueFoundry.” It should show
              where AI Gateway, MCP Gateway, Guardrails, resilience, and
              observability appear in the product.
            </p>
          </div>
          <div className={styles.judgingGrid}>
            {judgeSignals.map((signal) => (
              <article key={signal.title} className={styles.signalCard}>
                <span>{signal.title}</span>
                <p>{signal.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.templateSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>Starter templates</p>
            <h2>Launch with opinionated bot recipes.</h2>
            <p>
              Templates make the idea easier to understand in a hackathon demo.
              Instead of starting from a blank page, judges can see how different
              websites need different tools, budgets, fallback policies, and
              guardrails.
            </p>
          </div>
          <div className={styles.templateCards}>
            {templates.map((template) => (
              <article key={template.name} className={styles.templateCard}>
                <strong>{template.name}</strong>
                <p>{template.body}</p>
                <div>
                  <span>{template.tools}</span>
                  <em>{template.guardrail}</em>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.ctaBand}>
          <div>
            <p className={styles.eyebrow}>Demo story</p>
            <h2>Show the failure, the recovery, and the reason it worked.</h2>
            <p>
              The judge-facing story is simple: a website visitor asks for help,
              the primary model hits a simulated policy failure, TrueFoundry AI
              Gateway routes to the fallback model, MCP Gateway keeps the tool
              access scoped, guardrails redact or block risky data, and monitoring
              shows the trace.
            </p>
          </div>
          <Link className={styles.primaryButton} href="/demo">
            Open demo plan
          </Link>
        </section>
      </main>
    </div>
  );
}
