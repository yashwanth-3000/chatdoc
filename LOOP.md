# ChatDock — TestSprite Hackathon S3 Loop Log

> Agent: Claude Code | App: https://chatdock-app.vercel.app | Repo: https://github.com/yashwanth-3000/chatdoc

| Timestamp (UTC) | Maker | What ran | Verdict |
|---|---|---|---|
| 2026-07-01 16:25 UTC | Claude Code | Homepage hero loads — ChatDock heading, "Configure a bot", "View demo" CTAs, lead paragraph | PASS (HTML-verified) |
| 2026-07-01 16:34 UTC | Claude Code | Publish page — "Install the OpenAI SDK", "Your gateway configuration", "Copy for Claude", "Copy for ChatGPT", "One-click implementation" all present | PASS |
| 2026-07-01 16:37 UTC | Claude Code | Builder start — 4 workflow steps present (8/9 pass); FAIL: "Continue" link not visible after scroll — CTA only exists at page top, scrolls out of view | FAIL |
| 2026-07-01 16:38 UTC | Claude Code | Fix: added "Start building" CTA at bottom of workflow list so primary action is reachable without scrolling back up | FIX |
| 2026-07-01 16:39 UTC | Claude Code | ci: fix workflow — use env vars for secret availability checks [skip ci] | FAIL |
| 2026-07-02 07:50 UTC | Claude Code | CI audit — the 17s "success" run was a false positive: `test create` had no plan, instant VALIDATION_ERROR hidden by `\|\| true`. Replaced with `test rerun --all`, verdict now from exit code | FIX |
| 2026-07-02 07:54 UTC | Claude Code | Rerun builder start after CTA fix deployed — all 9 steps pass, including the previously failing "Continue link visible" step | PASS (9/9) |
| 2026-07-02 07:55 UTC | Claude Code | Homepage → "Configure a bot" navigates to /builder; URL and "A clean path from draft to embed." heading verified | PASS (2/2) |
| 2026-07-02 07:58 UTC | Claude Code | Widget designer — config sections and live preview all visible | PASS (2/2) |
| 2026-07-02 07:58 UTC | Claude Code | Widget designer — typing a new assistant name updates the live preview in real time | PASS (4/4) |
| 2026-07-02 07:58 UTC | Claude Code | Builder start — "Continue" navigates to widget designer, full flow verified end-to-end | PASS (7/7) |
| 2026-07-02 08:00 UTC | Claude Code | Demo page — hero and content load (4/6) but FAIL: no floating chat launcher anywhere on the page, despite the page claiming "the chat widget running on the ChatDock website is the exact output of the builder flow" | FAIL |
| 2026-07-02 08:10 UTC | Claude Code | Fix: mounted the builder-produced MiniWidget as a floating SiteAssistant on /demo (new defaultOpen prop, click-through fixed overlay). Bonus catch while wiring it: production NEXT_PUBLIC_CHATDOCK_BACKEND_URL pointed at a dead Railway app — replaced with the freshly deployed chat-dock-backend | FIX |
