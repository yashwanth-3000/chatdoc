"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import styles from "./chatbot-detail.module.css";
import viewerStyles from "./config-viewer.module.css";
import { ConfigViewer } from "./config-viewer";
import {
  deleteBotTemplate,
  fetchBotTemplateDetail,
  type BotTemplateWithFiles,
} from "@/lib/mock-chatbots";

function buildZipDirectUrl(botName: string) {
  void botName;
  return "#";
}

function buildInstallCmd(botName: string, tool: "codex" | "claude") {
  const zipUrl = buildZipDirectUrl(botName);
  const botDir = tool === "codex"
    ? `~/.codex/chatdock/${botName}`
    : `~/.claude/chatdock/${botName}`;
  return `curl -L "${zipUrl}" -o /tmp/${botName}.zip && mkdir -p ${botDir} && unzip -o /tmp/${botName}.zip -d ${botDir}/ && rm /tmp/${botName}.zip`;
}

type ChatbotDetailProps = {
  botName: string;
};

export function ChatbotDetail({ botName }: ChatbotDetailProps) {
  const router = useRouter();
  const [bot, setBot] = useState<BotTemplateWithFiles | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<"codex" | "claude" | null>(null);

  const handleCopy = useCallback((target: "codex" | "claude") => {
    navigator.clipboard.writeText(buildInstallCmd(botName, target));
    setCopied(target);
    setTimeout(() => setCopied(null), 2000);
  }, [botName]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setIsLoading(true);
      try {
        const res = await fetchBotTemplateDetail(botName);
        if (cancelled) return;
        setBot(res);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unable to load template.");
        setBot(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [botName]);

  async function refreshBot() {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetchBotTemplateDetail(botName);
      setBot(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load template.");
      setBot(null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${botName}"?`)) return;
    startTransition(async () => {
      try {
        await deleteBotTemplate(botName);
        router.push("/templates");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed.");
      }
    });
  }

  const hasConfig = bot?.bot_files.some((f) => f.relative_path === "chatdock.config.json") ?? false;
  const viewerFiles = bot?.bot_files.map((f) => ({
    relative_path: f.relative_path,
    content: f.content,
  })) ?? [];

  const blobDownloadUrl = useCallback((_botName: string, filePath: string) => {
    const file = bot?.bot_files.find((f) => f.relative_path === filePath);
    if (!file) return "#";
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [bot]);

  const bundleSidebar = bot ? (
    <div className={viewerStyles.sidebarSection}>
      <p className={viewerStyles.sidebarLabel}>Bundle</p>
      <div className={viewerStyles.summaryList}>
        {[
          { label: "Files", value: <strong>{bot.bot_files.length}</strong> },
          {
            label: "Config",
            value: (
              <span className={`${viewerStyles.badge} ${hasConfig ? viewerStyles.badgeGreen : viewerStyles.badgeGray}`}>
                {hasConfig ? "ready" : "missing"}
              </span>
            ),
          },
          {
            label: "Archive",
            value: (
              <span className={`${viewerStyles.badge} ${bot.has_zip ? viewerStyles.badgeGreen : viewerStyles.badgeGray}`}>
                {bot.has_zip ? "zip ready" : "none"}
              </span>
            ),
          },
          {
            label: "Use case",
            value: <strong>{bot.use_case}</strong>,
          },
          {
            label: "Created",
            value: <strong>{new Date(bot.created_at).toLocaleDateString()}</strong>,
          },
        ].map(({ label, value }) => (
          <div key={label} className={viewerStyles.summaryRow}>
            <span>{label}</span>
            {value}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <motion.div
      className={styles.detail}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.header}>
        <div className={styles.headerMeta}>
          <Link href="/templates" className={styles.breadcrumb}>Back to templates</Link>
          <p className={styles.kicker}>Saved chatbot template</p>
          <h1 className={styles.title}>{bot?.bot_name ?? botName}</h1>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.ghostButton}
            type="button"
            onClick={() => void refreshBot()}
          >
            Refresh
          </button>
          {bot?.has_zip && (
            <a className={styles.ghostButton} href={buildZipDirectUrl(botName)}>
              Download bundle
            </a>
          )}
          <button
            className={`${styles.codexButton} ${copied === "codex" ? styles.codexButtonCopied : ""}`}
            type="button"
            onClick={() => handleCopy("codex")}
            title="Copy a shell command to install this chatbot bundle in Codex CLI"
          >
            {copied === "codex" ? "Copied!" : "Codex bundle"}
          </button>
          <button
            className={`${styles.claudeInstallButton} ${copied === "claude" ? styles.claudeInstallCopied : ""}`}
            type="button"
            onClick={() => handleCopy("claude")}
            title="Copy a shell command to install this chatbot bundle in Claude Code"
          >
            {copied === "claude" ? "Copied!" : "Claude bundle"}
          </button>
          <button
            className={styles.dangerButton}
            type="button"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete template"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            className={styles.errorBanner}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {!bot ? (
        <div className={styles.emptyState}>
          <p>{isLoading ? "Loading..." : "Template unavailable."}</p>
          <Link className={styles.inlineLink} href="/templates">Back to templates</Link>
        </div>
      ) : (
        <ConfigViewer
          files={viewerFiles}
          botName={bot.bot_name}
          downloadFileUrl={blobDownloadUrl}
          sidebarTop={bundleSidebar}
        />
      )}
    </motion.div>
  );
}
