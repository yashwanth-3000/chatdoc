import Link from "next/link";
import styles from "./page.module.css";
import { SiteHeader } from "@/components/site-header";

const capabilityCards = [
  {
    eyebrow: "Widget",
    title: "Design the chat surface",
    body: "Set launcher position, greeting, tone, colors, escalation copy, and preview the right-corner assistant before publishing.",
    meta: ["Live preview", "One embed"],
  },
  {
    eyebrow: "AI Gateway",
    title: "Route models with fallback",
    body: "Choose a primary model, fallback order, rate limits, and budget caps through TrueFoundry virtual model routes.",
    meta: ["429 recovery", "Budget cap"],
  },
  {
    eyebrow: "MCP Gateway",
    title: "Scope the tool room",
    body: "Expose only approved actions like docs search, ticket creation, billing lookup, and CRM reads with central auth.",
    meta: ["Scoped access", "Audit trail"],
  },
  {
    eyebrow: "Guardrails",
    title: "Check risky behavior",
    body: "Redact PII, block unsafe prompts, validate tool arguments, and inspect tool results before the assistant sees them.",
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
    <div className={styles.videoEmbed}>
      <iframe
        src="https://www.youtube.com/embed/dQw4w9WgXcQ"
        title="ChatDock demo"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundBoxes} aria-hidden="true" />

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
              <Link className={styles.secondaryButton} href="/demo">
                View demo
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

      </main>
    </div>
  );
}
