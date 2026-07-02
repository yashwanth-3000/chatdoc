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
        
        # -> Navigate to the 'Builder' page (open /builder) and verify the required texts and the 'Continue' link.
        await page.goto("https://chatdock-app.vercel.app/builder")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Continue' button (visible text 'Continue') and verify the page navigates to /builder/step-one.
        # Continue link
        elem = page.get_by_role('link', name='Continue', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> A link with the text 'Continue' is visible and points to /builder/step-one
        await page.locator("xpath=/html/body/div[2]/main/div/section[1]/div[3]/a[2]").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Continue' link is visible on the page.
        await expect(page.locator("xpath=/html/body/div[2]/main/div/section[1]/div[3]/a[2]").nth(0)).to_be_visible(timeout=15000), "The 'Continue' link is visible on the page."
        # Assert: The current URL contains /builder/step-one, confirming the link leads to that page.
        await expect(page).to_have_url(re.compile("/builder/step\\-one"), timeout=15000), "The current URL contains /builder/step-one, confirming the link leads to that page."
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
    