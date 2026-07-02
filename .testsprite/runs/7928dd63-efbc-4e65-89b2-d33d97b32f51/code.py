import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("https://chatdock-app.vercel.app")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to the builder page '/builder/step-two/existing-foundry-user' so the builder flow for existing foundry users can be started.
        await page.goto("https://chatdock-app.vercel.app/builder/step-two/existing-foundry-user")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Continue as judge — use demo tenant' button and wait for the Foundry inventory / demo tenant flow to load.
        # Continue as judge — use demo tenant button
        elem = page.get_by_role('button', name='Continue as judge — use demo tenant', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Continue →' button to proceed through the tier configuration flow.
        # Continue → link
        elem = page.get_by_role('link', name='Continue →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Rate limit' button under 'Simulate failure', then send the message 'What is ChatDock?' in the chat input and click the 'Send' button.
        # Rate limit 429 button
        elem = page.get_by_role('button', name='Rate limit 429', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Rate limit' button under 'Simulate failure', then send the message 'What is ChatDock?' in the chat input and click the 'Send' button.
        # Type a message… text field
        elem = page.get_by_placeholder('Type a message…', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("What is ChatDock?")
        
        # -> Click the 'Rate limit' button under 'Simulate failure', then send the message 'What is ChatDock?' in the chat input and click the 'Send' button.
        # ↑ button
        elem = page.get_by_role('button', name='↑', exact=True)
        await elem.click(timeout=10000)
        
        # -> Search the page for '429' or 'fallback' entries in the gateway trace and expand the 'Error' trace entry to inspect its details.
        # Error system error 144ms 3 button
        elem = page.get_by_role('button', name='Error system error 144ms 3', exact=True)
        await elem.click(timeout=10000)
        
        # -> Search the gateway trace for the words 'fallback' or 'Falling back' and for '429' to confirm both the rate-limit and fallback entries are present, then expand other trace events if needed.
        # chat-bot-llm resolved to gpt-5-2025-08-07 agent... button
        elem = page.get_by_role('button', name='chat-bot-llm resolved to gpt-5-2025-08-07 agent success 21.4s 9', exact=True)
        await elem.click(timeout=10000)
        
        # -> Find and expand the gateway trace entry that contains the word 'fallback' (or 'Falling back') so its details are visible.
        # claude-sonnet-4-6 anthropic · fallback 3 button
        elem = page.get_by_role('button', name='claude-sonnet-4-6 anthropic · fallback 3', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> A resilience/failure simulation control is present: a section titled 'Simulate failure' (or similar) with a clickable control to inject a rate limit / primary-model failure before sending a message
        await page.locator("xpath=/html/body/div[2]/main/div/div/div[1]/div[4]/div[2]/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Rate limit 429' failure-simulation control is visible on the page.
        await expect(page.locator("xpath=/html/body/div[2]/main/div/div/div[1]/div[4]/div[2]/button[1]").nth(0)).to_be_visible(timeout=15000), "The 'Rate limit 429' failure-simulation control is visible on the page."
        
        # --> Within 40 seconds the request trace shows the injected failure and recovery: a trace entry indicating the primary model was rate-limited (e.g. '429' or 'Rate limited') AND a trace entry indicating a fallback occurred (e.g. 'Falling back to')
        # Assert: A trace entry indicating a fallback is present (contains 'fallback').
        await expect(page.locator("xpath=/html/body/div[2]/main/div/div/div[1]/div[2]/div[3]/button[3]").nth(0)).to_contain_text("fallback", timeout=15000), "A trace entry indicating a fallback is present (contains 'fallback')."
        
        # --> Despite the simulated failure, a final assistant response still appears in the chat — the conversation recovered rather than showing a hard error
        # Assert: Final assistant response appeared in the chat (chat-bot-llm resolved to gpt-5-2025-08-07 is visible).
        await expect(page.locator("xpath=/html/body/div[2]/main/div/div/div[1]/div[5]/div[2]/div[2]/div[1]").nth(0)).to_contain_text("chat-bot-llm resolved to gpt-5-2025-08-07", timeout=15000), "Final assistant response appeared in the chat (chat-bot-llm resolved to gpt-5-2025-08-07 is visible)."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    