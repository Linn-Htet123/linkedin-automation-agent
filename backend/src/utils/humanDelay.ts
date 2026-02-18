/**
 * Human-like delay utilities for Playwright automation.
 *
 * These helpers make browser interactions look more natural by
 * introducing random delays between actions, typing character-by-character,
 * and moving the mouse before clicking.
 */

import type { Page, Locator } from "playwright";

/**
 * Wait for a random duration between min and max milliseconds.
 */
export function randomDelay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Type text character-by-character with random delays between each keystroke.
 * This mimics human typing patterns.
 *
 * @param page       Playwright page instance
 * @param locator    The locator to type into (must be focused or will be clicked first)
 * @param text       The text to type
 * @param minDelay   Minimum delay between keystrokes (ms), default 50
 * @param maxDelay   Maximum delay between keystrokes (ms), default 150
 */
export async function humanType(
    page: Page,
    locator: Locator,
    text: string,
    minDelay = 50,
    maxDelay = 150,
): Promise<void> {
    // Click to focus the element
    await locator.click({ force: true });
    await randomDelay(200, 400);

    // Type each character with random delay
    for (const char of text) {
        await page.keyboard.type(char, { delay: 0 });
        await randomDelay(minDelay, maxDelay);
    }
}

/**
 * Click a locator with human-like behavior: scroll into view,
 * wait a beat, then click.
 *
 * @param locator    The Playwright locator to click
 */
export async function humanClick(locator: Locator): Promise<void> {
    // Scroll the element into view
    await locator.scrollIntoViewIfNeeded().catch(() => { });

    // Small pause before clicking (simulating visual scan)
    await randomDelay(100, 300);

    // Click with force to bypass any overlays
    await locator.click({ force: true });

    // Small pause after clicking (simulating reaction time)
    await randomDelay(200, 400);
}
