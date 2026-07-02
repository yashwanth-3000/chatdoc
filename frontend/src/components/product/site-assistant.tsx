"use client";

import { MiniWidget, type WidgetConfig } from "./mini-widget";

const SITE_ASSISTANT_CONFIG: WidgetConfig = {
  assistantName: "ChatDock Assistant",
  launcherLabel: "AI",
  greeting: "Questions about ChatDock?",
  subGreeting: "I can explain the gateway setup, MCP tool tiers, and how the builder flow works.",
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

/**
 * The ChatDock website's own assistant — the exact widget produced by the
 * builder flow, mounted as a floating launcher. Gateway credentials are never
 * shipped to the browser, so without a configured session it answers with a
 * pointer to the builder's live-test panel instead of a real model response.
 */
export function SiteAssistant() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "min(400px, calc(100vw - 16px))",
        height: 680,
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <MiniWidget
        cfg={SITE_ASSISTANT_CONFIG}
        liveConfig={null}
        onTrace={() => {}}
        defaultOpen={false}
        fallbackMessage="This widget is the exact output of the ChatDock builder. Open the builder's live-test panel with your TrueFoundry gateway to see live, governed responses."
      />
    </div>
  );
}
