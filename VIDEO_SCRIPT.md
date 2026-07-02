# ChatDock 4-Minute Hackathon Demo Script

Target length: 4 minutes  
Demo angle: Use ChatDock to create the ChatDock website assistant itself.  
Tone: Clear, practical, judge-facing. Do not claim ChatDock fully deploys or hosts the chatbot. It designs, configures, live-tests, and generates code plus prompts for integration.

## Recording Setup

Run the app locally before recording:

```bash
cd backend
npm run dev
```

```bash
cd frontend
NEXT_PUBLIC_CHATDOCK_BACKEND_URL=http://localhost:4000 npm run dev -- -p 3001
```

Open:

```text
http://localhost:3001
```

Optional MCP server note: the backend currently defaults to the deployed ChatDock MCP server. Only run the local MCP package if you want to override `MCP_SERVER_URL`.

## Core Message

ChatDock is a governed chatbot builder for websites. It helps a normal team go from "I need a support chatbot" to a configured React widget and backend route, without manually wiring model fallback, rate limits, MCP tool permissions, guardrails, and trace logging from scratch.

The hackathon page frames the challenge around agents that keep working when providers slow down, rate limits hit, tools fail, or model calls break. Judges care about AI Gateway setup, MCP Gateway usage, guardrails, resilience, usefulness, and demo clarity. This script is shaped to hit those points directly.

The demo should prove three things:

1. ChatDock makes the chatbot-building workflow approachable.
2. TrueFoundry remains the control plane for resilience, rate limits, guardrails, MCP access, and observability.
3. The final output is usable code that can be copied into Codex, Claude, Cursor, or a Next.js project.

## Timed Script

### 0:00-0:25 - Hook and Problem

Show: Home page, then click `Configure a bot`.

Voiceover:

"Most chatbot demos look simple: add a widget, connect an LLM, answer questions. But real chatbots fail in less obvious ways. Models hit rate limits. Providers go down. Tools need permissions. Guardrails need to run before risky calls. And someone has to debug exactly where the failure happened.

For a normal founder, student, or product team, that is a lot of infrastructure. ChatDock is our answer: design the assistant, connect TrueFoundry, test resilience, and export the code."

### 0:25-0:55 - What We Built

Show: Builder flow, Step 1 widget designer. Change assistant name to `ChatDock Assistant`, update color/theme briefly.

Voiceover:

"In this demo we are building a chatbot for ChatDock using ChatDock itself. Step one is the visible experience. We choose the assistant name, greeting, colors, panel size, animation, and surface style, then preview the widget live. Teams should not need to edit CSS just to ship a chatbot that matches their site."

### 0:55-1:35 - TrueFoundry Connection and Auto Configuration

Show: Step 2 existing TrueFoundry user flow. Enter or show Control Plane URL, API key field, gateway URL, then fetch inventory. If using saved data, say "for recording, this is a saved inventory snapshot."

Voiceover:

"Step two connects an existing TrueFoundry setup. We paste the control plane URL and API key. The backend uses the key to fetch inventory and does not permanently store it; for live test, the browser session keeps it temporarily so we do not re-enter it. ChatDock shows the models, virtual model routes, MCP servers, guardrails, rate-limit policies, budgets, ledgers, and workspace resources it can see.

Then ChatDock pre-fills a practical tier configuration. It maps rate-limit policies to guest, logged-in, and pro tiers, pulls available guardrails and MCP servers into the editor, and still lets the user change anything."

### 1:35-2:15 - Per-Tier Policies and MCP Server

Show: Tier cards for Guest, Logged-in, Pro. Show model, rate limit, guardrails, MCP tools.

Voiceover:

"This is the governance layer. Guest users can stay on a lower-cost route with stricter limits. Logged-in users get more capability. Pro users can get deeper tools and higher limits. The key point is that these policies are not scattered across frontend code. TrueFoundry stays the control plane, and ChatDock carries the selected tier configuration into the generated code.

For testing, we also built our own ChatDock MCP server. It exposes tools for quick start, docs search, widget config generation, and integration blueprints. Some tools are public, some require a valid TrueFoundry key, and pro-only tools verify the tier before returning deeper implementation details."

### 2:15-3:15 - Live Test and Resilience

Show: Step 3 Live Test. Click Guest tier, send: `What is ChatDock and how do I embed it on my site?` Then switch to Logged-in or Pro and send one MCP-heavy prompt from sample prompts. Open the trace cards.

Voiceover:

"Now we live-test before publishing. I start as a guest and ask what ChatDock is. The right side is the widget preview. The left side is the trace: request received, tier resolved, model route selected, guardrails active, MCP tools available, tool results, and final streamed answer.

Now I switch to a higher tier. The same chatbot has access to more MCP tools. When I ask a deeper implementation question, the trace shows the model requesting a tool, the backend injecting auth server-side, and the MCP server returning product context. The browser never receives the TrueFoundry key.

This is also where we test failure modes. The live test supports chaos demos for rate limits, primary model failure, and slow responses. When a 429 or provider failure is simulated, the trace shows the failure and gateway fallback path. If a guardrail blocks unsafe input, the trace shows the guardrail event and the model never receives that prompt. Judges can see what failed, where it failed, and how it was handled."

### 3:15-3:45 - Publish and Code Output

Show: Step 4 Publish. Scroll through gateway summary, `ChatDockWidget.tsx`, `app/api/chat/route.ts`, env snippet. Show "Copy for ChatGPT" or "Copy for Claude" buttons.

Voiceover:

"Once the chatbot passes live test, ChatDock generates the integration: a self-contained React widget, a Next.js API route that keeps the TrueFoundry key server-side, environment variables, and a layout snippet. It also creates a full prompt for an AI coding assistant, so I can copy this into Codex, Claude, Cursor, or ChatGPT and add the chatbot to a project.

ChatDock is not replacing TrueFoundry. TrueFoundry remains the gateway and governance layer. ChatDock makes those controls understandable, testable, and easy to embed."

### 3:45-4:00 - Close

Show: Return to the live widget or final publish screen.

Voiceover:

"The hackathon challenge is resilient agents: agents that keep working when infrastructure fails, rate limits hit, tools break, or outputs need guardrails. ChatDock turns that into a builder workflow for website chatbots. In four steps, a team can design the assistant, connect TrueFoundry, test tiered tools and failure behavior, and ship the code with confidence."

## Must-Show Demo Beats

Use these in the recording even if the exact narration changes:

1. `Configure a bot` from the home page.
2. Widget design changing live.
3. TrueFoundry inventory connection or saved inventory.
4. Guest, logged-in, and pro tier configuration.
5. Mention the custom `chatdock-mcp` server built for testing.
6. Live test with trace cards.
7. One tool-backed question.
8. One resilience or guardrail test.
9. Publish page code output.
10. Copy prompt/code for Codex, Claude, Cursor, or ChatGPT.

Recommended live-test prompts:

- Guest: `What is ChatDock and how do I embed it on my site?`
- Logged-in: `Generate a purple chatbot config called Aria with a pop animation and a glass surface`
- Pro: `How does ChatDock's SSE event streaming protocol work under the hood?`
- Guardrail: use one of the blocked prompts from the Guardrails tab instead of improvising on camera.

## Safe Claims

Use these phrases:

- "ChatDock connects to an existing TrueFoundry setup."
- "ChatDock fetches inventory and pre-fills a recommended tier configuration."
- "The backend keeps gateway credentials server-side."
- "The live test shows trace events for routing, tools, guardrails, and errors."
- "The publish step generates a React widget, a Next.js API route, env snippets, and AI-assistant prompts."
- "For testing, we built a ChatDock MCP server with tiered documentation and integration tools."

Avoid these phrases:

- "ChatDock deploys the production chatbot automatically."
- "ChatDock guarantees no downtime."
- "ChatDock replaces TrueFoundry."
- "All guardrail behavior is invented inside ChatDock."
- "Any user can access every MCP tool."

## Backup Short Version

"ChatDock is a chatbot maker for teams that want a website assistant without hand-building all the reliability infrastructure. We use TrueFoundry as the gateway layer for model routing, fallback, rate limits, budgets, guardrails, MCP access, and observability. ChatDock sits above that as the builder: design the widget, connect your TrueFoundry tenant, auto-load models and policies, configure guest/logged-in/pro tiers, live-test the chatbot against failure modes, and export the React widget plus backend route.

For this demo, we use ChatDock to build ChatDock's own assistant. We also created a custom ChatDock MCP server so the judges can see scoped tools in action: guests get basic docs, logged-in users get richer config generation, and pro users get deeper integration blueprints. The trace panel shows exactly what happened on each request: tier resolution, model route, MCP tool call, guardrail check, fallback, and final streamed answer. The final publish step gives copy-paste code and prompts for Codex or other coding assistants."
