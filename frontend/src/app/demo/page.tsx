import Link from "next/link";
import styles from "../about/page.module.css";
import { SiteHeader } from "@/components/site-header";

const demoSteps = [
  {
    title: "Start with a normal website support question",
    body: "A visitor asks which plan includes API access. ChatDock answers through the configured website widget.",
  },
  {
    title: "Force the primary model to fail",
    body: "Apply a strict TrueFoundry rate-limit policy to the primary model, then send another request.",
  },
  {
    title: "Show fallback recovery",
    body: "The virtual model route retries through the fallback provider while preserving the conversation state.",
  },
  {
    title: "Show MCP scope enforcement",
    body: "The assistant can search docs and create a ticket, but a disabled destructive tool is unavailable.",
  },
  {
    title: "Show guardrails",
    body: "Send a message with sensitive data. The guardrail mutates or blocks it before the model receives it.",
  },
  {
    title: "Show the trace",
    body: "Open monitoring to show model route, fallback, token usage, cost, guardrail event, and MCP tool call.",
  },
];

const proof = [
  "What failed: the primary model route hit a policy or provider failure.",
  "How it recovered: AI Gateway retried through the fallback route.",
  "Why it was safe: MCP Gateway limited tools and guardrails inspected inputs and outputs.",
  "Why it was measurable: monitoring showed costs, model invocations, routing metrics, and traces.",
];

export const metadata = {
  title: "Demo Plan - ChatDock",
  description: "Judge-facing demo plan for ChatDock fallback recovery, MCP scope, guardrails, and observability.",
};

export default function DemoPage() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundBoxes} aria-hidden="true" />
      <SiteHeader currentPage="demo" />

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Demo plan</p>
          <h1>Show the failure, then show the recovery.</h1>
          <p>
            The strongest demo is a visible incident: a primary model fails,
            the assistant keeps state, the fallback route answers, unsafe data
            is handled, and the trace explains every step.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/builder">Prepare bot</Link>
            <Link className={styles.secondaryButton} href="/architecture">Architecture</Link>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Run of show</p>
            <h2>Six judge-visible beats.</h2>
          </div>
          <div className={styles.cardGrid}>
            {demoSteps.map((step) => (
              <article key={step.title} className={styles.card}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Proof points</p>
            <h2>Make the recovery obvious.</h2>
          </div>
          <div className={styles.checkList}>
            {proof.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className={styles.ctaBand}>
          <div>
            <p className={styles.kicker}>Submission clarity</p>
            <h2>The story is reliability for website assistants.</h2>
            <p>
              ChatDock is useful because it turns chatbot maintenance from
              scattered code changes into a governed configuration workflow.
            </p>
          </div>
          <Link className={styles.primaryButton} href="/templates">Open templates</Link>
        </section>
      </main>
    </div>
  );
}
