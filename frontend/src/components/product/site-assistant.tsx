"use client";

import { useEffect, useState } from "react";
import { MiniWidget, type LiveConfig, type WidgetConfig } from "./mini-widget";
import { fetchDemoAvailability, DEMO_API_KEY_SENTINEL } from "@/lib/frontend-api";

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

const SYSTEM_PROMPT = [
  "You are the ChatDock Assistant, embedded on the ChatDock website — you are yourself a product demo:",
  "the exact widget produced by the ChatDock builder, running through the TrueFoundry AI Gateway",
  "with guardrails and tier-scoped MCP tools.",
  "ChatDock is a guided builder for governed website chatbots: connect a TrueFoundry tenant,",
  "configure Guest/Logged-in/Pro tiers with model routing and fallback, attach guardrails,",
  "live-test with a full request trace, and publish a self-contained React widget plus a",
  "server proxy that keeps credentials out of the browser.",
  "Answer questions about ChatDock, the builder flow, the gateway/MCP/guardrail architecture,",
  "and the TrueFoundry hackathon story. Keep answers short and concrete.",
].join(" ");

/**
 * The ChatDock website's own assistant — the exact widget produced by the
 * builder flow, mounted as a floating launcher. Chat runs through the demo
 * tenant via the backend: the browser holds a sentinel, never a credential.
 */
export function SiteAssistant() {
  const [liveConfig, setLiveConfig] = useState<LiveConfig | null>(null);

  useEffect(() => {
    fetchDemoAvailability()
      .then((cfg) => {
        if (!cfg.available || !cfg.gatewayUrl || !cfg.modelId) return;
        setLiveConfig({
          gatewayUrl: cfg.gatewayUrl,
          modelId: cfg.modelId,
          apiKey: DEMO_API_KEY_SENTINEL,
          chaosMode: null,
          primaryModelLabel: cfg.modelId,
          fallbackModelLabel: cfg.modelId,
          userTier: "guest",
          controlPlaneUrl: cfg.controlPlaneUrl,
          systemPrompt: SYSTEM_PROMPT,
        });
      })
      .catch(() => {});
  }, []);

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
        liveConfig={liveConfig}
        onTrace={() => {}}
        defaultOpen={false}
        fallbackMessage="The demo gateway is warming up — try again in a moment, or open the builder's live-test panel with your own TrueFoundry gateway."
      />
    </div>
  );
}
