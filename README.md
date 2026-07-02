# ChatDock

**A guided builder for governed website chatbots, powered by the [TrueFoundry AI Gateway](https://www.truefoundry.com/).**

| | |
|---|---|
| 🌐 **Live app** | https://chatdock-app.vercel.app |
| ⚙️ **Backend health** | https://chat-dock-backend-production.up.railway.app/api/health |
| 🎥 **Demo video** | https://youtu.be/RJMUyunJStk |
| 🧪 **Built for** | TestSprite Hackathon S3 - see [the loop section](#-the-testsprite-loop-how-this-app-was-hardened) |

> 🧑‍⚖️ **Judges & evaluators:** you don't need a TrueFoundry account - use the built-in **demo tenant** ([one-click instructions below](#-for-judges--evaluators-no-truefoundry-account-needed)).

---

## The problem

Most chatbot demos look simple: add a widget, connect an LLM, answer questions. Real chatbots fail in less obvious ways - models hit rate limits, providers go down, tools need permissions, guardrails have to run *before* risky calls, and someone has to figure out exactly where a request broke.

ChatDock turns *"we need a support chatbot"* into a configured, production-ready widget **without hand-wiring any of that resilience plumbing yourself**. It connects to your existing TrueFoundry tenant, auto-discovers your models, virtual models, MCP servers, guardrails, and rate-limit policies, lets you configure tiered access (Guest / Logged-in / Pro), live-tests the bot against real failure modes with a full request trace, and finally generates ready-to-embed code.

## How it works

1. **Connect** - provide a TrueFoundry control-plane URL and API key (or use judge mode). ChatDock fetches your models, virtual models, MCP servers, guardrails, rate-limit policies, and budgets. The key is used only to read inventory and is not stored permanently.
2. **Configure** - map rate-limit policies to Guest / Logged-in / Pro tiers, attach guardrails and MCP servers, and pick a model fallback chain - all pre-filled from your tenant, all editable.
3. **Live test** - chat with the configured bot and watch a full request trace: tier resolution, model routing and fallback, guardrail checks, MCP tool calls, and the streamed answer. Use the **Simulate failure** controls to inject a 429 rate limit, a 503 provider outage, or a slow timeout and watch the fallback chain recover in the trace.
4. **Publish** - get a self-contained React widget, a Next.js API route that keeps your TrueFoundry key server-side, environment-variable snippets, and a ready-made prompt for an AI coding assistant (Claude, Cursor, Codex, ChatGPT) to wire it into your project.

## 🧑‍⚖️ For judges & evaluators (no TrueFoundry account needed)

You do **not** need your own TrueFoundry tenant to evaluate ChatDock end to end:

1. Open the **[gateway connect step](https://chatdock-app.vercel.app/builder/step-two/existing-foundry-user)**.
2. Below the credentials form, click **"Continue as judge - use demo tenant"**.
3. ChatDock connects using its own TrueFoundry service account and loads the full inventory (models, MCP servers, guardrails, rate-limit policies). Configure tiers, run the live test, simulate failures, and publish - exactly as a real user would.

The floating assistant in the bottom-right of the **[demo page](https://chatdock-app.vercel.app/demo)** is not a mock - it is the builder's own output widget, answering live through the gateway.

## Architecture

Four protocol boundaries keep the agent legible under failure:

- **React widget (client)** - self-contained component; streams tokens over SSE, renders markdown, preserves conversation state across fallback events. No gateway secrets ever reach the browser.
- **Express API (proxy)** - keeps the TrueFoundry key server-side, forwards through the AI Gateway using the OpenAI-compatible client, injects MCP auth, and streams `delta` / `trace` / `done` / `error` SSE events back to the widget.
- **TrueFoundry AI Gateway** - model routing, fallback chains, per-tier rate limits, and budgets live in gateway policy, not application code.
- **MCP Gateway + guardrails** - a Railway-hosted MCP server exposes tiered tools over HTTP JSON-RPC 2.0; `content-moderation` and `sql-sanitizer` guardrails run at input, tool-argument, and output phases.

---

## 🧪 The TestSprite loop: how this app was hardened

This repository is not just an app - it is a record of an **autonomous test-fix loop** run against the live deployment with [TestSprite](https://www.testsprite.com/). Every fix below was driven by a real test failure against the production URL, not written from imagination.

### The loop

```
 +----------------------------------------------------------+
 |                                                          |
 v                                                          |
 [1] WRITE     Agent ships a change and deploys it          |
  |                                                         |
  v                                                         |
 [2] VERIFY    TestSprite runs the plan on the LIVE         |
               site: real pass/fail verdict + evidence      |
  |                                                         |
  v                                                         |
 [3] FIX       Agent reads the failure bundle and           |
               ships a fix for the root cause               |
  |                                                         |
  v                                                         |
 [4] VERIFY    a passing re-run closes the loop;            |
 +--- AGAIN     every result is appended to LOOP.md         +
```

### Where to look

| Artifact | What it is |
|---|---|
| **[`LOOP.md`](LOOP.md)** | The agent-written loop log - one line per iteration: *who ran it · what test ran · the verdict · what was fixed.* 26 iterations and counting. |
| **[`testsprite-plans/`](testsprite-plans/)** | The 14 human-readable test plans (JSON), each a sequence of `action` and `assertion` steps run against the live site. |
| **[`.testsprite/`](.testsprite/)** | Failure bundles for every failed run - per-step evidence, HTML snapshots, the generated test code, and a **video recording** of the browser session. |
| **[`.github/workflows/testsprite.yml`](.github/workflows/testsprite.yml)** | CI/CD integration (see below). |

### What TestSprite is asked to test (14 plans)

| # | Area | What it verifies |
|---|---|---|
| 01–02 | Homepage | Hero, CTAs, and navigation into the builder |
| 03–04 | Builder start | The 4-step wizard and continue navigation |
| 05–06 | Widget designer | Config sections, live preview, name reactivity |
| 07–08 | Publish page | Install/config sections, copy buttons, collapsible code |
| 09 | Demo page | Content and the floating assistant launcher |
| 10 | **Judge mode** | Connect via demo tenant with no credentials |
| 11 | **Live gateway chat** | The demo widget returns a real streamed model response |
| 12 | **Tier simulation** | Full journey: connect → configure → live test → switch Guest→Pro |
| 13 | **Guardrails** | An unsafe prompt is blocked/refused, then the chat recovers |
| 14 | **Resilience / fallback** | Inject a 429 and verify the gateway's fallback trace recovers |

### Real bugs the loop caught, fixed, and re-verified

Each of these is a documented **FAIL → FIX → PASS** arc in [`LOOP.md`](LOOP.md), with the failure bundle committed under `.testsprite/`:

| TestSprite caught | Root cause | Fix |
|---|---|---|
| **Public URL behind a Vercel login wall** *(would block judges entirely)* | A manual deploy from the repo root shipped to the wrong Vercel project (deployment protection on) and re-aliased the public URL to it | Redeployed from the correct project and re-pinned the alias |
| **Production called a dead backend** *(live chat silently broken for weeks)* | `NEXT_PUBLIC_CHATDOCK_BACKEND_URL` pointed at a deleted Railway app | Repointed to the current backend and redeployed |
| **Resilience story couldn't be triggered** ("No matches found for 429") | The live-test UI hardcoded `chaosMode = null`, so the backend's failure-simulation support was unreachable | Added the **Simulate failure** panel (rate limit / provider down / timeout) wired to the gateway fallback trace |
| Demo page promised a live widget that wasn't there | The page's copy described a widget that was never rendered | Mounted the builder's own widget as a floating assistant on `/demo` (found the dead-backend bug while wiring this) |
| "Continue" CTA not visible after scroll | The only CTA lived at the top of the builder page and scrolled out of view | Added a persistent "Start building" CTA at the bottom of the workflow list |

The loop also hardened its own tooling: it caught a CI "success" that was actually a masked `VALIDATION_ERROR`, and root-caused recurring "blocked" verdicts to a rotating hero headline that defeats DOM text assertions - after which the CI verdict was reclassified from per-test status instead of a blunt exit code.

### CI/CD integration (+ the loop runs itself)

[`.github/workflows/testsprite.yml`](.github/workflows/testsprite.yml) wires the loop into GitHub Actions. On every push to `main`:

1. Deploy the frontend to Vercel and pin the production alias.
2. Wait for the live URL to respond.
3. Re-run the **entire** TestSprite suite against the production URL.
4. Classify the verdict from per-test statuses (a "blocked" run whose steps all passed is an environment quirk, not an app failure).
5. Download failure bundles for any failed run into `.testsprite/`, append a verdict line to `LOOP.md`, and commit both back.

This makes the loop self-sustaining: the evidence trail and the log maintain themselves on every commit.

### Run the loop yourself

```bash
# Prerequisite: TestSprite CLI (Node >= 20) + an API key
npm install -g @testsprite/testsprite-cli
export TESTSPRITE_API_KEY=sk-...

# Run one plan against the live site
testsprite test create --plan-from testsprite-plans/14-resilience-fallback-simulation.json --run --wait

# Re-run every saved test (what CI does)
testsprite test rerun --all --project <project-id> --wait
```

---

## Repository layout

```
frontend/            Next.js app - product site + guided builder UI
backend/             Express API - inventory discovery, gateway config,
                     chat proxy (routing, fallback, guardrails, MCP, SSE, tracing),
                     and judge/demo-mode credential handling
packages/chatdock-mcp/   Custom MCP server (Streamable HTTP) - tiered docs & tools
testsprite-plans/    14 TestSprite test plans (JSON)
.testsprite/         Failure bundles: evidence, snapshots, videos
LOOP.md              Agent-written loop log (one line per iteration)
.github/workflows/   CI: deploy → test → log → commit
```

## Running locally

### Frontend

```bash
cd frontend
npm install
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001). To point at a local backend, set `NEXT_PUBLIC_CHATDOCK_BACKEND_URL=http://localhost:4000`.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Runs on `http://localhost:4000`. See `.env.example` for configuration (port, CORS origins). Judge/demo mode is enabled by setting `TFY_DEMO_API_KEY`, `TFY_DEMO_CONTROL_PLANE_URL`, `TFY_DEMO_GATEWAY_BASE_URL`, and `TFY_DEMO_MODEL_ID`.

### ChatDock MCP server (optional)

```bash
cd packages/chatdock-mcp
npm install
npm run build && npm start
```

Exposes six tools split across tiers (Guest: docs search and quick start; Logged-in: standard docs search and widget config generation; Pro: expert docs search and integration blueprints) over Streamable HTTP. The deployed backend defaults to a hosted instance, so run this locally only to override `MCP_SERVER_URL`.

## Main routes

- `/` - product overview and demo video
- `/builder` - the guided chatbot configuration builder (connect → design → live test → publish)
- `/demo` - judge-facing walkthrough with the live floating assistant

## Stack

- **Frontend** - Next.js, React, TypeScript (Vercel)
- **Backend** - Express, Node.js (Railway)
- **MCP server** - TypeScript, `@modelcontextprotocol/sdk`, Streamable HTTP transport (Railway)
- **AI infrastructure** - TrueFoundry AI Gateway: virtual models with priority-based routing and fallback, rate limits, budgets, guardrails, MCP Gateway, and observability/tracing
- **Testing / loop** - TestSprite CLI + GitHub Actions

## Deployment

| Component | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://chatdock-app.vercel.app |
| Backend | Railway | https://chat-dock-backend-production.up.railway.app |
| MCP server | Railway | `chatdock-mcp-production.up.railway.app` |
