import Link from "next/link";
import styles from "../about/page.module.css";
import { SiteHeader } from "@/components/site-header";

const layers = [
  {
    title: "ChatDock Builder",
    body: "Captures the widget UI, assistant purpose, tone, model route, budget, allowed tools, and guardrail policy.",
  },
  {
    title: "TrueFoundry AI Gateway",
    body: "Receives every LLM call through one endpoint, routes to the virtual model, enforces rate and budget policies, and records usage.",
  },
  {
    title: "TrueFoundry MCP Gateway",
    body: "Provides scoped access to approved tools, handles auth centrally, disables destructive tools, and keeps tool audit logs.",
  },
  {
    title: "Guardrails",
    body: "Run on model input, model output, tool arguments, and tool results to redact, block, or validate risky behavior.",
  },
  {
    title: "Website Embed",
    body: "Ships the right-corner chatbot launcher and preserves conversation state during retries or fallback recovery.",
  },
];

const policies = [
  "Primary route: bedrock/deepseek-v3.",
  "Fallback route: openai/gpt-5.5 when the primary is down, rate-limited, or out of credits.",
  "Budget policy: block after the configured daily or monthly spend limit.",
  "Rate policy: simulate failure with a strict one-request policy during the demo.",
  "MCP policy: expose docs.search, billing.lookup_plan, and ticket creation only.",
  "Guardrail policy: redact PII, reject unsafe prompts, validate tool args, inspect tool output.",
];

export const metadata = {
  title: "Architecture - ChatDock",
  description: "ChatDock architecture with TrueFoundry AI Gateway, MCP Gateway, guardrails, and website embed flow.",
};

export default function ArchitecturePage() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundBoxes} aria-hidden="true" />
      <SiteHeader currentPage="architecture" />

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Architecture</p>
          <h1>One builder, four governed layers.</h1>
          <p>
            ChatDock keeps the user-facing widget simple while routing the hard
            production concerns through TrueFoundry: model choice, fallback,
            tool access, guardrails, budgets, observability, and traces.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/builder">Configure a bot</Link>
            <Link className={styles.secondaryButton} href="/demo">View demo</Link>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>System layers</p>
            <h2>The product surface maps directly to gateway controls.</h2>
          </div>
          <div className={styles.cardGrid}>
            {layers.map((layer) => (
              <article key={layer.title} className={styles.card}>
                <h3>{layer.title}</h3>
                <p>{layer.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Launch policies</p>
            <h2>Every bot recipe carries production controls.</h2>
          </div>
          <div className={styles.checkList}>
            {policies.map((policy) => (
              <p key={policy}>{policy}</p>
            ))}
          </div>
        </section>

        <section className={styles.ctaBand}>
          <div>
            <p className={styles.kicker}>Why this matters</p>
            <h2>Teams get a chatbot maker without hiding the safety layer.</h2>
            <p>
              The key differentiator is not only widget customization. It is that
              each published assistant has visible model routing, scoped tools,
              guardrail checks, and traceable recovery behavior.
            </p>
          </div>
          <Link className={styles.primaryButton} href="/about">Hackathon fit</Link>
        </section>
      </main>
    </div>
  );
}
