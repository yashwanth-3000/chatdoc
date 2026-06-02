import Link from "next/link";
import styles from "./builder-start.module.css";

const steps = [
  {
    label: "Step 01",
    title: "Design the widget UI",
    body: "Tune placement, launcher style, colors, greeting, and message layout with a live website preview.",
  },
  {
    label: "Step 02",
    title: "Configure intelligence",
    body: "Choose model routes, fallback behavior, budgets, tools, and safety policies for the assistant.",
  },
  {
    label: "Step 03",
    title: "Publish the config",
    body: "Generate the embed script, guardrail notes, recovery trace, and demo-ready configuration files.",
  },
];

export function BuilderStart() {
  return (
    <div className={styles.start}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>ChatDock builder</p>
          <h1>Let&apos;s build your AI chatbot.</h1>
          <p>
            Start with the part your website visitors actually see: the chat
            widget. Then move into model routing, tools, guardrails, and the
            final embed configuration.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/builder/step-one">
              Start creating
            </Link>
            <Link className={styles.secondaryButton} href="/builder/final">
              Open final page
            </Link>
          </div>
        </div>

        <div className={styles.previewCard} aria-hidden="true">
          <div className={styles.previewTop}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.previewCanvas}>
            <div className={styles.pageLines}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.chatWindow}>
              <i />
              <strong>Hi, I can help with plans.</strong>
              <span />
              <span />
            </div>
            <div className={styles.launcher}>AI</div>
          </div>
        </div>
      </section>

      <section className={styles.steps} aria-label="Builder steps">
        {steps.map((step) => (
          <article key={step.title} className={styles.stepCard}>
            <span>{step.label}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
