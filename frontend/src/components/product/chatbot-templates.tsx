"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, useTransition } from "react";
import styles from "./chatbot-templates.module.css";
import { fetchBotTemplates, type BotTemplateRow } from "@/lib/mock-chatbots";

function formatUseCaseLabel(useCase: string) {
  switch (useCase) {
    case "support": return "Support";
    case "docs": return "Docs";
    case "helpdesk": return "Helpdesk";
    default: return useCase;
  }
}

export function ChatbotTemplates() {
  const [bots, setBots] = useState<BotTemplateRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    startTransition(async () => {
      try {
        setBots(await fetchBotTemplates());
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : "Unable to load templates.");
      }
    });
  }, []);

  function refreshBots() {
    setError(null);
    startTransition(async () => {
      try {
        setBots(await fetchBotTemplates());
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : "Unable to load templates.");
      }
    });
  }

  const filteredBots = bots.filter((bot) => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return true;
    return (
      bot.bot_name.toLowerCase().includes(needle) ||
      (bot.display_name ?? "").toLowerCase().includes(needle) ||
      (bot.description ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className={styles.browser}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Bot templates</p>
          <h1>Reusable chatbot recipes</h1>
          <span>{filteredBots.length} templates ready for demo configuration</span>
        </div>
        <div className={styles.headerRight}>
          <input
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates"
          />
          <button className={styles.refreshButton} type="button" onClick={refreshBots}>
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
          <Link className={styles.createButton} href="/builder">
            New bot
          </Link>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.grid}>
        {filteredBots.length === 0 ? (
          <div className={styles.emptyState}>
            <p>{deferredQuery.trim() ? "No matching templates." : "No chatbot templates yet."}</p>
            <span>Try support, docs, helpdesk, fallback, or guardrails.</span>
          </div>
        ) : (
          filteredBots.map((bot) => (
            <article key={bot.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.cardBadge}>{formatUseCaseLabel(bot.use_case)}</span>
                  <h2>{bot.display_name || bot.bot_name}</h2>
                </div>
                <p>{bot.file_count} files</p>
              </div>

              {bot.description && (
                <p className={styles.cardDescription}>{bot.description}</p>
              )}

              <dl className={styles.metaGrid}>
                <div>
                  <dt>Primary</dt>
                  <dd>{String(bot.source_metadata.primary_model ?? "configured")}</dd>
                </div>
                <div>
                  <dt>Fallback</dt>
                  <dd>{String(bot.source_metadata.fallback_model ?? "configured")}</dd>
                </div>
                <div>
                  <dt>Policy</dt>
                  <dd>{String(bot.source_metadata.budget ?? bot.source_metadata.guardrail ?? "guardrails")}</dd>
                </div>
              </dl>

              <div className={styles.cardActions}>
                <Link className={styles.primaryAction} href={`/templates/${bot.bot_name}`}>
                  Open template
                </Link>
                <Link className={styles.secondaryAction} href="/builder">
                  Use in builder
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
