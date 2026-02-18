/**
 * DOM Dump Debug Utilities
 *
 * Provides helpers for saving screenshots and full-page HTML dumps
 * at key points during the automation flow. All output is gated
 * behind the DEBUG=true environment variable so it stays silent
 * in production.
 *
 * Debug files are saved to backend/debug/<label>-<timestamp>.<ext>
 */

import type { Page } from "playwright";
import fs from "fs/promises";
import path from "path";

/** The directory where debug artifacts are saved */
const DEBUG_DIR = path.resolve("debug");

/** Whether debug mode is enabled (reads process.env.DEBUG directly) */
export function isDebugEnabled(): boolean {
    return process.env.DEBUG === "true";
}

/**
 * Save a screenshot + full-page HTML dump.
 *
 * When DEBUG=true:
 *   - Saves  debug/<label>-<timestamp>.png
 *   - Saves  debug/<label>-<timestamp>.html
 *   - Logs which step it's at
 *
 * When DEBUG is not set:
 *   - Does nothing (silent)
 *
 * @param page   Playwright Page instance
 * @param label  A short description of the step (e.g. "after-nav", "before-send")
 * @returns Array of file paths created (empty if debug is off)
 */
export async function dumpDOM(
    page: Page,
    label: string,
): Promise<string[]> {
    if (!isDebugEnabled()) return [];

    const files: string[] = [];
    const ts = Date.now();
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");

    try {
        await fs.mkdir(DEBUG_DIR, { recursive: true });

        // Screenshot
        const screenshotPath = path.join(DEBUG_DIR, `${safeLabel}-${ts}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        files.push(screenshotPath);

        // Full HTML
        const htmlPath = path.join(DEBUG_DIR, `${safeLabel}-${ts}.html`);
        const html = await page.content();
        await fs.writeFile(htmlPath, html, "utf-8");
        files.push(htmlPath);

        console.log(`🔍 [DEBUG] Step "${label}" — dumped ${files.length} files to ${DEBUG_DIR}/`);
    } catch (err) {
        console.log(`⚠️  [DEBUG] Could not dump DOM for "${label}": ${err}`);
    }

    return files;
}

/**
 * Force-save a debug dump regardless of the DEBUG flag.
 * Used on errors — we always want to see what went wrong.
 */
export async function dumpDOMForced(
    page: Page,
    label: string,
): Promise<string[]> {
    const files: string[] = [];
    const ts = Date.now();
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");

    try {
        await fs.mkdir(DEBUG_DIR, { recursive: true });

        const screenshotPath = path.join(DEBUG_DIR, `${safeLabel}-${ts}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        files.push(screenshotPath);

        const htmlPath = path.join(DEBUG_DIR, `${safeLabel}-${ts}.html`);
        const html = await page.content();
        await fs.writeFile(htmlPath, html, "utf-8");
        files.push(htmlPath);

        console.log(`📸 [ERROR DUMP] "${label}" — saved ${files.length} debug files`);
    } catch (err) {
        console.log(`⚠️  Could not save error dump for "${label}": ${err}`);
    }

    return files;
}
