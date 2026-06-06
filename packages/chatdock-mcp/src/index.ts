import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import { z } from "zod";

// ── Tier helpers ──────────────────────────────────────────────────────────────

type Tier = "guest" | "loggedIn" | "pro";
const TIER_RANK: Record<Tier, number> = { guest: 0, loggedIn: 1, pro: 2 };

function hasAccess(userTier: Tier, required: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

function accessDenied(tool: string, required: Tier): string {
  const labels: Record<Tier, string> = {
    guest: "Guest",
    loggedIn: "Logged-In",
    pro: "Pro",
  };
  return [
    `🔒 Access denied: "${tool}" requires a ${labels[required]} account or higher.`,
    ``,
    `How to upgrade:`,
    required === "loggedIn"
      ? `  • Create a free ChatDock account at https://chatdock.app/signup`
      : `  • Upgrade to ChatDock Pro at https://chatdock.app/pricing`,
    ``,
    `Your current tier: Guest`,
    `Required tier: ${labels[required]}`,
  ].join("\n");
}

const tierSchema = z
  .enum(["guest", "loggedIn", "pro"])
  .describe(
    'User tier: "guest" (unauthenticated), "loggedIn" (free account), or "pro" (paid)'
  );

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
The API route streams Server-Sent Events in this exact format:
\`\`\`
event: delta
data: {"content":"Hello"}

event: delta
data: {"content":" world"}

event: done
data: {"finish_reason":"stop"}

event: error
data: {"message":"Gateway error 429"}
\`\`\`

### Widget config interface (TypeScript)
\`\`\`typescript
interface WidgetConfig {
  assistantName: string;       // "Aria", "Support Bot", etc.
  launcherLabel: string;       // emoji or short text shown on launcher button
  greeting: string;            // first bot message title
  subGreeting: string;         // subtitle under greeting
  panelSize: "compact" | "standard" | "wide";   // 480 | 560 | 600px height
  animation: "slide" | "pop" | "fade" | "spring" | "drawer" | "flip" | "zoom";
  shadow: "soft" | "deep" | "flat";
  accentColor: string;         // header + send button
  panelColor: string;          // chat panel background
  messageColor: string;        // AI message bubble background
  messageTextColor: string;    // AI message text
  userBubbleColor: string;     // user message bubble background
  userTextColor: string;       // user message text
  launcherColor: string;       // floating launcher button
  stageBackground: string;     // page background in preview
  surfaceStyle: "solid" | "matte" | "glass";
  cornerRadius: number;        // 8–24 px
}
\`\`\`

### Tier model routing
The API route receives \`userTier\` ("guest" | "loggedIn" | "pro") from the client and selects the correct TrueFoundry virtual model:
\`\`\`typescript
const TIER_MODELS = {
  guest:    "vm:my-gateway/gpt-4o-mini",
  loggedIn: "vm:my-gateway/gpt-4o",
  pro:      "vm:my-gateway/claude-3-7-sonnet",
};
\`\`\`

### TrueFoundry auto-configuration
When you paste a Control Plane URL + API key, ChatDock fetches:
- \`GET /api/svc/v1/llm-gateway/config/provider-accounts\` → virtual models
- \`GET /api/svc/v1/llm-gateway/config/rate-limit-configs\` → rate limit policies
- \`GET /api/svc/v1/llm-gateway/config/guardrails\` → guardrail rules
- \`GET /api/svc/v1/llm-gateway/config/mcp-servers\` → MCP tools

Rate limit configs with \`id\` containing "guest" → guest tier, "logged"/"login" → loggedIn tier, "pro" → pro tier.

### Animation transform values (closedTransform)
\`\`\`
slide:  translateY(22px)
pop:    scale(0.7) translateY(20px)
fade:   translateY(0) scale(1)   + opacity: 0
spring: translateY(28px)
drawer: translateX(110%)
flip:   perspective(600px) rotateX(18deg)
zoom:   scale(0.5)
\`\`\`
Spring easing: \`cubic-bezier(0.34, 1.56, 0.64, 1)\` at 240ms.`,
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
  return (
    <html><body>
      {children}
      <ChatDockWidget />
    </body></html>
  );
}
\`\`\`
4. Set your env var: \`TRUEFOUNDRY_API_KEY=your_key_here\`
5. Run \`npm run dev\``,

    standard: `## Installing ChatDock — Full Guide

### Prerequisites
- Next.js 13+ with App Router
- \`npm install openai\` (the only dependency)
- A TrueFoundry account with a gateway configured

### Step 1 — Copy the widget
From ChatDock's Publish page, copy \`ChatDockWidget.tsx\` and save it to:
\`\`\`
your-app/
  components/
    ChatDockWidget.tsx   ← paste here
  app/
    api/
      chat/
        route.ts         ← paste this too
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
// app/layout.tsx
import { ChatDockWidget } from "@/components/ChatDockWidget";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatDockWidget />
      </body>
    </html>
  );
}
\`\`\`

### Step 5 — Run
\`\`\`bash
npm run dev
# Open http://localhost:3000 — chatbot appears bottom-right
\`\`\`

### Passing user tier
\`\`\`tsx
// Pass the current user's tier for model routing
<ChatDockWidget userTier={session?.user?.plan ?? "guest"} />
\`\`\``,

    expert: `## Installing ChatDock — Expert Reference

### File manifest
| File | Purpose | Required |
|------|---------|----------|
| \`components/ChatDockWidget.tsx\` | Self-contained widget, ~350 lines | Yes |
| \`app/api/chat/route.ts\` | Next.js server route, streams SSE | Yes |
| \`app/layout.tsx\` | Mount point | Yes |
| \`.env.local\` | Gateway URL + API key + model IDs | Yes |

### ChatDockWidget.tsx internals
The widget is fully self-contained — no CSS files, no external imports beyond React:
- CSS is injected as a \`<style id="chatdock-css">\` tag in \`useEffect\`, checked for existence to avoid duplicates
- All config (colors, animation, names) is baked in as constants at the top of the file
- Streaming: uses \`fetch + ReadableStream reader + TextDecoder\` (no EventSource)
- Abort: uses \`AbortController\` stored in \`useRef\`, aborted in \`useEffect\` cleanup

### API route internals (app/api/chat/route.ts)
\`\`\`typescript
import OpenAI from "openai";
import { NextRequest } from "next/server";

const client = new OpenAI({
  baseURL: process.env.TRUEFOUNDRY_GATEWAY_URL,   // SDK appends /chat/completions
  apiKey: process.env.TRUEFOUNDRY_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { messages, userTier } = await req.json();
  const model = TIER_MODELS[userTier ?? "guest"];

  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? "";
        if (content) {
          controller.enqueue(encoder.encode("event: delta\\ndata: " + JSON.stringify({ content }) + "\\n\\n"));
        }
        if (chunk.choices[0]?.finish_reason === "stop") {
          controller.enqueue(encoder.encode("event: done\\ndata: {}\\n\\n"));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
\`\`\`

### Security model
- The TrueFoundry API key NEVER reaches the browser — it lives only in the Next.js server route
- \`userTier\` comes from the client but should be validated server-side against your session/JWT before trusting it
- Rate limiting is handled by TrueFoundry's rate limit policies per tier

### Zero-dependency deployment
The widget has no npm dependencies. The API route only requires \`openai\`. Total additional bundle cost: ~45KB (openai SDK, server-side only).`,
  },
  {
    topic: "widget-design",
    keywords: ["design", "color", "animation", "style", "theme", "customize", "appearance", "look"],
    basic: `## Widget Design Options

ChatDock lets you customize:
• **Name** — Your assistant's name (e.g. "Aria", "Support Bot")
• **Colors** — Accent, panel background, message bubbles
• **Animation** — How the chat panel opens (slide, pop, fade, spring, drawer, flip, zoom)
• **Size** — Compact, Standard, or Wide panel
• **Corner radius** — Rounded or sharp corners`,

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

All animations use \`cubic-bezier(0.34, 1.56, 0.64, 1)\` at 240ms.

### Surface styles
- **Solid** — Opaque panel, full panel color
- **Matte** — Slightly frosted (98% opacity)
- **Glass** — Glassmorphism with blur (80% opacity + \`backdrop-filter: blur(20px)\`)

### Panel sizes
| Size | Panel height | Message area |
|------|-------------|--------------|
| Compact | 480px | 376px |
| Standard | 560px | 456px |
| Wide | 600px | 496px |

### Corner radius
Range: 8–24px. Applied as:
- Panel: \`borderRadius: cornerRadius\`
- AI bubble: \`4px {r*0.65}px {r*0.65}px\` (sharp left, rounded right)
- User bubble: \`{r*0.65}px {r*0.65}px 4px\` (rounded left, sharp right)
- Input field: \`cornerRadius * 0.45\``,

    expert: `## Widget Design — Expert Reference

### Exact animation transforms
The widget applies these transforms when closed (opacity: 0):
\`\`\`typescript
function closedTransform(anim: AnimationStyle): string {
  switch (anim) {
    case "pop":    return "scale(0.7) translateY(20px)";
    case "fade":   return "translateY(0) scale(1)";     // opacity-only
    case "zoom":   return "scale(0.5)";
    case "flip":   return "perspective(600px) rotateX(18deg)";
    case "drawer": return "translateX(110%)";
    case "spring": return "translateY(28px)";
    default:       return "translateY(22px)";            // slide
  }
}
\`\`\`
CSS transition: \`transform 240ms cubic-bezier(0.34,1.56,0.64,1), opacity 200ms ease\`

### Panel height constants
\`\`\`typescript
const PANEL_HEIGHT = { compact: 480, standard: 560, wide: 600 };
const msgAreaHeight = panelHeight - 48 - 56; // minus header (48px) and input (56px)
\`\`\`

### Shadow values
\`\`\`typescript
const SHADOW = {
  soft: "0 4px 20px rgba(0,0,0,0.10)",
  deep: "0 12px 48px rgba(0,0,0,0.22)",
  flat: "none",
};
\`\`\`

### Injected CSS structure
The widget injects a \`<style id="chatdock-css">\` block in \`useEffect\` with a guard:
\`\`\`typescript
useEffect(() => {
  if (document.getElementById("chatdock-css")) return;
  const style = document.createElement("style");
  style.id = "chatdock-css";
  style.textContent = WIDGET_CSS; // ~120 lines of CSS as a template string
  document.head.appendChild(style);
}, []);
\`\`\`

The CSS uses BEM-like class names prefixed with \`.cd-\` to avoid collisions with the host app's styles.

### Typing indicator
Three dots with staggered animation:
\`\`\`css
@keyframes cdDotBounce {
  0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
  40%            { transform: translateY(-5px); opacity: 1;   }
}
\`\`\`
Each dot gets \`animation-delay: 0s / 0.18s / 0.36s\`.`,
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
4. Paste both into ChatDock's Connect step

TrueFoundry routes requests to AI models like GPT-4o, Claude, Llama, etc.`,

    standard: `## TrueFoundry Gateway — Integration Guide

### What is TrueFoundry?
TrueFoundry is an ML platform that provides an AI Gateway — a unified API layer that routes LLM requests to any model (OpenAI, Anthropic, Together, Fireworks, local models) with rate limiting, guardrails, and budget controls.

### Connecting to ChatDock
1. Log into your TrueFoundry control plane
2. Navigate to **AI Gateway** → **Virtual Models**
3. Create virtual models for each tier (e.g. gpt-4o-mini for guests, gpt-4o for logged-in, claude-3-7-sonnet for pro)
4. Copy your gateway base URL (shown on the AI Gateway page)
5. Generate an API key with **AI Gateway** scope
6. In ChatDock → Step 2 (Connect), paste the Control Plane URL + API key

### Auto-configuration
ChatDock auto-imports your entire gateway inventory:
- **Virtual models** → assigned to all tiers automatically (or you pick from a dropdown if multiple)
- **Rate limit configs** → matched to tiers by name: "guest"→Guest, "logged/login"→Logged-In, "pro"→Pro
- **Guardrails** → applied to all tiers
- **MCP servers** → applied to all tiers

### Naming convention for auto-mapping
\`\`\`
Rate limit config ID: "guests-100rpm"     → Guest tier
Rate limit config ID: "logged-in-500rpm"  → Logged-In tier
Rate limit config ID: "pro-unlimited"     → Pro tier
\`\`\`

### API key scopes needed
- \`AI Gateway Read\` — to fetch inventory (virtual models, rate limits, etc.)
- \`AI Gateway Inference\` — to make chat completion requests`,

    expert: `## TrueFoundry Gateway — Expert Reference

### API endpoints used by ChatDock

ChatDock calls these TrueFoundry REST endpoints:
\`\`\`
Base: {controlPlaneUrl}/api/svc/v1/llm-gateway/config/

GET provider-accounts     → list virtual models + provider accounts
GET rate-limit-configs    → list rate limit policies
GET guardrails            → list guardrail rules
GET mcp-servers           → list MCP tool servers
\`\`\`

Authentication: \`Authorization: Bearer {apiKey}\` header.

### Provider accounts response shape
\`\`\`typescript
interface ProviderAccount {
  id: string;
  name: string;
  manifest: {
    type: "provider-account/virtual-model" | "provider-account/...";
    model?: string;       // underlying model ID
    provider?: string;    // "openai" | "anthropic" | etc.
  };
}
\`\`\`
Virtual models are filtered by \`manifest.type === "provider-account/virtual-model"\`.

### Rate limit config shape
\`\`\`typescript
interface RateLimitConfig {
  id: string;            // used for tier mapping: "guests-...", "logged-in-...", "pro-..."
  name: string;
  manifest: {
    rules: Array<{
      requests?: number;
      tokens?: number;
      period: "minute" | "hour" | "day";
    }>;
  };
}
\`\`\`

### OpenAI SDK base URL
ChatDock's API route uses the OpenAI SDK pointed at TrueFoundry:
\`\`\`typescript
const client = new OpenAI({
  baseURL: process.env.TRUEFOUNDRY_GATEWAY_URL,
  // SDK automatically appends /chat/completions — do NOT add it to baseURL
  apiKey: process.env.TRUEFOUNDRY_API_KEY!,
});
\`\`\`
The virtual model ID format used in \`model\` field:
\`\`\`
vm:{gateway-name}/{model-name}
// Example: "vm:my-gateway/gpt-4o-mini"
\`\`\`

### Tier routing in API route
\`\`\`typescript
const TIER_MODELS: Record<string, string> = {
  guest:    process.env.CHATDOCK_GUEST_MODEL!,
  loggedIn: process.env.CHATDOCK_LOGGEDIN_MODEL!,
  pro:      process.env.CHATDOCK_PRO_MODEL!,
};

// In POST handler:
const model = TIER_MODELS[body.userTier] ?? TIER_MODELS.guest;
\`\`\`

### Guardrails
TrueFoundry guardrails are applied at the gateway level — your API route doesn't need special handling. The gateway intercepts requests/responses and applies rules (PII detection, toxicity filtering, topic restrictions, etc.) before returning to your app.

### MCP tools
MCP (Model Context Protocol) servers registered in TrueFoundry are tool-calling endpoints. When you enable an MCP server in ChatDock, the widget can call tools in the AI's response (requires tool-call rendering support in the widget — currently for Pro tier).`,
  },
];

// ── Tool: search_docs_basic ───────────────────────────────────────────────────

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
    return `No results found for "${query}".\n\nAvailable topics:\n${topics}`;
  }

  const topResults = matches.slice(0, 2);
  return topResults
    .map((m) => m.doc[level])
    .join("\n\n---\n\n");
}

// ── Tool: generate_widget_config ──────────────────────────────────────────────

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
    assistantName: input.assistantName ?? "Assistant",
    launcherLabel: input.launcherLabel ?? "💬",
    greeting: input.greeting ?? "Hi there! How can I help you?",
    subGreeting: input.subGreeting ?? "Ask me anything — I'm here to help.",
    accentColor: input.accentColor ?? "#6d28d9",
    panelColor: input.panelColor ?? "#ffffff",
    messageColor: input.messageColor ?? "#f3f4f6",
    messageTextColor: "#111827",
    userBubbleColor: input.accentColor ?? "#6d28d9",
    userTextColor: "#ffffff",
    launcherColor: input.accentColor ?? "#6d28d9",
    stageBackground: "#f9fafb",
    animation: input.animation ?? "spring",
    panelSize: input.panelSize ?? "standard",
    shadow: input.shadow ?? "soft",
    surfaceStyle: input.surfaceStyle ?? "solid",
    cornerRadius: input.cornerRadius ?? 16,
  };

  const json = JSON.stringify(cfg, null, 2);

  return [
    `## Generated Widget Config`,
    ``,
    `Paste this \`WIDGET_CONFIG\` constant into your \`ChatDockWidget.tsx\`:`,
    ``,
    `\`\`\`typescript`,
    `const WIDGET_CONFIG = ${json};`,
    `\`\`\``,
    ``,
    `### Usage in layout.tsx`,
    `\`\`\`tsx`,
    `import { ChatDockWidget } from "@/components/ChatDockWidget";`,
    ``,
    `export default function RootLayout({ children }: { children: React.ReactNode }) {`,
    `  return (`,
    `    <html lang="en">`,
    `      <body>`,
    `        {children}`,
    `        <ChatDockWidget />`,
    `      </body>`,
    `    </html>`,
    `  );`,
    `}`,
    `\`\`\``,
    ``,
    `### Config summary`,
    `| Property | Value |`,
    `|----------|-------|`,
    `| Assistant name | ${cfg.assistantName} |`,
    `| Animation | ${cfg.animation} |`,
    `| Panel size | ${cfg.panelSize} |`,
    `| Surface style | ${cfg.surfaceStyle} |`,
    `| Accent color | ${cfg.accentColor} |`,
    `| Corner radius | ${cfg.cornerRadius}px |`,
  ].join("\n");
}

// ── Tool: get_integration_blueprint ──────────────────────────────────────────

function getIntegrationBlueprint(
  gatewayUrl: string,
  tiers: { guest: string; loggedIn: string; pro: string }
): string {
  return [
    `# ChatDock Integration Blueprint`,
    ``,
    `## File structure`,
    `\`\`\``,
    `your-next-app/`,
    `├── components/`,
    `│   └── ChatDockWidget.tsx     ← copy from ChatDock Publish page`,
    `├── app/`,
    `│   ├── api/`,
    `│   │   └── chat/`,
    `│   │       └── route.ts       ← copy from ChatDock Publish page`,
    `│   └── layout.tsx             ← add <ChatDockWidget /> here`,
    `├── .env.local                 ← add env vars below`,
    `└── package.json               ← npm install openai`,
    `\`\`\``,
    ``,
    `## Environment variables (.env.local)`,
    `\`\`\`bash`,
    `TRUEFOUNDRY_GATEWAY_URL=${gatewayUrl}`,
    `TRUEFOUNDRY_API_KEY=tfy-your-api-key-here`,
    `CHATDOCK_GUEST_MODEL=${tiers.guest}`,
    `CHATDOCK_LOGGEDIN_MODEL=${tiers.loggedIn}`,
    `CHATDOCK_PRO_MODEL=${tiers.pro}`,
    `\`\`\``,
    ``,
    `## Install`,
    `\`\`\`bash`,
    `npm install openai`,
    `\`\`\``,
    ``,
    `## Layout mount`,
    `\`\`\`tsx`,
    `// app/layout.tsx`,
    `import { ChatDockWidget } from "@/components/ChatDockWidget";`,
    ``,
    `export default function RootLayout({ children }: { children: React.ReactNode }) {`,
    `  return (`,
    `    <html lang="en">`,
    `      <body>`,
    `        {children}`,
    `        {/* Pass userTier from your auth session */}`,
    `        <ChatDockWidget userTier={session?.user?.plan ?? "guest"} />`,
    `      </body>`,
    `    </html>`,
    `  );`,
    `}`,
    `\`\`\``,
    ``,
    `## Architecture diagram`,
    `\`\`\``,
    `┌─────────────────────────────────────────────────────────────┐`,
    `│  Browser                                                     │`,
    `│  ┌──────────────────────┐                                   │`,
    `│  │  ChatDockWidget.tsx  │ ── POST /api/chat ──►             │`,
    `│  │  (React component)   │ ◄── SSE stream ──────            │`,
    `│  └──────────────────────┘                     │            │`,
    `└──────────────────────────────────────────────────────────┘  │`,
    `                                                │              │`,
    `┌─────────────────────────────────────────────────────────────┘`,
    `│  Next.js Server (app/api/chat/route.ts)`,
    `│  ┌──────────────────────────────────────┐`,
    `│  │  • Reads userTier from request body  │`,
    `│  │  • Selects model from TIER_MODELS    │`,
    `│  │  • Calls TrueFoundry via OpenAI SDK  │`,
    `│  │  • Streams SSE back to browser       │`,
    `│  └──────────────────┬───────────────────┘`,
    `└─────────────────────│───────────────────────────────────────┐`,
    `                      │`,
    `┌─────────────────────▼───────────────────────────────────────┐`,
    `│  TrueFoundry AI Gateway (${gatewayUrl.slice(0, 40)}...)`,
    `│  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌───────────┐ │`,
    `│  │  Guest  │  │ LoggedIn │  │    Pro     │  │Guardrails │ │`,
    `│  │ ${tiers.guest.slice(0, 9).padEnd(9)} │  │ ${tiers.loggedIn.slice(0, 9).padEnd(9)} │  │ ${tiers.pro.slice(0, 10).padEnd(10)} │  │ + MCP    │ │`,
    `│  └─────────┘  └──────────┘  └────────────┘  └───────────┘ │`,
    `└─────────────────────────────────────────────────────────────┘`,
    `\`\`\``,
    ``,
    `## Tier access matrix`,
    `| Feature | Guest | Logged-In | Pro |`,
    `|---------|-------|-----------|-----|`,
    `| Chat responses | ✓ | ✓ | ✓ |`,
    `| Rate limit policy | Basic | Standard | Unlimited |`,
    `| Model | ${tiers.guest} | ${tiers.loggedIn} | ${tiers.pro} |`,
    `| Guardrails | ✓ | ✓ | ✓ |`,
    `| MCP tools | ✗ | ✓ | ✓ |`,
    ``,
    `## Next steps`,
    `1. Copy \`ChatDockWidget.tsx\` and \`app/api/chat/route.ts\` from ChatDock's Publish page`,
    `2. Set up env vars above`,
    `3. Add \`<ChatDockWidget />\` to your root layout`,
    `4. Deploy to Vercel / Railway — gateway URL and API key are server-only`,
    `5. Test all three tiers by passing \`userTier\` prop`,
  ].join("\n");
}

// ── MCP Server factory ────────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "chatdock-docs",
    version: "1.0.0",
  });

  // ── TOOL 1: search_docs_basic (guest) ──────────────────────────────────────
  server.tool(
    "search_docs_basic",
    "Search ChatDock documentation for basic overview information. Available to all users (guest tier). Returns concise summaries — upgrade for detailed guides.",
    {
      query: z.string().describe("What you want to know about ChatDock"),
      tier: tierSchema,
    },
    async ({ query, tier }) => {
      return {
        content: [
          {
            type: "text",
            text: searchDocs(query, "basic"),
          },
        ],
      };
    }
  );

  // ── TOOL 2: get_quick_start (guest) ────────────────────────────────────────
  server.tool(
    "get_quick_start",
    "Get a quick start guide for setting up ChatDock in your Next.js project. Available to all users (guest tier). Returns a 5-step getting-started guide.",
    {
      tier: tierSchema,
    },
    async ({ tier }) => {
      const guide = [
        `# ChatDock Quick Start`,
        ``,
        `Get a working AI chatbot in your Next.js app in 5 steps.`,
        ``,
        `## Step 1 — Build your chatbot`,
        `Go to https://chatdock.app/builder and use the visual designer to:`,
        `• Set your assistant's name and greeting`,
        `• Choose colors, animation style, and panel size`,
        `• Connect your TrueFoundry AI Gateway`,
        ``,
        `## Step 2 — Copy the code`,
        `On the Publish page, copy two files:`,
        `• \`ChatDockWidget.tsx\` — the React widget`,
        `• \`app/api/chat/route.ts\` — the Next.js API route`,
        ``,
        `## Step 3 — Install dependency`,
        `\`\`\`bash`,
        `npm install openai`,
        `\`\`\``,
        ``,
        `## Step 4 — Set env vars`,
        `\`\`\`.env.local`,
        `TRUEFOUNDRY_GATEWAY_URL=https://your-gateway.truefoundry.cloud`,
        `TRUEFOUNDRY_API_KEY=tfy-...`,
        `\`\`\``,
        ``,
        `## Step 5 — Add to your layout`,
        `\`\`\`tsx`,
        `// app/layout.tsx`,
        `import { ChatDockWidget } from "@/components/ChatDockWidget";`,
        ``,
        `export default function RootLayout({ children }) {`,
        `  return <html><body>{children}<ChatDockWidget /></body></html>;`,
        `}`,
        `\`\`\``,
        ``,
        `That's it! Run \`npm run dev\` — your chatbot appears in the bottom-right corner.`,
        ``,
        `---`,
        `*For detailed configuration and tier-based routing, upgrade to Logged-In or Pro.*`,
      ].join("\n");

      return { content: [{ type: "text", text: guide }] };
    }
  );

  // ── TOOL 3: search_docs_standard (loggedIn) ────────────────────────────────
  server.tool(
    "search_docs_standard",
    "Search ChatDock documentation with detailed explanations, usage examples, and configuration guides. Requires Logged-In tier or higher.",
    {
      query: z.string().describe("What you want to know about ChatDock"),
      tier: tierSchema,
    },
    async ({ query, tier }) => {
      if (!hasAccess(tier as Tier, "loggedIn")) {
        return {
          content: [{ type: "text", text: accessDenied("search_docs_standard", "loggedIn") }],
        };
      }
      return {
        content: [{ type: "text", text: searchDocs(query, "standard") }],
      };
    }
  );

  // ── TOOL 4: generate_widget_config (loggedIn) ──────────────────────────────
  server.tool(
    "generate_widget_config",
    "Generate a complete ChatDockWidget config object based on your design preferences. Returns a TypeScript constant ready to paste into ChatDockWidget.tsx. Requires Logged-In tier or higher.",
    {
      tier: tierSchema,
      assistantName: z
        .string()
        .optional()
        .describe('Name of the AI assistant, e.g. "Aria", "Support Bot"'),
      launcherLabel: z
        .string()
        .optional()
        .describe('Text or emoji for the launcher button, e.g. "💬", "Chat"'),
      greeting: z
        .string()
        .optional()
        .describe("First message shown in the chat panel"),
      subGreeting: z
        .string()
        .optional()
        .describe("Subtitle under the greeting"),
      accentColor: z
        .string()
        .optional()
        .describe("Hex color for header and send button, e.g. #6d28d9"),
      panelColor: z
        .string()
        .optional()
        .describe("Hex color for chat panel background, e.g. #ffffff"),
      animation: z
        .enum(["slide", "pop", "fade", "spring", "drawer", "flip", "zoom"])
        .optional()
        .describe("Animation style for panel open/close"),
      panelSize: z
        .enum(["compact", "standard", "wide"])
        .optional()
        .describe("Panel height: compact=480px, standard=560px, wide=600px"),
      shadow: z
        .enum(["soft", "deep", "flat"])
        .optional()
        .describe("Drop shadow intensity"),
      surfaceStyle: z
        .enum(["solid", "matte", "glass"])
        .optional()
        .describe("Panel surface: solid=opaque, matte=98% opacity, glass=blur"),
      cornerRadius: z
        .number()
        .min(8)
        .max(24)
        .optional()
        .describe("Corner radius in px (8–24)"),
    },
    async ({ tier, ...input }) => {
      if (!hasAccess(tier as Tier, "loggedIn")) {
        return {
          content: [{ type: "text", text: accessDenied("generate_widget_config", "loggedIn") }],
        };
      }
      return {
        content: [{ type: "text", text: generateWidgetConfig(input) }],
      };
    }
  );

  // ── TOOL 5: search_docs_expert (pro) ───────────────────────────────────────
  server.tool(
    "search_docs_expert",
    "Search ChatDock documentation at expert level — full API reference, TypeScript interfaces, SSE protocol details, TrueFoundry internals, animation math, security model. Requires Pro tier.",
    {
      query: z.string().describe("What you want to know about ChatDock"),
      tier: tierSchema,
    },
    async ({ query, tier }) => {
      if (!hasAccess(tier as Tier, "pro")) {
        return {
          content: [{ type: "text", text: accessDenied("search_docs_expert", "pro") }],
        };
      }
      return {
        content: [{ type: "text", text: searchDocs(query, "expert") }],
      };
    }
  );

  // ── TOOL 6: get_integration_blueprint (pro) ────────────────────────────────
  server.tool(
    "get_integration_blueprint",
    "Get a complete, personalized integration blueprint for adding ChatDock to your production Next.js app — includes file structure, all env vars, architecture diagram, tier access matrix, and next steps. Requires Pro tier.",
    {
      tier: tierSchema,
      gatewayUrl: z
        .string()
        .url()
        .describe("Your TrueFoundry gateway base URL, e.g. https://xxx.truefoundry.cloud"),
      guestModel: z
        .string()
        .describe('Virtual model ID for guest users, e.g. "vm:my-gateway/gpt-4o-mini"'),
      loggedInModel: z
        .string()
        .describe('Virtual model ID for logged-in users, e.g. "vm:my-gateway/gpt-4o"'),
      proModel: z
        .string()
        .describe('Virtual model ID for pro users, e.g. "vm:my-gateway/claude-3-7-sonnet"'),
    },
    async ({ tier, gatewayUrl, guestModel, loggedInModel, proModel }) => {
      if (!hasAccess(tier as Tier, "pro")) {
        return {
          content: [{ type: "text", text: accessDenied("get_integration_blueprint", "pro") }],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: getIntegrationBlueprint(gatewayUrl, {
              guest: guestModel,
              loggedIn: loggedInModel,
              pro: proModel,
            }),
          },
        ],
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
    tools: [
      { name: "search_docs_basic",          tier: "guest" },
      { name: "get_quick_start",            tier: "guest" },
      { name: "search_docs_standard",       tier: "loggedIn" },
      { name: "generate_widget_config",     tier: "loggedIn" },
      { name: "search_docs_expert",         tier: "pro" },
      { name: "get_integration_blueprint",  tier: "pro" },
    ],
  });
});

app.post("/mcp", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — each request is independent
  });

  const server = createMcpServer();

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP server error" });
    }
  }
});

// SSE upgrade endpoint (for clients that initiate with GET)
app.get("/mcp", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = createMcpServer();

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP server error" });
    }
  }
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);
app.listen(PORT, () => {
  console.log(`ChatDock MCP server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
