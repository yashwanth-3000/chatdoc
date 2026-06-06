import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import { z } from "zod";

// ── Tier resolution via TrueFoundry ──────────────────────────────────────────
//
// Tier is NEVER accepted from the caller — it is always resolved by calling
// TrueFoundry's API with the user's API key.  The rate-limit config names
// ("guest-...", "logged-in-...", "pro-...") in the workspace determine the tier.

type Tier = "guest" | "loggedIn" | "pro";
const TIER_RANK: Record<Tier, number> = { guest: 0, loggedIn: 1, pro: 2 };

interface TierResult {
  tier: Tier;
  error?: string;
}

async function resolveTierFromTrueFoundry(
  controlPlaneUrl: string,
  apiKey: string
): Promise<TierResult> {
  const base = controlPlaneUrl.replace(/\/+$/, "");
  const url = `${base}/api/svc/v1/llm-gateway/config/rate-limit-configs`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401 || res.status === 403) {
      return { tier: "guest", error: "Invalid or revoked TrueFoundry API key — access limited to Guest tier." };
    }

    if (!res.ok) {
      return { tier: "guest", error: `TrueFoundry returned HTTP ${res.status}. Defaulting to Guest tier.` };
    }

    // Rate-limit config IDs follow the naming convention:
    //   "guests-100rpm"   → guest
    //   "logged-in-500rpm" → loggedIn
    //   "pro-unlimited"   → pro
    const data = (await res.json()) as unknown;
    const configs: Array<{ id: string }> =
      Array.isArray(data) ? data :
      (data as Record<string, unknown>)?.data as Array<{ id: string }> ?? [];

    const ids = configs.map((c) => c.id?.toLowerCase() ?? "");

    if (ids.some((id) => id.includes("pro"))) return { tier: "pro" };
    if (ids.some((id) => id.includes("logged") || id.includes("login"))) return { tier: "loggedIn" };

    // Key authenticated successfully → at minimum loggedIn
    return { tier: "loggedIn" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { tier: "guest", error: `Could not reach TrueFoundry (${msg}). Defaulting to Guest tier.` };
  }
}

function hasAccess(resolved: Tier, required: Tier): boolean {
  return TIER_RANK[resolved] >= TIER_RANK[required];
}

function accessDenied(tool: string, required: Tier, resolvedTier: Tier, tfError?: string): string {
  const labels: Record<Tier, string> = { guest: "Guest", loggedIn: "Logged-In", pro: "Pro" };
  const lines = [
    `🔒 Access denied — "${tool}" requires ${labels[required]} tier or higher.`,
    ``,
    `TrueFoundry reported your tier as: **${labels[resolvedTier]}**`,
  ];
  if (tfError) lines.push(`Reason: ${tfError}`);
  lines.push(
    ``,
    `How to upgrade:`,
    required === "loggedIn"
      ? `  • Create a free ChatDock account at https://chatdock.app/signup`
      : `  • Upgrade to ChatDock Pro at https://chatdock.app/pricing`,
    ``,
    `Make sure your TrueFoundry API key has the correct rate-limit policy attached.`
  );
  return lines.join("\n");
}

// ── Shared parameter schemas ──────────────────────────────────────────────────

const authParams = {
  truefoundry_api_key: z
    .string()
    .describe("Your TrueFoundry API key (tfy-...). Used to verify your access tier."),
  control_plane_url: z
    .string()
    .url()
    .describe("Your TrueFoundry control plane URL, e.g. https://xxx.truefoundry.cloud"),
};

// ── Documentation corpus ──────────────────────────────────────────────────────

interface DocEntry {
  topic: string;
  keywords: string[];
  basic: string;
  standard: string;
  expert: string;
}

const DOCS: DocEntry[] = [
  {
    topic: "what-is-chatdock",
    keywords: ["what", "chatdock", "overview", "about", "intro", "introduction"],
    basic: `## What is ChatDock?

ChatDock is an AI chatbot builder. You design a chatbot visually, connect it to an AI model, and get copy-paste code that drops into any Next.js app.

Key facts:
• No backend coding required to get started
• Works with TrueFoundry AI Gateway
• Exports a self-contained React component + Next.js API route
• Free tier available`,

    standard: `## What is ChatDock?

ChatDock is a visual AI chatbot builder that produces production-ready code for Next.js applications.

### Builder flow (4 steps)
1. **Design** — Set assistant name, greeting, colors, animation, panel size, corner radius, shadow
2. **Connect** — Link your TrueFoundry AI Gateway (paste Control Plane URL + API key)
3. **Live test** — Chat with your bot, try chaos modes (rate-limit, kill-primary, slow)
4. **Publish** — Copy ChatDockWidget.tsx + app/api/chat/route.ts into your project

### What you get
- \`ChatDockWidget.tsx\` — fully self-contained React widget with embedded CSS, 7 animations, streaming SSE chat, typing dots, abort-on-unmount
- \`app/api/chat/route.ts\` — Next.js server route that proxies to TrueFoundry, keeps API keys server-side, streams SSE
- AI prompt buttons (Claude XML format, Codex markdown format) to hand the implementation to an AI coding assistant

### Supported runtimes
- Next.js 13+ (App Router)
- React 18+
- Node.js 18+ (for the API route)`,

    expert: `## What is ChatDock? — Expert Reference

### Architecture

\`\`\`
Browser                   Next.js Server            TrueFoundry Gateway
────────                  ──────────────            ───────────────────
ChatDockWidget.tsx  POST► /api/chat/route.ts  POST► /openai/chat/completions
    ▲ SSE stream           OpenAI SDK               Virtual Model
    │ event: delta         (streams back)           Rate Limit Policy
    │ event: done                                   Guardrails
    │ event: error                                  MCP Tools
\`\`\`

### SSE event protocol
\`\`\`
event: delta
data: {"content":"Hello"}

event: done
data: {"finish_reason":"stop"}

event: error
data: {"message":"Gateway error 429"}
\`\`\`

### Widget config interface (TypeScript)
\`\`\`typescript
interface WidgetConfig {
  assistantName: string;
  launcherLabel: string;
  greeting: string;
  subGreeting: string;
  panelSize: "compact" | "standard" | "wide";
  animation: "slide" | "pop" | "fade" | "spring" | "drawer" | "flip" | "zoom";
  shadow: "soft" | "deep" | "flat";
  accentColor: string;
  panelColor: string;
  messageColor: string;
  messageTextColor: string;
  userBubbleColor: string;
  userTextColor: string;
  launcherColor: string;
  stageBackground: string;
  surfaceStyle: "solid" | "matte" | "glass";
  cornerRadius: number;
}
\`\`\`

### Tier model routing
\`\`\`typescript
const TIER_MODELS = {
  guest:    "vm:my-gateway/gpt-4o-mini",
  loggedIn: "vm:my-gateway/gpt-4o",
  pro:      "vm:my-gateway/claude-3-7-sonnet",
};
\`\`\`

### TrueFoundry auto-configuration
ChatDock fetches:
- \`GET /api/svc/v1/llm-gateway/config/provider-accounts\` → virtual models
- \`GET /api/svc/v1/llm-gateway/config/rate-limit-configs\` → rate limit policies
- \`GET /api/svc/v1/llm-gateway/config/guardrails\` → guardrail rules
- \`GET /api/svc/v1/llm-gateway/config/mcp-servers\` → MCP tools

Rate limit config naming: "guest-..."→Guest, "logged-in-..."→Logged-In, "pro-..."→Pro

### Animation transforms (closedTransform)
\`\`\`
slide:  translateY(22px)
pop:    scale(0.7) translateY(20px)
fade:   translateY(0) scale(1)   + opacity-only
spring: translateY(28px)
drawer: translateX(110%)
flip:   perspective(600px) rotateX(18deg)
zoom:   scale(0.5)
\`\`\`
Easing: cubic-bezier(0.34, 1.56, 0.64, 1) at 240ms.`,
  },
  {
    topic: "installation",
    keywords: ["install", "setup", "embed", "add", "integrate", "next.js", "nextjs"],
    basic: `## Installing ChatDock

1. Copy \`ChatDockWidget.tsx\` from the Publish page
2. Paste it into your project (e.g. \`components/ChatDockWidget.tsx\`)
3. Add it to your layout:
\`\`\`tsx
import { ChatDockWidget } from "@/components/ChatDockWidget";
export default function RootLayout({ children }) {
  return <html><body>{children}<ChatDockWidget /></body></html>;
}
\`\`\`
4. Set your env var: \`TRUEFOUNDRY_API_KEY=your_key_here\`
5. Run \`npm run dev\``,

    standard: `## Installing ChatDock — Full Guide

### Prerequisites
- Next.js 13+ with App Router
- \`npm install openai\`
- A TrueFoundry account with a gateway configured

### Step 1 — Copy files from ChatDock Publish page
\`\`\`
your-app/
  components/
    ChatDockWidget.tsx
  app/
    api/
      chat/
        route.ts
    layout.tsx
\`\`\`

### Step 2 — Install dependency
\`\`\`bash
npm install openai
\`\`\`

### Step 3 — Add env vars
\`\`\`.env.local
TRUEFOUNDRY_GATEWAY_URL=https://your-gateway.truefoundry.com
TRUEFOUNDRY_API_KEY=tfy-...
CHATDOCK_GUEST_MODEL=gpt-4o-mini
CHATDOCK_LOGGEDIN_MODEL=gpt-4o
CHATDOCK_PRO_MODEL=claude-3-7-sonnet
\`\`\`

### Step 4 — Add to layout
\`\`\`tsx
import { ChatDockWidget } from "@/components/ChatDockWidget";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatDockWidget userTier={session?.user?.plan ?? "guest"} />
      </body>
    </html>
  );
}
\`\`\`

### Step 5 — Run
\`\`\`bash
npm run dev
# Chatbot appears bottom-right at http://localhost:3000
\`\`\``,

    expert: `## Installing ChatDock — Expert Reference

### File manifest
| File | Purpose |
|------|---------|
| \`components/ChatDockWidget.tsx\` | Self-contained widget, ~350 lines, no external CSS |
| \`app/api/chat/route.ts\` | Next.js server route, streams SSE to widget |
| \`.env.local\` | Gateway URL + API key + model IDs |

### ChatDockWidget.tsx internals
- CSS injected as \`<style id="chatdock-css">\` in useEffect (checked for existence to avoid duplicates)
- All config baked in as constants (colors, animation, names)
- Streaming: fetch + ReadableStream reader + TextDecoder (no EventSource)
- Abort: AbortController in useRef, aborted in useEffect cleanup

### API route internals
\`\`\`typescript
const client = new OpenAI({
  baseURL: process.env.TRUEFOUNDRY_GATEWAY_URL,  // SDK appends /chat/completions
  apiKey: process.env.TRUEFOUNDRY_API_KEY!,
});

// Tier routing
const TIER_MODELS: Record<string, string> = {
  guest:    process.env.CHATDOCK_GUEST_MODEL!,
  loggedIn: process.env.CHATDOCK_LOGGEDIN_MODEL!,
  pro:      process.env.CHATDOCK_PRO_MODEL!,
};
\`\`\`

### Security model
- TrueFoundry API key NEVER reaches the browser
- userTier should be validated server-side against your JWT before trusting it
- Rate limiting enforced by TrueFoundry's gateway per tier policy

### Bundle cost
- Widget: 0 npm dependencies (CSS injected, no imports beyond React)
- API route: only \`openai\` (~45KB, server-side only)`,
  },
  {
    topic: "widget-design",
    keywords: ["design", "color", "animation", "style", "theme", "customize", "appearance", "look"],
    basic: `## Widget Design Options

• **Name** — Assistant's name (e.g. "Aria", "Support Bot")
• **Colors** — Accent, panel background, message bubbles
• **Animation** — How the chat panel opens (slide, pop, fade, spring, drawer, flip, zoom)
• **Size** — Compact (480px), Standard (560px), or Wide (600px)
• **Corner radius** — 8–24px`,

    standard: `## Widget Design Options — Full Reference

### Color properties
| Property | What it controls |
|----------|-----------------|
| Accent Color | Header background + send button |
| Panel Color | Chat window background |
| Message Color | AI response bubble background |
| Message Text | AI response text color |
| User Bubble | Your message bubble background |
| User Text | Your message text color |
| Launcher Color | Floating bottom-right button |

### Animation styles
| Style | Behavior |
|-------|---------|
| slide | Panel slides up from bottom |
| pop | Scales up from 70% with bounce |
| fade | Fades in with no movement |
| spring | Slides up with spring overshoot |
| drawer | Slides in from right edge |
| flip | 3D flip on X axis |
| zoom | Scales from 50% center |

All animations: cubic-bezier(0.34, 1.56, 0.64, 1) at 240ms.

### Surface styles
- **Solid** — Opaque (full panel color)
- **Matte** — 98% opacity
- **Glass** — 80% opacity + backdrop-filter: blur(20px)

### Panel sizes
| Size | Panel height | Message area |
|------|-------------|--------------|
| Compact | 480px | 376px |
| Standard | 560px | 456px |
| Wide | 600px | 496px |`,

    expert: `## Widget Design — Expert Reference

### Exact animation transforms (closedTransform function)
\`\`\`typescript
function closedTransform(anim: AnimationStyle): string {
  switch (anim) {
    case "pop":    return "scale(0.7) translateY(20px)";
    case "fade":   return "translateY(0) scale(1)";    // opacity-only
    case "zoom":   return "scale(0.5)";
    case "flip":   return "perspective(600px) rotateX(18deg)";
    case "drawer": return "translateX(110%)";
    case "spring": return "translateY(28px)";
    default:       return "translateY(22px)";           // slide
  }
}
\`\`\`
CSS: \`transform 240ms cubic-bezier(0.34,1.56,0.64,1), opacity 200ms ease\`

### Panel height math
\`\`\`typescript
const PANEL_HEIGHT = { compact: 480, standard: 560, wide: 600 };
const msgAreaHeight = panelHeight - 48 - 56; // header=48px, input=56px
\`\`\`

### Shadow values
\`\`\`typescript
const SHADOW = {
  soft: "0 4px 20px rgba(0,0,0,0.10)",
  deep: "0 12px 48px rgba(0,0,0,0.22)",
  flat: "none",
};
\`\`\`

### Typing indicator keyframes
\`\`\`css
@keyframes cdDotBounce {
  0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
  40%            { transform: translateY(-5px); opacity: 1;   }
}
/* Delays: 0s / 0.18s / 0.36s per dot */
\`\`\`

### Bubble border-radius formula
\`\`\`
AI bubble:   4px {r*0.65}px {r*0.65}px      (sharp top-left, rounded rest)
User bubble: {r*0.65}px {r*0.65}px 4px      (sharp bottom-right)
Input field: cornerRadius * 0.45
\`\`\``,
  },
  {
    topic: "truefoundry-gateway",
    keywords: ["truefoundry", "gateway", "llm", "model", "virtual", "api", "key", "connect", "tier"],
    basic: `## TrueFoundry Gateway

ChatDock connects to TrueFoundry's AI Gateway to power your chatbot.

To connect:
1. Go to your TrueFoundry control plane
2. Copy your Control Plane URL (e.g. https://xxx.truefoundry.cloud)
3. Generate an API key
4. Paste both into ChatDock's Connect step`,

    standard: `## TrueFoundry Gateway — Integration Guide

### What is TrueFoundry?
TrueFoundry is an ML platform providing an AI Gateway — a unified API layer for LLMs with rate limiting, guardrails, and budget controls.

### Connecting to ChatDock
1. Log into your TrueFoundry control plane
2. Navigate to AI Gateway → Virtual Models
3. Create virtual models for each tier
4. Copy your gateway base URL
5. Generate an API key with AI Gateway scope
6. In ChatDock Step 2, paste Control Plane URL + API key

### Auto-configuration
ChatDock auto-imports your entire gateway inventory:
- Virtual models → assigned to tiers automatically
- Rate limit configs → matched by name: "guest"→Guest, "logged/login"→Logged-In, "pro"→Pro
- Guardrails → all tiers
- MCP servers → all tiers

### Naming convention for tier auto-mapping
\`\`\`
"guests-100rpm"     → Guest tier
"logged-in-500rpm"  → Logged-In tier
"pro-unlimited"     → Pro tier
\`\`\``,

    expert: `## TrueFoundry Gateway — Expert Reference

### API endpoints used by ChatDock
\`\`\`
Base: {controlPlaneUrl}/api/svc/v1/llm-gateway/config/

GET provider-accounts     → virtual models (filter by manifest.type === "provider-account/virtual-model")
GET rate-limit-configs    → rate limit policies (id naming determines tier)
GET guardrails            → guardrail rules
GET mcp-servers           → MCP tool servers
\`\`\`
Auth: \`Authorization: Bearer {apiKey}\` on all requests.

### Provider account shape
\`\`\`typescript
interface ProviderAccount {
  id: string;
  name: string;
  manifest: {
    type: "provider-account/virtual-model" | string;
    model?: string;
    provider?: string;
  };
}
\`\`\`

### Rate limit config shape
\`\`\`typescript
interface RateLimitConfig {
  id: string;   // naming: "guests-...", "logged-in-...", "pro-..."
  name: string;
  manifest: {
    rules: Array<{ requests?: number; tokens?: number; period: string }>;
  };
}
\`\`\`

### OpenAI SDK base URL
\`\`\`typescript
const client = new OpenAI({
  baseURL: process.env.TRUEFOUNDRY_GATEWAY_URL,
  // DO NOT append /chat/completions — SDK does it automatically
  apiKey: process.env.TRUEFOUNDRY_API_KEY!,
});
\`\`\`
Virtual model ID format: \`vm:{gateway-name}/{model-name}\`

### This MCP server's tier resolution
This server calls \`GET {controlPlaneUrl}/api/svc/v1/llm-gateway/config/rate-limit-configs\`
with your API key on every privileged tool call:
- 401/403 → Guest tier
- Success + config with "pro" in id → Pro tier
- Success + config with "logged"/"login" → Logged-In tier
- Success + no matching names → Logged-In (key is valid)
- Network error → Guest (safe default)`,
  },
];

// ── Doc search helper ─────────────────────────────────────────────────────────

function searchDocs(query: string, level: "basic" | "standard" | "expert"): string {
  const q = query.toLowerCase();
  const matches: { doc: DocEntry; score: number }[] = [];

  for (const doc of DOCS) {
    let score = 0;
    for (const kw of doc.keywords) {
      if (q.includes(kw)) score += 2;
    }
    if (q.includes(doc.topic.replace(/-/g, " "))) score += 3;
    if (q.split(/\s+/).some((w) => doc.topic.includes(w) || doc.keywords.includes(w))) score += 1;
    if (score > 0) matches.push({ doc, score });
  }

  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    const topics = DOCS.map((d) => `• ${d.topic.replace(/-/g, " ")}`).join("\n");
    return `No results for "${query}".\n\nAvailable topics:\n${topics}`;
  }

  return matches
    .slice(0, 2)
    .map((m) => m.doc[level])
    .join("\n\n---\n\n");
}

// ── Widget config generator ───────────────────────────────────────────────────

interface WidgetConfigInput {
  assistantName?: string;
  launcherLabel?: string;
  greeting?: string;
  subGreeting?: string;
  accentColor?: string;
  panelColor?: string;
  messageColor?: string;
  animation?: string;
  panelSize?: string;
  shadow?: string;
  surfaceStyle?: string;
  cornerRadius?: number;
}

function generateWidgetConfig(input: WidgetConfigInput): string {
  const cfg = {
    assistantName:    input.assistantName  ?? "Assistant",
    launcherLabel:    input.launcherLabel  ?? "💬",
    greeting:         input.greeting       ?? "Hi there! How can I help you?",
    subGreeting:      input.subGreeting    ?? "Ask me anything — I'm here to help.",
    accentColor:      input.accentColor    ?? "#6d28d9",
    panelColor:       input.panelColor     ?? "#ffffff",
    messageColor:     input.messageColor   ?? "#f3f4f6",
    messageTextColor: "#111827",
    userBubbleColor:  input.accentColor    ?? "#6d28d9",
    userTextColor:    "#ffffff",
    launcherColor:    input.accentColor    ?? "#6d28d9",
    stageBackground:  "#f9fafb",
    animation:        input.animation      ?? "spring",
    panelSize:        input.panelSize      ?? "standard",
    shadow:           input.shadow         ?? "soft",
    surfaceStyle:     input.surfaceStyle   ?? "solid",
    cornerRadius:     input.cornerRadius   ?? 16,
  };

  return [
    `## Generated Widget Config`,
    ``,
    `Paste this constant into your \`ChatDockWidget.tsx\`:`,
    ``,
    "```typescript",
    `const WIDGET_CONFIG = ${JSON.stringify(cfg, null, 2)};`,
    "```",
    ``,
    `### Layout usage`,
    "```tsx",
    `import { ChatDockWidget } from "@/components/ChatDockWidget";`,
    ``,
    `export default function RootLayout({ children }: { children: React.ReactNode }) {`,
    `  return (`,
    `    <html lang="en">`,
    `      <body>{children}<ChatDockWidget /></body>`,
    `    </html>`,
    `  );`,
    `}`,
    "```",
    ``,
    `| Property | Value |`,
    `|----------|-------|`,
    `| Name | ${cfg.assistantName} |`,
    `| Animation | ${cfg.animation} |`,
    `| Panel size | ${cfg.panelSize} |`,
    `| Surface | ${cfg.surfaceStyle} |`,
    `| Accent | ${cfg.accentColor} |`,
    `| Corner radius | ${cfg.cornerRadius}px |`,
  ].join("\n");
}

// ── Integration blueprint ─────────────────────────────────────────────────────

function getIntegrationBlueprint(
  gatewayUrl: string,
  tiers: { guest: string; loggedIn: string; pro: string }
): string {
  return [
    `# ChatDock Integration Blueprint`,
    ``,
    `## File structure`,
    "```",
    `your-next-app/`,
    `├── components/`,
    `│   └── ChatDockWidget.tsx     ← copy from ChatDock Publish page`,
    `├── app/`,
    `│   ├── api/chat/route.ts      ← copy from ChatDock Publish page`,
    `│   └── layout.tsx             ← add <ChatDockWidget /> here`,
    `├── .env.local`,
    `└── package.json`,
    "```",
    ``,
    `## .env.local`,
    "```bash",
    `TRUEFOUNDRY_GATEWAY_URL=${gatewayUrl}`,
    `TRUEFOUNDRY_API_KEY=tfy-your-key-here`,
    `CHATDOCK_GUEST_MODEL=${tiers.guest}`,
    `CHATDOCK_LOGGEDIN_MODEL=${tiers.loggedIn}`,
    `CHATDOCK_PRO_MODEL=${tiers.pro}`,
    "```",
    ``,
    `## Install`,
    "```bash",
    `npm install openai`,
    "```",
    ``,
    `## Architecture`,
    "```",
    `Browser ──POST /api/chat──► Next.js ──OpenAI SDK──► TrueFoundry Gateway`,
    `        ◄── SSE stream ───            (streams)     ├── ${tiers.guest} (guest)`,
    `                                                     ├── ${tiers.loggedIn} (loggedIn)`,
    `                                                     └── ${tiers.pro} (pro)`,
    "```",
    ``,
    `## Tier matrix`,
    `| Feature | Guest | Logged-In | Pro |`,
    `|---------|-------|-----------|-----|`,
    `| Chat | ✓ | ✓ | ✓ |`,
    `| Model | ${tiers.guest} | ${tiers.loggedIn} | ${tiers.pro} |`,
    `| Rate limit | Basic | Standard | Unlimited |`,
    `| Guardrails | ✓ | ✓ | ✓ |`,
    `| MCP tools | ✗ | ✓ | ✓ |`,
    ``,
    `## Next steps`,
    `1. Copy files from ChatDock Publish page`,
    `2. Set env vars above`,
    `3. Add \`<ChatDockWidget />\` to root layout`,
    `4. Validate userTier server-side from your JWT before passing it to the widget`,
    `5. Deploy — API key stays server-side, never reaches the browser`,
  ].join("\n");
}

// ── MCP Server factory ────────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "chatdock-docs",
    version: "1.0.0",
  });

  // ── TOOL 1: search_docs_basic (guest — always accessible) ──────────────────
  server.tool(
    "search_docs_basic",
    "Search ChatDock documentation for a concise overview. Accessible to everyone — no API key needed.",
    {
      query: z.string().describe("What you want to know about ChatDock"),
    },
    async ({ query }) => ({
      content: [{ type: "text", text: searchDocs(query, "basic") }],
    })
  );

  // ── TOOL 2: get_quick_start (guest — always accessible) ────────────────────
  server.tool(
    "get_quick_start",
    "Get a 5-step quick start guide for embedding ChatDock in your Next.js project. Accessible to everyone — no API key needed.",
    {},
    async () => {
      const guide = [
        `# ChatDock Quick Start`,
        ``,
        `## Step 1 — Build your chatbot`,
        `Go to https://chatdock.app/builder — design your chatbot visually.`,
        ``,
        `## Step 2 — Copy the code`,
        `From the Publish page, copy:`,
        `• \`ChatDockWidget.tsx\` — React widget`,
        `• \`app/api/chat/route.ts\` — Next.js API route`,
        ``,
        `## Step 3 — Install dependency`,
        "```bash",
        `npm install openai`,
        "```",
        ``,
        `## Step 4 — Set env vars`,
        "```bash",
        `TRUEFOUNDRY_GATEWAY_URL=https://your-gateway.truefoundry.cloud`,
        `TRUEFOUNDRY_API_KEY=tfy-...`,
        "```",
        ``,
        `## Step 5 — Add to layout`,
        "```tsx",
        `import { ChatDockWidget } from "@/components/ChatDockWidget";`,
        `export default function RootLayout({ children }) {`,
        `  return <html><body>{children}<ChatDockWidget /></body></html>;`,
        `}`,
        "```",
        ``,
        `Run \`npm run dev\` — chatbot appears bottom-right. Done!`,
      ].join("\n");

      return { content: [{ type: "text", text: guide }] };
    }
  );

  // ── TOOL 3: search_docs_standard (requires loggedIn via TrueFoundry) ────────
  server.tool(
    "search_docs_standard",
    "Search ChatDock documentation with detailed guides, config tables, and usage examples. Requires a valid TrueFoundry API key (Logged-In tier or higher) — tier is verified live against TrueFoundry.",
    {
      query: z.string().describe("What you want to know about ChatDock"),
      ...authParams,
    },
    async ({ query, truefoundry_api_key, control_plane_url }) => {
      const { tier, error } = await resolveTierFromTrueFoundry(control_plane_url, truefoundry_api_key);
      if (!hasAccess(tier, "loggedIn")) {
        return { content: [{ type: "text", text: accessDenied("search_docs_standard", "loggedIn", tier, error) }] };
      }
      return { content: [{ type: "text", text: searchDocs(query, "standard") }] };
    }
  );

  // ── TOOL 4: generate_widget_config (requires loggedIn via TrueFoundry) ──────
  server.tool(
    "generate_widget_config",
    "Generate a ready-to-paste ChatDockWidget config TypeScript constant from your design preferences. Requires a valid TrueFoundry API key (Logged-In tier or higher) — tier is verified live against TrueFoundry.",
    {
      ...authParams,
      assistantName:  z.string().optional().describe('Assistant name, e.g. "Aria"'),
      launcherLabel:  z.string().optional().describe('Launcher button text/emoji, e.g. "💬"'),
      greeting:       z.string().optional().describe("Opening message"),
      subGreeting:    z.string().optional().describe("Subtitle under greeting"),
      accentColor:    z.string().optional().describe("Hex color for header + send button, e.g. #6d28d9"),
      panelColor:     z.string().optional().describe("Hex color for panel background"),
      messageColor:   z.string().optional().describe("Hex color for AI bubble background"),
      animation:      z.enum(["slide","pop","fade","spring","drawer","flip","zoom"]).optional(),
      panelSize:      z.enum(["compact","standard","wide"]).optional(),
      shadow:         z.enum(["soft","deep","flat"]).optional(),
      surfaceStyle:   z.enum(["solid","matte","glass"]).optional(),
      cornerRadius:   z.number().min(8).max(24).optional().describe("8–24 px"),
    },
    async ({ truefoundry_api_key, control_plane_url, ...input }) => {
      const { tier, error } = await resolveTierFromTrueFoundry(control_plane_url, truefoundry_api_key);
      if (!hasAccess(tier, "loggedIn")) {
        return { content: [{ type: "text", text: accessDenied("generate_widget_config", "loggedIn", tier, error) }] };
      }
      return { content: [{ type: "text", text: generateWidgetConfig(input) }] };
    }
  );

  // ── TOOL 5: search_docs_expert (requires pro via TrueFoundry) ───────────────
  server.tool(
    "search_docs_expert",
    "Search ChatDock documentation at expert level — full TypeScript interfaces, SSE protocol, animation math, TrueFoundry internals, security model. Requires a valid TrueFoundry API key (Pro tier) — tier is verified live against TrueFoundry.",
    {
      query: z.string().describe("What you want to know about ChatDock"),
      ...authParams,
    },
    async ({ query, truefoundry_api_key, control_plane_url }) => {
      const { tier, error } = await resolveTierFromTrueFoundry(control_plane_url, truefoundry_api_key);
      if (!hasAccess(tier, "pro")) {
        return { content: [{ type: "text", text: accessDenied("search_docs_expert", "pro", tier, error) }] };
      }
      return { content: [{ type: "text", text: searchDocs(query, "expert") }] };
    }
  );

  // ── TOOL 6: get_integration_blueprint (requires pro via TrueFoundry) ────────
  server.tool(
    "get_integration_blueprint",
    "Get a complete, personalized integration blueprint — file structure, all env vars, architecture diagram, tier matrix, next steps. Requires a valid TrueFoundry API key (Pro tier) — tier is verified live against TrueFoundry.",
    {
      ...authParams,
      gateway_url:      z.string().url().describe("Your TrueFoundry gateway base URL"),
      guest_model:      z.string().describe('Virtual model ID for guests, e.g. "vm:my-gw/gpt-4o-mini"'),
      logged_in_model:  z.string().describe('Virtual model ID for logged-in users'),
      pro_model:        z.string().describe('Virtual model ID for pro users'),
    },
    async ({ truefoundry_api_key, control_plane_url, gateway_url, guest_model, logged_in_model, pro_model }) => {
      const { tier, error } = await resolveTierFromTrueFoundry(control_plane_url, truefoundry_api_key);
      if (!hasAccess(tier, "pro")) {
        return { content: [{ type: "text", text: accessDenied("get_integration_blueprint", "pro", tier, error) }] };
      }
      return {
        content: [{
          type: "text",
          text: getIntegrationBlueprint(gateway_url, {
            guest: guest_model,
            loggedIn: logged_in_model,
            pro: pro_model,
          }),
        }],
      };
    }
  );

  return server;
}

// ── Express HTTP server ───────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    name: "chatdock-mcp",
    version: "1.0.0",
    description: "Tier access resolved live from TrueFoundry API — no hardcoded tiers.",
    tools: [
      { name: "search_docs_basic",         tier: "guest",    auth: false },
      { name: "get_quick_start",           tier: "guest",    auth: false },
      { name: "search_docs_standard",      tier: "loggedIn", auth: true  },
      { name: "generate_widget_config",    tier: "loggedIn", auth: true  },
      { name: "search_docs_expert",        tier: "pro",      auth: true  },
      { name: "get_integration_blueprint", tier: "pro",      auth: true  },
    ],
  });
});

app.post("/mcp", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  const server = createMcpServer();
  res.on("close", () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Internal MCP server error" });
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer();
  res.on("close", () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Internal MCP server error" });
  }
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);
app.listen(PORT, () => {
  console.log(`ChatDock MCP server on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`MCP:    http://localhost:${PORT}/mcp`);
  console.log(`Tier resolution: live via TrueFoundry API (no hardcoded tiers)`);
});
