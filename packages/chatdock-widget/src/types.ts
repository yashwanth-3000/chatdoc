export type PanelSize = "compact" | "standard" | "wide";
export type AnimationStyle = "slide" | "pop" | "fade" | "spring" | "drawer" | "flip" | "zoom";
export type ShadowStyle = "soft" | "deep" | "flat";
export type SurfaceStyle = "solid" | "matte" | "glass";

export interface WidgetContent {
  assistantName: string;
  launcherLabel: string;
  greeting: string;
  subGreeting?: string;
  suggestedActions?: Array<{ label: string; prompt: string }>;
}

export interface WidgetTheme {
  accentColor: string;
  panelColor: string;
  messageColor: string;
  messageTextColor: string;
  userBubbleColor: string;
  userTextColor: string;
  launcherColor: string;
  surfaceStyle: SurfaceStyle;
  cornerRadius: number;
}

export interface WidgetBehavior {
  panelSize: PanelSize;
  animation: AnimationStyle;
  shadow: ShadowStyle;
}

export interface GatewayConfig {
  url: string;
  virtualModel?: string;
  apiKey?: string;
}

export interface WidgetConfig {
  content: WidgetContent;
  theme: WidgetTheme;
  behavior: WidgetBehavior;
  gateway?: GatewayConfig;
}

export interface ThemePreset {
  name: string;
  theme: WidgetTheme;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

export interface ChatWidgetProps {
  config: WidgetConfig;
  /** Called when user sends a message. Return the assistant reply string. */
  onMessage?: (message: string) => Promise<string>;
  /** Override default fixed bottom-right placement */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Default open state */
  defaultOpen?: boolean;
}
