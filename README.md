# ChatDock

ChatDock is a guided builder for governed website chatbots, powered by the **TrueFoundry AI Gateway**.

Most chatbot demos look simple: add a widget, connect an LLM, answer questions. Real chatbots fail in less obvious ways — models hit rate limits, providers go down, tools need permissions, guardrails need to run before risky calls, and someone has to figure out exactly where a request broke. ChatDock turns "we need a support chatbot" into a configured, production-ready widget without hand-wiring any of that resilience plumbing yourself: it connects to your existing TrueFoundry tenant, auto-discovers your models, virtual models, MCP servers, guardrails, and rate-limit policies, lets you configure tiered access (Guest / Logged-in / Pro), live-tests the bot against real failure modes with a full request trace, and finally generates ready-to-embed code.

**Demo video:** https://youtu.be/RJMUyunJStk

## How it works

1. **Connect** — paste your TrueFoundry control-plane URL and API key. ChatDock fetches your models, virtual models, MCP servers, guardrails, rate-limit policies, and budgets (the key is used to read inventory and is not stored permanently).
2. **Configure** — map rate-limit policies to Guest / Logged-in / Pro tiers, attach guardrails and MCP servers, and pick a model fallback chain — all pre-filled from your tenant, all editable.
3. **Live test** — chat with the configured bot and watch a full request trace: tier resolution, model routing and fallback, guardrail checks, MCP tool calls, and the streamed answer. Simulate rate limits, primary-model failure, and slow responses to see the fallback chain and guardrails kick in for real.
4. **Publish** — get a self-contained React widget, a Next.js API route that keeps your TrueFoundry key server-side, environment variable snippets, and a ready-made prompt for an AI coding assistant (Claude, Cursor, Codex, ChatGPT) to wire it into your project.

## Repository layout

- `frontend/` — Next.js app: the ChatDock product site and the guided chatbot builder UI
- `backend/` — Express API: TrueFoundry inventory discovery, gateway configuration, and the chat proxy route (model routing through a virtual model, guardrails, MCP tool calls, SSE streaming, and tracing)
- `packages/chatdock-mcp/` — A custom MCP server (Streamable HTTP transport) exposing tiered documentation and integration tools, used to demo MCP Gateway access control end to end

## Running locally

### Frontend

```bash
cd frontend
npm install
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001).

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Runs on `http://localhost:4000` by default — see `.env.example` for configuration (port, allowed CORS origins).

### ChatDock MCP server (optional)

```bash
cd packages/chatdock-mcp
npm install
npm run build && npm start
```

Exposes six tools split across tiers (Guest: docs search and quick start; Logged-in: standard docs search and widget config generation; Pro: expert docs search and integration blueprints) over Streamable HTTP. The deployed backend defaults to a hosted instance of this server, so you only need to run it locally if you want to override `MCP_SERVER_URL`.

## Main routes

- `/` — product overview and demo video
- `/builder` — the guided chatbot configuration builder
- `/demo` — judge-facing demo plan

## Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Express, Node.js
- **MCP server**: TypeScript, `@modelcontextprotocol/sdk`, Streamable HTTP transport
- **AI infrastructure**: TrueFoundry AI Gateway — virtual models with priority-based routing and fallback, rate limits, budgets, guardrails, MCP Gateway, and observability/tracing

## Deployment

- Frontend → Vercel
- Backend → Railway
- ChatDock MCP server → Railway
