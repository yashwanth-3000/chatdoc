"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./widget-designer.module.css";

type PanelSize = "compact" | "standard" | "wide";
type AnimationStyle = "slide" | "pop" | "fade" | "spring" | "drawer" | "flip" | "zoom";
type ShadowStyle = "soft" | "deep" | "flat";
type SurfaceStyle = "solid" | "matte" | "glass";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

type WidgetState = {
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
};

type ThemePreset = {
  name: string;
  accent: string;
  panel: string;
  message: string;
  messageText: string;
  user: string;
  userText: string;
  launcher: string;
  stage: string;
  surface: SurfaceStyle;
};

const colorPresets: ThemePreset[] = [
  { name: "Coral", accent: "#f75c30", panel: "#ffffff", message: "#161425", messageText: "#ffffff", user: "#ffffff", userText: "#0d1221", launcher: "#f75c30", stage: "#fcfbfa", surface: "matte" },
  { name: "Forest", accent: "#0f6b54", panel: "#ffffff", message: "#073b33", messageText: "#ffffff", user: "#f7fffb", userText: "#0d241e", launcher: "#0f6b54", stage: "#f5fbf7", surface: "solid" },
  { name: "Violet", accent: "#5b5cff", panel: "#ffffff", message: "#19173a", messageText: "#ffffff", user: "#fbfbff", userText: "#17152d", launcher: "#5b5cff", stage: "#f7f7ff", surface: "glass" },
  { name: "Graphite", accent: "#222736", panel: "#ffffff", message: "#111827", messageText: "#ffffff", user: "#ffffff", userText: "#111827", launcher: "#222736", stage: "#f6f7f8", surface: "solid" },
  { name: "Gold", accent: "#c88910", panel: "#fffefa", message: "#2a1b06", messageText: "#fff8e5", user: "#ffffff", userText: "#20160a", launcher: "#c88910", stage: "#fffaf0", surface: "matte" },
  { name: "Teal", accent: "#00796b", panel: "#ffffff", message: "#073b36", messageText: "#ffffff", user: "#f6fffd", userText: "#06231f", launcher: "#00796b", stage: "#f4fffd", surface: "solid" },
  { name: "Ink", accent: "#121826", panel: "#f9fafb", message: "#0b1020", messageText: "#ffffff", user: "#ffffff", userText: "#111827", launcher: "#121826", stage: "#f3f4f6", surface: "solid" },
  { name: "Cloud", accent: "#64748b", panel: "#ffffff", message: "#334155", messageText: "#ffffff", user: "#f8fafc", userText: "#0f172a", launcher: "#64748b", stage: "#f8fafc", surface: "solid" },
  { name: "Ember", accent: "#d9480f", panel: "#fffaf7", message: "#321007", messageText: "#fff6ed", user: "#ffffff", userText: "#25120a", launcher: "#d9480f", stage: "#fff3ed", surface: "matte" },
  { name: "Ocean", accent: "#0b69a3", panel: "#ffffff", message: "#082f49", messageText: "#ffffff", user: "#f5fbff", userText: "#0c2638", launcher: "#0b69a3", stage: "#f1f9ff", surface: "glass" },
  { name: "Mint", accent: "#13a37f", panel: "#ffffff", message: "#064e3b", messageText: "#ffffff", user: "#f5fffb", userText: "#073b33", launcher: "#13a37f", stage: "#effdf6", surface: "solid" },
  { name: "Rose", accent: "#db2777", panel: "#fffafd", message: "#4a102a", messageText: "#ffffff", user: "#ffffff", userText: "#381525", launcher: "#db2777", stage: "#fff1f7", surface: "matte" },
  { name: "Indigo", accent: "#4338ca", panel: "#ffffff", message: "#1e1b4b", messageText: "#ffffff", user: "#fafaff", userText: "#191633", launcher: "#4338ca", stage: "#f4f5ff", surface: "glass" },
  { name: "Slate", accent: "#475569", panel: "#ffffff", message: "#1f2937", messageText: "#ffffff", user: "#f9fafb", userText: "#111827", launcher: "#475569", stage: "#f7f8fa", surface: "solid" },
  { name: "Lime", accent: "#4d7c0f", panel: "#fffffb", message: "#1f2a0a", messageText: "#faffef", user: "#ffffff", userText: "#1a2309", launcher: "#4d7c0f", stage: "#f8fee7", surface: "matte" },
  { name: "Ruby", accent: "#b91c1c", panel: "#fffafa", message: "#3f0d0d", messageText: "#ffffff", user: "#ffffff", userText: "#2d1111", launcher: "#b91c1c", stage: "#fff1f1", surface: "solid" },
  { name: "Sand", accent: "#9a6b28", panel: "#fffdf8", message: "#2f2417", messageText: "#fff8ea", user: "#ffffff", userText: "#2b2117", launcher: "#9a6b28", stage: "#fbf6ec", surface: "solid" },
  { name: "Sky", accent: "#0284c7", panel: "#ffffff", message: "#083344", messageText: "#ffffff", user: "#f7fcff", userText: "#082f49", launcher: "#0284c7", stage: "#eef9ff", surface: "glass" },
  { name: "Plum", accent: "#7e22ce", panel: "#fffaff", message: "#32104f", messageText: "#ffffff", user: "#ffffff", userText: "#261139", launcher: "#7e22ce", stage: "#faf2ff", surface: "matte" },
  { name: "Cypress", accent: "#155e4b", panel: "#fbfffd", message: "#092f28", messageText: "#ffffff", user: "#ffffff", userText: "#09231e", launcher: "#155e4b", stage: "#f3fbf7", surface: "solid" },
  { name: "Carbon", accent: "#18181b", panel: "#fbfbfc", message: "#18181b", messageText: "#ffffff", user: "#ffffff", userText: "#18181b", launcher: "#18181b", stage: "#f4f4f5", surface: "solid" },
  { name: "Cream", accent: "#b45309", panel: "#fffaf0", message: "#2b1707", messageText: "#fff7e4", user: "#fffdf7", userText: "#27180a", launcher: "#b45309", stage: "#fff7e6", surface: "solid" },
  { name: "Azure", accent: "#2563eb", panel: "#ffffff", message: "#172554", messageText: "#ffffff", user: "#f8fbff", userText: "#172554", launcher: "#2563eb", stage: "#eff6ff", surface: "glass" },
  { name: "Clay", accent: "#a4492f", panel: "#fffaf7", message: "#3b1d14", messageText: "#fff6ef", user: "#ffffff", userText: "#2d1912", launcher: "#a4492f", stage: "#fdf1ea", surface: "solid" },
  { name: "Neon", accent: "#16a34a", panel: "#fbfffd", message: "#052e16", messageText: "#dcfce7", user: "#ffffff", userText: "#052e16", launcher: "#16a34a", stage: "#f0fdf4", surface: "glass" },
  { name: "Mono", accent: "#3f3f46", panel: "#ffffff", message: "#27272a", messageText: "#ffffff", user: "#fafafa", userText: "#18181b", launcher: "#3f3f46", stage: "#f5f5f5", surface: "solid" },
  { name: "Peach", accent: "#ea580c", panel: "#fffaf7", message: "#431407", messageText: "#ffffff", user: "#ffffff", userText: "#2b1509", launcher: "#ea580c", stage: "#fff3eb", surface: "matte" },
  { name: "Alpine", accent: "#0369a1", panel: "#fbfdff", message: "#0c4a6e", messageText: "#ffffff", user: "#ffffff", userText: "#082f49", launcher: "#0369a1", stage: "#f0f9ff", surface: "solid" },
  { name: "Berry", accent: "#be185d", panel: "#fffafe", message: "#4c0519", messageText: "#ffffff", user: "#ffffff", userText: "#3b1020", launcher: "#be185d", stage: "#fff1f6", surface: "matte" },
  { name: "Midnight", accent: "#312e81", panel: "#ffffff", message: "#11113f", messageText: "#ffffff", user: "#f8f8ff", userText: "#16163a", launcher: "#312e81", stage: "#f3f4ff", surface: "solid" },
];

const animationOptions: AnimationStyle[] = ["slide", "spring", "drawer", "pop", "zoom", "flip", "fade"];

const initialWidget: WidgetState = {
  assistantName: "Acme Support Copilot",
  launcherLabel: "AI",
  greeting: "Need help choosing a plan?",
  subGreeting: "I can answer product questions, compare pricing, and create a support ticket.",
  panelSize: "standard",
  animation: "slide",
  shadow: "deep",
  accentColor: "#f75c30",
  panelColor: "#ffffff",
  messageColor: "#161425",
  messageTextColor: "#ffffff",
  userBubbleColor: "#ffffff",
  userTextColor: "#0d1221",
  launcherColor: "#f75c30",
  stageBackground: "#fcfbfa",
  surfaceStyle: "matte",
  cornerRadius: 18,
};

const suggestedActions = [
  {
    title: "Compare plans",
    detail: "Use billing context",
    prompt: "Compare plans for this account",
  },
  {
    title: "Search help docs",
    detail: "Find the source first",
    prompt: "Show docs for billing limits",
  },
  {
    title: "Create ticket",
    detail: "Validate fields",
    prompt: "Create a support ticket for billing",
  },
];

function getMessageMotion(role: ChatMessage["role"], shouldReduceMotion: boolean) {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.18 },
    };
  }

  return {
    initial: {
      opacity: 0,
      x: role === "user" ? 12 : -12,
      y: 8,
      scale: 0.98,
      filter: "blur(3px)",
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
    },
    transition: {
      type: "spring" as const,
      stiffness: 420,
      damping: 32,
      mass: 0.8,
    },
  };
}

function getPanelMotion(animation: AnimationStyle) {
  const spring = { type: "spring" as const, damping: 25, stiffness: 320 };

  switch (animation) {
    case "spring":
      return {
        initial: { opacity: 0, y: 28, scale: 0.86 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 18, scale: 0.94 },
        transition: { type: "spring" as const, damping: 18, stiffness: 420 },
      };
    case "drawer":
      return {
        initial: { opacity: 0, x: 34, y: 12 },
        animate: { opacity: 1, x: 0, y: 0 },
        exit: { opacity: 0, x: 26, y: 8 },
        transition: spring,
      };
    case "flip":
      return {
        initial: { opacity: 0, rotateX: -18, y: 18, scale: 0.96 },
        animate: { opacity: 1, rotateX: 0, y: 0, scale: 1 },
        exit: { opacity: 0, rotateX: -10, y: 14, scale: 0.96 },
        transition: spring,
      };
    case "zoom":
      return {
        initial: { opacity: 0, scale: 0.82 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.9 },
        transition: spring,
      };
    case "pop":
      return {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.94 },
        transition: { type: "spring" as const, damping: 20, stiffness: 360 },
      };
    case "fade":
      return {
        initial: { opacity: 0, filter: "blur(8px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
        exit: { opacity: 0, filter: "blur(6px)" },
        transition: { duration: 0.22, ease: "easeOut" as const },
      };
    case "slide":
    default:
      return {
        initial: { opacity: 0, y: 22, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 18, scale: 0.96 },
        transition: spring,
      };
  }
}

function updateField<K extends keyof WidgetState>(
  setter: (next: WidgetState | ((current: WidgetState) => WidgetState)) => void,
  key: K,
  value: WidgetState[K],
) {
  setter((current) => ({ ...current, [key]: value }));
}

function buildAssistantReply(message: string, assistantName: string) {
  const lower = message.toLowerCase();

  if (lower.includes("ticket")) {
    return "I can create the ticket after validating priority, account ID, and issue summary through the approved MCP action.";
  }

  if (lower.includes("docs")) {
    return "I found the billing limits page in the scoped docs source. I can cite it before answering or hand this to support with the trace attached.";
  }

  if (lower.includes("plan") || lower.includes("pricing")) {
    return "The Growth plan is the closest match. I can compare limits, check account state, and escalate if the recommendation needs human review.";
  }

  return `${assistantName || "The assistant"} can answer this with the configured tone, scoped tools, and guardrails.`;
}

export function WidgetDesigner() {
  const [widget, setWidget] = useState<WidgetState>(initialWidget);
  const [isOpen, setIsOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: initialWidget.subGreeting,
    },
  ]);

  const previewStyle = useMemo(
    () =>
      ({
        "--widget-accent": widget.accentColor,
        "--widget-panel": widget.panelColor,
        "--widget-message": widget.messageColor,
        "--widget-message-text": widget.messageTextColor,
        "--widget-user": widget.userBubbleColor,
        "--widget-user-text": widget.userTextColor,
        "--widget-launcher": widget.launcherColor,
        "--widget-stage": widget.stageBackground,
        "--widget-radius": `${widget.cornerRadius}px`,
      }) as CSSProperties,
    [widget],
  );

  const currentAgent = {
    name: "Support Agent",
    role: "Product questions",
    icon: widget.assistantName.trim().slice(0, 1) || "A",
  };
  const shouldShowSuggestions = messages.length === 1 && !isTyping;

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;

    messageList.scrollTop = messageList.scrollHeight;
  }, [messages, isTyping, isOpen]);

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: trimmed },
    ]);
    setDraft("");
    setIsTyping(true);
    setIsOpen(true);

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: buildAssistantReply(trimmed, widget.assistantName),
        },
      ]);
      setIsTyping(false);
    }, 650);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  function applyPreset(preset: (typeof colorPresets)[number]) {
    setWidget((current) => ({
      ...current,
      accentColor: preset.accent,
      panelColor: preset.panel,
      messageColor: preset.message,
      messageTextColor: preset.messageText,
      userBubbleColor: preset.user,
      userTextColor: preset.userText,
      launcherColor: preset.launcher,
      stageBackground: preset.stage,
      surfaceStyle: preset.surface,
    }));
  }

  const panelClass = [
    styles.chatPanel,
    styles[`size_${widget.panelSize}`],
    styles[`anim_${widget.animation}`],
    styles[`shadow_${widget.shadow}`],
    styles[`surface_${widget.surfaceStyle}`],
  ].join(" ");

  const stageClass = [
    styles.chatStage,
    styles[`stage_${widget.surfaceStyle}`],
  ].join(" ");

  const panelMotion = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : getPanelMotion(widget.animation);

  return (
    <div className={styles.designer}>
      <section className={styles.header}>
        <div className={styles.stepRail} aria-label="Builder progress">
          <div className={`${styles.stepNode} ${styles.stepActive}`}>
            <span>1</span>
            <strong>Widget UI</strong>
          </div>
          <i />
          <div className={styles.stepNode}>
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
          <h1>Design the chatbot experience.</h1>
          <p>
            Tune the visible assistant first: name, greeting, color, motion,
            launcher, quick replies, and the live chat behavior.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.secondaryButton} href="/builder">
            Back
          </Link>
          <Link className={styles.primaryButton} href="/builder/step-two">
            Continue
          </Link>
        </div>
      </section>

      <section className={styles.workspace}>
        <form className={styles.controls} onSubmit={(event) => event.preventDefault()}>
          <div className={`${styles.controlCard} ${styles.contentCard}`}>
            <div className={styles.sectionTitle}>
              <span>01</span>
              <h2>Content</h2>
            </div>
            <label className={styles.field}>
              <span>Assistant name</span>
              <input
                value={widget.assistantName}
                onChange={(event) => updateField(setWidget, "assistantName", event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Launcher label</span>
              <input
                maxLength={14}
                value={widget.launcherLabel}
                onChange={(event) => updateField(setWidget, "launcherLabel", event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Opening message</span>
              <input
                value={widget.greeting}
                onChange={(event) => {
                  updateField(setWidget, "greeting", event.target.value);
                }}
              />
            </label>
            <label className={styles.field}>
              <span>Helper copy</span>
              <textarea
                rows={3}
                value={widget.subGreeting}
                onChange={(event) => {
                  updateField(setWidget, "subGreeting", event.target.value);
                  setMessages((current) =>
                    current.map((message) =>
                      message.id === 1 ? { ...message, text: event.target.value } : message,
                    ),
                  );
                }}
              />
            </label>
          </div>

          <div className={`${styles.controlCard} ${styles.behaviorCard}`}>
            <div className={styles.sectionTitle}>
              <span>02</span>
              <h2>Behavior</h2>
            </div>
            <div className={styles.segmentGroup}>
              <p>Panel size</p>
              <div>
                {(["compact", "standard", "wide"] as PanelSize[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={widget.panelSize === size ? styles.segmentActive : ""}
                    onClick={() => updateField(setWidget, "panelSize", size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.segmentGroup}>
              <p>Open animation</p>
              <div>
                {animationOptions.map((animation) => (
                  <button
                    key={animation}
                    type="button"
                    className={widget.animation === animation ? styles.segmentActive : ""}
                    onClick={() => {
                      updateField(setWidget, "animation", animation);
                      setIsOpen(false);
                      window.setTimeout(() => setIsOpen(true), 80);
                    }}
                  >
                    {animation}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.segmentGroup}>
              <p>Panel surface</p>
              <div>
                {(["solid", "matte", "glass"] as SurfaceStyle[]).map((surface) => (
                  <button
                    key={surface}
                    type="button"
                    className={widget.surfaceStyle === surface ? styles.segmentActive : ""}
                    onClick={() => updateField(setWidget, "surfaceStyle", surface)}
                  >
                    {surface}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.segmentGroup}>
              <p>Panel shadow</p>
              <div>
                {(["soft", "deep", "flat"] as ShadowStyle[]).map((shadow) => (
                  <button
                    key={shadow}
                    type="button"
                    className={widget.shadow === shadow ? styles.segmentActive : ""}
                    onClick={() => updateField(setWidget, "shadow", shadow)}
                  >
                    {shadow}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`${styles.controlCard} ${styles.themeCard}`}>
            <div className={styles.sectionTitle}>
              <span>03</span>
              <h2>Theme</h2>
            </div>
            <div className={styles.swatchGrid}>
              {colorPresets.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className={widget.accentColor === color.accent ? styles.swatchActive : ""}
                  onClick={() => applyPreset(color)}
                >
                  <i style={{ background: color.accent }} />
                  <span>
                    <strong>{color.name}</strong>
                    <small>{color.surface}</small>
                  </span>
                </button>
              ))}
            </div>
            <details className={styles.advancedTheme}>
              <summary>Advanced colors</summary>
              <div className={styles.colorGrid}>
                {([
                  ["Accent", "accentColor"],
                  ["Panel", "panelColor"],
                  ["Assistant", "messageColor"],
                  ["Assistant text", "messageTextColor"],
                  ["Visitor bubble", "userBubbleColor"],
                  ["Visitor text", "userTextColor"],
                  ["Launcher", "launcherColor"],
                  ["Preview bg", "stageBackground"],
                ] as Array<[string, keyof WidgetState]>).map(([label, key]) => (
                  <label key={key} className={styles.colorField}>
                    <span>{label}</span>
                    <input
                      type="color"
                      value={widget[key] as string}
                      onInput={(event) => updateField(setWidget, key, event.currentTarget.value)}
                      onChange={(event) => updateField(setWidget, key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label className={styles.rangeField}>
                <span>Corner radius</span>
                <input
                  type="range"
                  min="8"
                  max="28"
                  value={widget.cornerRadius}
                  onChange={(event) =>
                    updateField(setWidget, "cornerRadius", Number(event.target.value))
                  }
                />
                <strong>{widget.cornerRadius}px</strong>
              </label>
            </details>
          </div>
        </form>

        <aside className={styles.previewPane}>
          <div className={styles.previewHeader}>
            <div>
              <p className={styles.kicker}>Interactive preview</p>
              <h2>Chatbot preview</h2>
            </div>
            <div className={styles.previewStatus}>
              <span>
                <i />
                {isOpen ? "Open" : "Minimized"}
              </span>
              <button type="button" onClick={() => setIsOpen((current) => !current)}>
                {isOpen ? "Minimize" : "Open"}
              </button>
            </div>
          </div>

          <div
            className={stageClass}
            style={
              {
                ...previewStyle,
                "--agent-accent": widget.accentColor,
              } as CSSProperties
            }
          >
            <div className={styles.stageGlow} aria-hidden="true" />
            <div className={styles.widgetDock}>
              <AnimatePresence mode="popLayout">
                {isOpen && (
                <motion.div
                  className={panelClass}
                  {...panelMotion}
                >
                  <div className={styles.chatHeader}>
                    <div className={styles.avatar}>
                      {currentAgent.icon}
                    </div>
                    <div className={styles.chatIdentity}>
                      <strong>{widget.assistantName || "Website Assistant"}</strong>
                      <span>
                        <i />
                        {currentAgent.name} · {currentAgent.role}
                      </span>
                    </div>
                    <div className={styles.chatActions}>
                      <button type="button" aria-label="Minimize chat" onClick={() => setIsOpen(false)}>
                        -
                      </button>
                      <button type="button" aria-label="Close chat" onClick={() => setIsOpen(false)}>
                        x
                      </button>
                    </div>
                  </div>

                  <div className={styles.messageList} ref={messageListRef}>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        layout
                        className={message.role === "assistant" ? styles.assistantMessage : styles.userMessage}
                        {...getMessageMotion(message.role, Boolean(shouldReduceMotion))}
                      >
                        {message.role === "assistant" && (
                          <div className={styles.messageAvatar}>
                            {currentAgent.icon}
                          </div>
                        )}
                        <div className={styles.messageStack}>
                          <div
                            className={
                              message.role === "assistant" ? styles.assistantBubble : styles.userBubble
                            }
                          >
                            {message.text}
                          </div>
                          <span className={styles.messageMeta}>
                            {message.role === "assistant" ? currentAgent.name : "Visitor"} · just now
                          </span>
                        </div>
                      </motion.div>
                    ))}
                    <AnimatePresence>
                      {isTyping && (
                        <motion.div
                          className={styles.assistantMessage}
                          aria-label="Assistant is typing"
                          layout
                          initial={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, x: -10, y: 8, scale: 0.98 }
                          }
                          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                          exit={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, x: -6, y: 4, scale: 0.98 }
                          }
                          transition={
                            shouldReduceMotion
                              ? { duration: 0.16 }
                              : { type: "spring", stiffness: 420, damping: 32, mass: 0.8 }
                          }
                        >
                          <div className={styles.messageAvatar}>
                            {currentAgent.icon}
                          </div>
                          <div className={styles.typingBubble}>
                            <span />
                            <span />
                            <span />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence>
                    {shouldShowSuggestions && (
                      <motion.div
                        className={styles.quickReplies}
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      >
                        {suggestedActions.map((reply) => (
                          <motion.button
                            key={reply.title}
                            type="button"
                            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                            onClick={() => sendMessage(reply.prompt)}
                          >
                            <strong>{reply.title}</strong>
                            <span>{reply.detail}</span>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form className={styles.composer} onSubmit={handleSubmit}>
                    <input
                      aria-label="Preview chat message"
                      placeholder="Ask a question..."
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <motion.button
                      type="submit"
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                    >
                      Send
                    </motion.button>
                  </form>
                </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="button"
                className={`${styles.launcherPreview} ${styles.launcher_circle}`}
                onClick={() => setIsOpen((current) => !current)}
                aria-label={isOpen ? "Minimize chatbot preview" : "Open chatbot preview"}
                animate={isOpen ? { y: 0, scale: 1 } : { y: [0, -4, 0], scale: 1 }}
                whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.04 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                {isOpen ? "x" : widget.launcherLabel || "AI"}
              </motion.button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
