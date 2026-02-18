/**
 * Profile Actions
 *
 * Handles searching for LinkedIn profiles.
 */

import { sessionManager } from "../session-manager.js";
import { clearSearchOverlay } from "../utils/navigation.js";
import { dumpDOM, dumpDOMForced } from "../../utils/domDump.js";

export async function searchProfile(
    name: string,
): Promise<{ success: boolean; profileUrl?: string; error?: string; step?: string }> {
    const page = sessionManager.getPage();
    let currentStep = "init";

    try {
        currentStep = "navigate-to-search";
        await page.goto(
            `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`,
            { waitUntil: "domcontentloaded", timeout: 20_000 },
        );
        await page.waitForTimeout(3000);
        await clearSearchOverlay(page);
        await dumpDOM(page, "search-results");

        currentStep = "find-result";
        const resultLink = page.getByRole("link", { name: new RegExp(name, "i") }).first();
        if (await resultLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            const href = await resultLink.getAttribute("href");
            return {
                success: true,
                profileUrl: href ? `https://www.linkedin.com${href}` : undefined,
            };
        }

        const anyLink = page.locator(`a:has-text("${name}")`).first();
        if (await anyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            const href = await anyLink.getAttribute("href");
            return {
                success: true,
                profileUrl: href
                    ? (href.startsWith("http") ? href : `https://www.linkedin.com${href}`)
                    : undefined,
            };
        }

        return { success: false, error: `No profile found for "${name}"`, step: currentStep };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await dumpDOMForced(page, `search-error-${currentStep}`);
        return { success: false, error: errorMessage, step: currentStep };
    }
}
