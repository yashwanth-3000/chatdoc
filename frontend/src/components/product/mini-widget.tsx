"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./mini-widget.module.css";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_CHATDOCK_BACKEND_URL?.replace(/\/+$/, "") ??
  "http://localhost:4000";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SurfaceStyle = "solid" | "matte" | "glass";
export type PanelSize = "compact" | "standard" | "wide";
export type AnimationStyle = "slide" | "pop" | "fade" | "spring" | "drawer" | "flip" | "zoom";
export type ShadowStyle = "soft" | "deep" | "flat";

export interface WidgetConfig {
  assistantName: string;
  launcherLabel: string;
  greeting: string;
  subGreeting: string;
  panelSize: PanelSize;
  animation: AnimationStyle;
  shadow: ShadowStyle;
  accentColor: string;
  panelColor: string;
  messageColor: string;
  messageTextColor: string;
  userBubbleColor: string;
  userTextColor: string;
  launcherColor: string;
  stageBackground: string;
  surfaceStyle: SurfaceStyle;
  cornerRadius: number;
}

export type ChaosMode = null | "rate-limit" | "kill-primary" | "slow";

export interface TraceEntry { icon: string; text: string; ms: number; }

export interface LiveConfig {
  gatewayUrl: string;
  modelId: string;
  apiKey: string;
  chaosMode: ChaosMode;
  primaryModelLabel: string;
  fallbackModelLabel: string;
  userTier?: string;
  controlPlaneUrl?: string;
  systemPrompt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const PANEL_HEIGHT: Record<PanelSize, number> = { compact: 480, standard: 560, wide: 600 };

const SHADOW: Record<ShadowStyle, string> = {
  soft: "0 4px 20px rgba(0,0,0,0.10)",
  deep: "0 12px 48px rgba(0,0,0,0.22)",
  flat: "none",
};

export function closedTransform(anim: AnimationStyle): string {
  switch (anim) {
    case "pop":    return "scale(0.7) translateY(20px)";
    case "fade":   return "translateY(0) scale(1)";
    case "zoom":   return "scale(0.5)";
    case "flip":   return "perspective(600px) rotateX(18deg)";
    case "drawer": return "translateX(110%)";
    case "spring": return "translateY(28px)";
    default:       return "translateY(22px)";
  }
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function parseInline(str: string, baseKey: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;
  let last = 0; let m; let i = 0;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) parts.push(str.slice(last, m.index));
    if (m[1] !== undefined) parts.push(<strong key={`${baseKey}-b${i++}`}>{m[1]}</strong>);
    else if (m[2] !== undefined) parts.push(<em key={`${baseKey}-i${i++}`}>{m[2]}</em>);
    else if (m[3] !== undefined) parts.push(<code key={`${baseKey}-c${i++}`} style={{ fontFamily: "monospace", fontSize: "0.88em", background: "rgba(0,0,0,0.12)", borderRadius: 3, padding: "0 3px" }}>{m[3]}</code>);
    last = re.lastIndex;
  }
  if (last < str.length) parts.push(str.slice(last));
  return parts;
}

function renderMarkdown(text: string, textColor: string): React.ReactNode {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  const listBuf: React.ReactNode[] = [];
  let k = 0;

  function flushList() {
    if (!listBuf.length) return;
    out.push(
      <ul key={`ul${k++}`} style={{ margin: "4px 0 4px 14px", padding: 0, display: "grid", gap: 2 }}>
        {listBuf.splice(0)}
      </ul>
    );
  }

  for (const line of lines) {
    const isBullet = /^[-•*] /.test(line);
    if (isBullet) {
      listBuf.push(
        <li key={`li${k++}`} style={{ listStyle: "disc", lineHeight: 1.5 }}>
          {parseInline(line.replace(/^[-•*] /, ""), `li${k}`)}
        </li>
      );
    } else {
      flushList();
      if (line.trim() === "") {
        out.push(<div key={`sp${k++}`} style={{ height: 4 }} />);
      } else {
        out.push(
          <div key={`ln${k++}`} style={{ lineHeight: 1.5 }}>
            {parseInline(line, `ln${k}`)}
          </div>
        );
      }
    }
  }
  flushList();

  return (
    <div style={{ color: textColor, fontSize: "inherit", display: "grid", gap: 1 }}>
      {out}
    </div>
  );
}

// ── MiniWidget ────────────────────────────────────────────────────────────────

export function MiniWidget({
  cfg,
  liveConfig,
  onTrace,
  fallbackMessage = "Connect a TrueFoundry gateway to enable live responses.",
}: {
  cfg: WidgetConfig;
  liveConfig: LiveConfig | null;
  onTrace: (e: TraceEntry) => void;
  fallbackMessage?: string;
}) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string; id: number }>>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const r = cfg.cornerRadius;
  const shadow = SHADOW[cfg.shadow];
  const panelHeight = PANEL_HEIGHT[cfg.panelSize];
  const msgAreaHeight = panelHeight - 48 - 56;

  const panelBgColor =
    cfg.surfaceStyle === "glass" ? cfg.panelColor + "cc" :
    cfg.surfaceStyle === "matte" ? cfg.panelColor + "fa" :
    cfg.panelColor;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { role: "user" as const, text, id: Date.now() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    setSending(true);
    setStreamingText("");

    if (!liveConfig) {
      setTimeout(() => {
        setMessages((m) => [...m, {
          role: "assistant",
          text: fallbackMessage,
          id: Date.now() + 1,
        }]);
        setSending(false);
      }, 700);
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: allMsgs.map((m) => ({ role: m.role, content: m.text })),
          gatewayUrl: liveConfig.gatewayUrl,
          modelId: liveConfig.modelId,
          apiKey: liveConfig.apiKey,
          chaosMode: liveConfig.chaosMode ?? undefined,
          primaryModelLabel: liveConfig.primaryModelLabel,
          fallbackModelLabel: liveConfig.fallbackModelLabel,
          userTier: liveConfig.userTier,
          controlPlaneUrl: liveConfig.controlPlaneUrl,
          systemPrompt: liveConfig.systemPrompt,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Backend error ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let curEvent = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            curEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            try {
              const payload = JSON.parse(raw);
              if (curEvent === "trace") {
                onTrace(payload as TraceEntry);
              } else if (curEvent === "delta") {
                accumulated += (payload.content as string) ?? "";
                setStreamingText(accumulated);
              } else if (curEvent === "done") {
                setMessages((m) => [...m, { role: "assistant", text: accumulated, id: Date.now() }]);
                setStreamingText("");
              } else if (curEvent === "error") {
                setMessages((m) => [...m, {
                  role: "assistant",
                  text: `Error: ${(payload.message as string) ?? "Gateway error"}`,
                  id: Date.now(),
                }]);
              }
            } catch { /* skip malformed */ }
            curEvent = "";
          } else if (line === "") {
            curEvent = "";
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((m) => [...m, {
        role: "assistant",
        text: `Connection failed: ${err instanceof Error ? err.message : "unknown error"}`,
        id: Date.now(),
      }]);
    } finally {
      setSending(false);
      setStreamingText("");
    }
  }

  return (
    <div className={styles.miniRoot}>
      <div
        className={styles.miniPanel}
        style={{
          height: panelHeight,
          borderRadius: r,
          background: panelBgColor,
          boxShadow: shadow,
          transform: open ? "translateY(0) scale(1)" : closedTransform(cfg.animation),
          opacity: open ? 1 : 0,
          pointerEvents: open ? "all" : "none",
          ...(cfg.surfaceStyle === "glass" ? { backdropFilter: "blur(20px)" } : {}),
        }}
      >
        <div
          className={styles.miniHeader}
          style={{ background: cfg.accentColor, borderRadius: `${r}px ${r}px 0 0` }}
        >
          <div className={styles.miniHeaderLeft}>
            <span className={styles.miniDot} />
            <strong>{cfg.assistantName}</strong>
          </div>
          <button className={styles.miniClose} onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className={styles.miniMessages} style={{ height: msgAreaHeight }}>
          <div
            className={styles.miniBubble}
            style={{
              background: cfg.messageColor,
              color: cfg.messageTextColor,
              borderRadius: `4px ${r * 0.65}px ${r * 0.65}px`,
              alignSelf: "flex-start",
            }}
          >
            <div className={styles.miniGreetingTitle}>{cfg.greeting}</div>
            {cfg.subGreeting && <div className={styles.miniGreetingSub}>{cfg.subGreeting}</div>}
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={styles.miniBubble}
              style={
                msg.role === "user"
                  ? { background: cfg.userBubbleColor, color: cfg.userTextColor, border: "1px solid rgba(0,0,0,0.07)", borderRadius: `${r * 0.65}px ${r * 0.65}px 4px`, alignSelf: "flex-end" }
                  : { background: cfg.messageColor, color: cfg.messageTextColor, borderRadius: `4px ${r * 0.65}px ${r * 0.65}px`, alignSelf: "flex-start" }
              }
            >
              {msg.role === "assistant"
                ? renderMarkdown(msg.text, cfg.messageTextColor)
                : msg.text}
            </div>
          ))}

          {sending && streamingText && (
            <div
              className={styles.miniBubble}
              style={{ background: cfg.messageColor, color: cfg.messageTextColor, borderRadius: `4px ${r * 0.65}px ${r * 0.65}px`, alignSelf: "flex-start" }}
            >
              {renderMarkdown(streamingText, cfg.messageTextColor)}
            </div>
          )}

          {sending && !streamingText && (
            <div
              className={styles.miniBubble}
              style={{ background: cfg.messageColor, borderRadius: `4px ${r * 0.65}px ${r * 0.65}px`, alignSelf: "flex-start", display: "flex", gap: 5, padding: "12px 14px" }}
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className={styles.miniDotBounce} style={{ background: cfg.messageTextColor, animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className={styles.miniInput} style={{ borderTop: `1px solid rgba(0,0,0,0.07)` }}>
          <input
            className={styles.miniTextField}
            style={{ borderRadius: r * 0.45 }}
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            disabled={sending}
          />
          <button
            className={styles.miniSendBtn}
            style={{ background: cfg.accentColor, borderRadius: "50%" }}
            onClick={send}
            disabled={sending}
          >
            ↑
          </button>
        </div>
      </div>

      <button
        className={styles.miniLauncher}
        style={{ background: cfg.launcherColor, boxShadow: shadow }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "✕" : cfg.launcherLabel}
      </button>
    </div>
  );
}
