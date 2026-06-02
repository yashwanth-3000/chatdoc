import Link from "next/link";
import styles from "./gateway-designer.module.css";

const routeOptions = [
  { label: "Primary", value: "bedrock/deepseek-v3", note: "Fast support answers" },
  { label: "Fallback", value: "openai/gpt-5.5", note: "Recover after rate limits" },
  { label: "Routing", value: "Priority failover", note: "Preserve conversation state" },
];

const toolScopes = [
  { name: "docs.search", state: "enabled", detail: "Cited support answers" },
  { name: "billing.lookup_plan", state: "enabled", detail: "Read-only account context" },
  { name: "linear.create_ticket", state: "enabled", detail: "Validated ticket creation" },
  { name: "linear.delete_attachment", state: "blocked", detail: "Destructive action disabled" },
];

const guardrails = [
  "Redact PII before model routing",
  "Block unsafe website prompts",
  "Validate MCP tool arguments",
  "Inspect tool results before the model sees them",
];

export function GatewayDesigner() {
  return (
    <div className={styles.designer}>
      <section className={styles.header}>
        <div className={styles.stepRail} aria-label="Builder progress">
          <div className={styles.stepNode}>
            <span>1</span>
            <strong>Widget UI</strong>
          </div>
          <i />
          <div className={`${styles.stepNode} ${styles.stepActive}`}>
            <span>2</span>
            <strong>Gateway</strong>
          </div>
          <i />
          <div className={styles.stepNode}>
            <span>3</span>
            <strong>Publish</strong>
          </div>
        </div>

        <div>
          <h1>Configure the assistant brain.</h1>
          <p>
            Route model calls through TrueFoundry, scope MCP tools, set budgets,
            and add guardrails before publishing the website assistant.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link className={styles.secondaryButton} href="/builder/step-one">
            Back
          </Link>
          <Link className={styles.primaryButton} href="/builder/final">
            Continue
          </Link>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.inspector}>
          <article className={styles.panel}>
            <div className={styles.sectionTitle}>
              <span>01</span>
              <h2>AI Gateway</h2>
            </div>
            <div className={styles.routeList}>
              {routeOptions.map((option) => (
                <div key={option.label} className={styles.routeRow}>
                  <span>{option.label}</span>
                  <strong>{option.value}</strong>
                  <p>{option.note}</p>
                </div>
              ))}
            </div>
            <div className={styles.inlineFields}>
              <label>
                <span>Daily budget</span>
                <input value="$50" readOnly />
              </label>
              <label>
                <span>Rate limit</span>
                <input value="120 req/min" readOnly />
              </label>
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.sectionTitle}>
              <span>02</span>
              <h2>MCP Gateway</h2>
            </div>
            <div className={styles.toolGrid}>
              {toolScopes.map((tool) => (
                <div key={tool.name} className={styles.toolCard}>
                  <strong>{tool.name}</strong>
                  <span data-state={tool.state}>{tool.state}</span>
                  <p>{tool.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.sectionTitle}>
              <span>03</span>
              <h2>Guardrails</h2>
            </div>
            <div className={styles.guardrailList}>
              {guardrails.map((guardrail) => (
                <label key={guardrail}>
                  <input type="checkbox" checked readOnly />
                  <span>{guardrail}</span>
                </label>
              ))}
            </div>
          </article>
        </div>

        <aside className={styles.previewPane}>
          <div className={styles.previewHeader}>
            <div>
              <p className={styles.kicker}>Gateway preview</p>
              <h2>Recovery trace</h2>
            </div>
            <span>Ready</span>
          </div>

          <div className={styles.traceBoard}>
            <div className={styles.traceHero}>
              <p>Virtual model route</p>
              <h3>prod-support</h3>
              <span>priority fallback active</span>
            </div>
            <ol className={styles.traceSteps}>
              <li>
                <span>1</span>
                <div>
                  <strong>Primary model returns 429</strong>
                  <p>Gateway records the failed request and keeps chat state.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Fallback route starts</strong>
                  <p>Request moves to the backup provider without redeploying.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Guardrails inspect the answer</strong>
                  <p>PII is redacted and tool output is checked before response.</p>
                </div>
              </li>
            </ol>
            <div className={styles.summaryStrip}>
              <span>38% budget used</span>
              <span>4 scoped tools</span>
              <span>0 unsafe calls</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
