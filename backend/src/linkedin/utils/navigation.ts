/**
 * Navigation Utilities
 *
 * Handles page navigation and overlay dismissal.
 */

import type { Page } from "playwright";

export async function clearSearchOverlay(page: Page): Promise<void> {
    try {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        await page.evaluate(() => {
            (document.activeElement as HTMLElement)?.blur();
            document.querySelectorAll<HTMLElement>(
                ".search-global-typeahead__overlay, .search-global-typeahead-hit"
            ).forEach((el) => {
                el.style.display = "none";
                el.style.pointerEvents = "none";
            });
        });
    } catch {
        // Ignore
    }
}

export async function dismissOverlays(page: Page): Promise<void> {
    await clearSearchOverlay(page);
    const dismissPatterns = [/dismiss/i, /close/i, /got it/i, /not now/i, /skip/i];
    for (const pattern of dismissPatterns) {
        try {
            const btn = page.getByRole("button", { name: pattern });
            if (await btn.first().isVisible({ timeout: 500 }).catch(() => false)) {
                await btn.first().click({ force: true });
                await page.waitForTimeout(500);
            }
        } catch {
            // Not present
        }
    }
}

export async function navigateToMessaging(page: Page): Promise<void> {
    console.log("Navigating to LinkedIn Messaging...");
    await page.goto("https://www.linkedin.com/messaging/", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
    });
    await page.waitForTimeout(2000);
    await clearSearchOverlay(page);
    await dismissOverlays(page);
    try {
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
    } catch {
        // Networkidle can hang — continue anyway
    }
    await clearSearchOverlay(page);
    console.log(`URL: ${page.url()}`);
    console.log("Messaging page loaded.");
}
