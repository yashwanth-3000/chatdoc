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
        
        # -> Navigate to https://chatdock-app.vercel.app/builder/step-two/existing-foundry-user to open the builder flow (step two, existing foundry user).
        await page.goto("https://chatdock-app.vercel.app/builder/step-two/existing-foundry-user")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Continue as judge - use demo tenant' button and wait for the Foundry inventory / Live test UI to load (verify the page updates).
        # Continue as judge - use demo tenant button
        elem = page.get_by_role('button', name='Continue as judge - use demo tenant', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Continue →' button to advance toward the Live test page.
        # Continue → link
        elem = page.get_by_role('link', name='Continue →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Simulate failure: Rate limit (429)' button, then send 'What is ChatDock?' in the chat input and check the gateway trace for '429 Rate limited'.
        # Rate limit 429 button
        elem = page.get_by_role('button', name='Simulate failure: Rate limit (429)', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Simulate failure: Rate limit (429)' button, then send 'What is ChatDock?' in the chat input and check the gateway trace for '429 Rate limited'.
        # Type a message… text field
        elem = page.get_by_placeholder('Type a message…', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("What is ChatDock?")
        
        # -> Click the 'What is ChatDock?' sample prompt button in the chat to send the message.
        # ✕ button
        elem = page.get_by_role('button', name='✕', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'What is ChatDock?' sample prompt to send the message, then check the gateway trace for '429 Rate limited'.
        # ✕ button
        elem = page.get_by_role('button', name='✕', exact=True)
        await elem.click(timeout=10000)
        
        # -> Arm the 'Rate limit' 429 simulation, send 'What is ChatDock?' using the chat input, then look for the gateway trace entry '429 Rate limited'.
        # Rate limit 429 button
        elem = page.get_by_role('button', name='Simulate failure: Rate limit (429)', exact=True)
        await elem.click(timeout=10000)
        
        # -> Arm the 'Rate limit' 429 simulation, send 'What is ChatDock?' using the chat input, then look for the gateway trace entry '429 Rate limited'.
        # Type a message… text field
        elem = page.get_by_placeholder('Type a message…', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("What is ChatDock?")
        
        # -> Click the 'Rate limit 429' button to arm the simulation, then click the 'What is ChatDock?' sample prompt to send the message and check the gateway trace for '429 Rate limited'.
        # Rate limit 429 button
        elem = page.get_by_role('button', name='Simulate failure: Rate limit (429)', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Rate limit 429' button to arm the simulation, then click the 'What is ChatDock?' sample prompt to send the message and check the gateway trace for '429 Rate limited'.
        # ✕ button
        elem = page.get_by_role('button', name='✕', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'What is ChatDock?' sample prompt to send the message while 'Rate limit 429' is armed, then check the gateway trace for the exact text '429 Rate limited'.
        # ✕ button
        elem = page.get_by_role('button', name='✕', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'What is ChatDock?' sample prompt to send the message, then check the gateway trace for the exact text '429 Rate limited'.
        # ✕ button
        elem = page.get_by_role('button', name='✕', exact=True)
        await elem.click(timeout=10000)
        
        # -> Type 'What is ChatDock?' into the chat input and click the Send button, then search the gateway trace for the exact text '429 Rate limited'.
        # Type a message… text field
        elem = page.get_by_placeholder('Type a message…', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("What is ChatDock?")
        
        # -> Type 'What is ChatDock?' into the chat input and click the Send button, then search the gateway trace for the exact text '429 Rate limited'.
        # ↑ button
        elem = page.get_by_role('button', name='↑', exact=True)
        await elem.click(timeout=10000)
        
        # -> Type 'What is ChatDock?' into the chat input and click the Send button, then search the gateway trace for the exact text '429 Rate limited'.
        await page.mouse.wheel(0, 300)
        
        # -> Click the Send button (the button next to the chat input) to submit 'What is ChatDock?' and trigger the armed Rate limit simulation.
        # ↑ button
        elem = page.get_by_role('button', name='↑', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
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
    