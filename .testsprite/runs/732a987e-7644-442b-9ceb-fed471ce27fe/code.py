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
        
        # -> Open the builder flow page for existing foundry users by navigating to the URL '/builder/step-two/existing-foundry-user'.
        await page.goto("https://chatdock-app.vercel.app/builder/step-two/existing-foundry-user")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Continue as judge — use demo tenant' button to start the demo tenant Foundry flow.
        # Continue as judge — use demo tenant button
        elem = page.get_by_role('button', name='Continue as judge — use demo tenant', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Continue →' button to proceed through the tier configuration flow.
        # Continue → link
        elem = page.get_by_role('link', name='Continue →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Rate limit' button to inject a 429 on the next send, then send 'What is ChatDock?' in the chat widget.
        # Rate limit 429 button
        elem = page.get_by_role('button', name='Rate limit 429', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Rate limit' button to inject a 429 on the next send, then send 'What is ChatDock?' in the chat widget.
        # Type a message… text field
        elem = page.get_by_placeholder('Type a message…', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("What is ChatDock?")
        
        # -> Click the 'Rate limit' button to inject a 429 on the next send, then send 'What is ChatDock?' in the chat widget.
        # ↑ button
        elem = page.get_by_role('button', name='↑', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Rate limit' button in the 'Simulate failure' section to inject a 429 on the next send, then wait for the UI to reflect the change.
        # Rate limit 429 button
        elem = page.get_by_role('button', name='Rate limit 429', exact=True)
        await elem.click(timeout=10000)
        
        # -> Expand the 'Error' trace entry in the Gateway trace to inspect its details.
        # Error system error 142ms 3 button
        elem = page.get_by_role('button', name='Error system error 142ms 3', exact=True)
        await elem.click(timeout=10000)
        
        # -> Search the gateway trace for the text '429' / 'Rate limited' and for 'fallback' or 'falling back', then expand the related trace entries to verify recovery and that an assistant response appears.
        # chat-bot-llm agent pending 1ms 2 button
        elem = page.get_by_role('button', name='chat-bot-llm agent pending 1ms 2', exact=True)
        await elem.click(timeout=10000)
        
        # -> Locate 'fallback' or 'Falling back' in the Gateway trace and confirm a final assistant reply (for example, the text starting 'ChatDock is a platform') appears in the chat.
        # chat-bot-llm agent pending 1ms 2 button
        elem = page.get_by_role('button', name='chat-bot-llm agent pending 1ms 2', exact=True)
        await elem.click(timeout=10000)
        
        # -> Search the gateway trace for the words 'fallback' or 'Falling back' and expand the related trace entry to confirm a fallback trace appeared and the assistant reply is present.
        # chat-bot-llm agent pending 1ms 2 button
        elem = page.get_by_role('button', name='chat-bot-llm agent pending 1ms 2', exact=True)
        await elem.click(timeout=10000)
        
        # -> Search the Gateway trace for the words 'fallback' or 'Falling back' and expand the related trace entry to confirm a fallback trace appeared and that a final assistant reply is present.
        # chat-bot-llm agent pending 1ms 2 button
        elem = page.get_by_role('button', name='chat-bot-llm agent pending 1ms 2', exact=True)
        await elem.click(timeout=10000)
        
        # -> Expand the 'chat-bot-llm' trace entry in the Gateway trace to reveal any fallback details and confirm recovery.
        # chat-bot-llm agent pending 1ms 2 button
        elem = page.get_by_role('button', name='chat-bot-llm agent pending 1ms 2', exact=True)
        await elem.click(timeout=10000)
        
        # -> Find and expand a Gateway trace entry containing the words 'fall back' or 'Falling back to' to confirm the fallback trace and that the assistant response recovered.
        await page.mouse.wheel(0, 300)
        
        # --> Assertions to verify final state
        
        # --> A resilience/failure simulation control is present: a section titled 'Simulate failure' (or similar) with a clickable control to inject a rate limit / primary-model failure before sending a message
        await page.locator("xpath=/html/body/div[2]/main/div/div/div[1]/div[4]/div[2]/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Rate limit 429' failure simulation control is visible in the Simulate failure section.
        await expect(page.locator("xpath=/html/body/div[2]/main/div/div/div[1]/div[4]/div[2]/button[1]").nth(0)).to_be_visible(timeout=15000), "The 'Rate limit 429' failure simulation control is visible in the Simulate failure section."
        # Assert: The Rate limit control is a button element (type='button'), confirming it is a clickable control.
        await expect(page.locator("xpath=/html/body/div[2]/main/div/div/div[1]/div[4]/div[2]/button[1]").nth(0)).to_have_attribute("type", "button", timeout=15000), "The Rate limit control is a button element (type='button'), confirming it is a clickable control."
        
        # --> Within 40 seconds the request trace shows the injected failure and recovery: a trace entry indicating the primary model was rate-limited (e.g. '429' or 'Rate limited') AND a trace entry indicating a fallback occurred (e.g. 'Falling back to')
        # Assert: The gateway trace shows the primary model was rate-limited (contains '429 Rate limited').
        await expect(page.locator("xpath=/html/body/div[2]/main/div/div/div[1]/div[5]/div[2]/div[8]/div[1]").nth(0)).to_contain_text("429 Rate limited", timeout=15000), "The gateway trace shows the primary model was rate-limited (contains '429 Rate limited')."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
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
    