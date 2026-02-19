import type { Page, Locator } from "playwright";

export function randomDelay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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
