import Link from "next/link";
import { ArrowRight, CheckCircle2, Settings2, ShieldCheck } from "lucide-react";
import styles from "./builder-start.module.css";

const steps = [
  {
    label: "01",
    title: "Design the widget",
    body: "Set the launcher, greeting, colors, behavior, and live preview before touching gateway policy.",
    meta: "Widget UI",
  },
  {
    label: "02",
    title: "Connect intelligence",
    body: "Choose model routes, fallback behavior, budgets, scoped tools, and guardrails for each tier.",
    meta: "Gateway policy",
  },
  {
    label: "03",
    title: "Live test the recovery",
    body: "Ask real prompts, force a fallback path, inspect trace events, and verify the assistant stays useful.",
    meta: "Trace proof",
  },
  {
    label: "04",
    title: "Ship the code",
    body: "Copy the widget, backend route, environment checklist, and implementation prompt into your app.",
    meta: "Publish",
  },
];

const previewItems = [
  { icon: Settings2, label: "Primary route", value: "chat-bot-llm" },
  { icon: ShieldCheck, label: "Guardrails", value: "PII checks, tool scope" },
  { icon: CheckCircle2, label: "Publish output", value: "React widget + API route" },
];

export function BuilderStart() {
  return (
    <div className={styles.builderLanding}>
      <article className={styles.builderArticle}>
        <section className={styles.workflowSection} aria-labelledby="builder-workflow-title">
          <header className={styles.workflowHeader}>
            <div className={styles.workflowTitleBlock}>
              <p className={styles.builderKicker}>Workflow</p>
              <h2 id="builder-workflow-title">A clean path from draft to embed.</h2>
            </div>
            <Link className={styles.builderPrimary} href="/builder/step-one">
              Continue
              <ArrowRight size={15} />
            </Link>
          </header>

          <div className={styles.workflowGrid}>
            <div className={styles.workflowList}>
              {steps.map((step) => (
                <article key={step.title} className={styles.workflowRow}>
                  <span className={styles.workflowNumber}>{step.label}</span>
                  <div>
                    <span className={styles.workflowMeta}>{step.meta}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </article>
              ))}
              <Link className={styles.builderPrimary} href="/builder/step-one" aria-label="Continue to widget designer">
                Start building
                <ArrowRight size={15} />
              </Link>
            </div>

            <aside className={styles.builderPreview} aria-label="Builder preview">
              <div className={styles.previewHeader}>
                <span>Draft session</span>
                <strong>Ready</strong>
              </div>

              <div className={styles.previewWidget}>
                <div className={styles.previewBubble}>
                  <span />
                  <p>Hi, I can help visitors choose the right plan.</p>
                </div>
                <div className={styles.previewReply}>
                  <p>Route: primary model with fallback enabled.</p>
                </div>
              </div>

              <div className={styles.previewChecklist}>
                <p className={styles.previewLabel}>Draft config</p>
                {previewItems.map(({ icon: Icon, label, value }) => (
                  <div key={label} className={styles.previewItem}>
                    <span className={styles.previewIcon}>
                      <Icon size={14} />
                    </span>
                    <div>
                      <p>{label}</p>
                      <span>{value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.previewFoot}>
                <span className={styles.previewFootDot} aria-hidden="true" />
                Live preview - updates as you configure
              </div>
            </aside>
          </div>
        </section>
      </article>
    </div>
  );
}
