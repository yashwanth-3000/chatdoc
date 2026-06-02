import Link from "next/link";
import styles from "./page.module.css";
import { SiteHeader } from "@/components/site-header";

const judging = [
  "AI Gateway setup: routing, fallbacks, observability, and control.",
  "MCP Gateway usage: safe tool access, scoped permissions, auth, and auditability.",
  "Guardrails: block, redact, or validate risky LLM and tool behavior.",
  "Resilience: retries, fallback behavior, state preservation, and graceful degradation.",
  "Usefulness: a real problem for teams adding website assistants.",
  "Demo clarity: show what failed, how the assistant recovered, and why it worked.",
];

const prizes = [
  { place: "First", value: "$3,000 cash + $1,000 TrueFoundry credits + $1,000 AWS Bedrock credits" },
  { place: "Second", value: "$2,000 cash + $500 TrueFoundry credits + $500 AWS Bedrock credits" },
  { place: "Third", value: "$1,000 cash + $500 TrueFoundry credits + $500 AWS Bedrock credits" },
  { place: "Social", value: "$1,000 cash for the most relevant impressions covering the hackathon and TrueFoundry AI Gateway" },
];

const transcriptSignals = [
  {
    title: "Virtual models and fallback",
    body: "The transcript highlights priority and weighted routing. ChatDock exposes that as a virtual model selector for each chatbot.",
  },
  {
    title: "Budget and rate policies",
    body: "TrueFoundry policies can cap spend or requests. ChatDock turns that into per-bot budget controls before launch.",
  },
  {
    title: "Scoped MCP tool rooms",
    body: "The transcript stresses choosing only the tools an agent needs. ChatDock makes tool scope part of the bot recipe.",
  },
  {
    title: "Guardrail groups",
    body: "PII mutation, validation, custom guardrails, and tool-result checks become visible launch requirements.",
  },
  {
    title: "Monitoring and traces",
    body: "Request traces, top models, routing metrics, costs, and errors become the demo evidence for why recovery worked.",
  },
];

export const metadata = {
  title: "Hackathon Brief - ChatDock",
  description: "TrueFoundry hackathon brief and ChatDock product fit.",
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundBoxes} aria-hidden="true" />
      <SiteHeader currentPage="about" />

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Hackathon brief</p>
          <h1>ChatDock is built for resilient website agents.</h1>
          <p>
            TrueFoundry wants projects that use AI Gateway, MCP Gateway, and
            Guardrails to make agents reliable, governed, observable, and useful.
            Our user is a team that wants to add a chatbot to a website without
            hand-building routing, tool auth, budgets, and safety checks.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/architecture">Architecture</Link>
            <Link className={styles.secondaryButton} href="/demo">Demo plan</Link>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>What judges care about</p>
            <h2>Evaluation mapped to product features.</h2>
          </div>
          <div className={styles.checkList}>
            {judging.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Transcript interpretation</p>
            <h2>Features pulled directly into the idea.</h2>
          </div>
          <div className={styles.cardGrid}>
            {transcriptSignals.map((signal) => (
              <article key={signal.title} className={styles.card}>
                <h3>{signal.title}</h3>
                <p>{signal.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Prizes</p>
            <h2>Submission stakes.</h2>
          </div>
          <div className={styles.prizeGrid}>
            {prizes.map((prize) => (
              <article key={prize.place} className={styles.prizeCard}>
                <span>{prize.place}</span>
                <p>{prize.value}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.ctaBand}>
          <div>
            <p className={styles.kicker}>Core narrative</p>
            <h2>Hard-to-maintain chatbots become governed launch configs.</h2>
            <p>
              ChatDock packages the messy parts of production assistants into one
              builder: widget UI, model routing, fallback recovery, scoped tools,
              guardrails, budgets, and traces.
            </p>
          </div>
          <Link className={styles.primaryButton} href="/builder">Open builder</Link>
        </section>
      </main>
    </div>
  );
}
