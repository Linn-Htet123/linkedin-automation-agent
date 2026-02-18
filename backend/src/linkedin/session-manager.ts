/**
 * LinkedIn Session Manager
 *
 * Handles secure browser session persistence for LinkedIn.
 * Instead of logging in every time, we save the browser context
 * (cookies, localStorage, sessionStorage) to disk and reuse it.
 *
 * This avoids triggering LinkedIn's rate-limiting and security alerts.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";

const LINKEDIN_URL = "https://www.linkedin.com";
const SESSION_FILE = path.join(config.SESSION_DIR, "linkedin-session.json");

export class LinkedInSessionManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    /**
     * Initialize the browser with saved session or fresh login.
     * Returns a ready-to-use Page object logged into LinkedIn.
     */
    async initialize(): Promise<Page> {
        console.log("🚀 Initializing LinkedIn browser session...");

        // Ensure session directory exists
        await fs.mkdir(config.SESSION_DIR, { recursive: true });

        // Launch browser
        this.browser = await chromium.launch({
            headless: config.HEADLESS,
            slowMo: config.BROWSER_SLOW_MO,
            args: [
                "--disable-blink-features=AutomationControlled", // Avoid detection
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ],
        });

        // Try to load existing session
        const hasSession = await this.loadSession();

        if (!hasSession) {
            // No saved session — do a fresh login (no need to verify after)
            console.log("📝 No saved session found. Starting fresh login...");
            await this.freshLogin();
        } else {
            // We loaded a saved session — verify it's still valid
            const isLoggedIn = await this.verifyLogin();
            if (!isLoggedIn) {
                console.log("🔄 Session expired. Re-authenticating...");
                await this.freshLogin();
            }
        }

        console.log("✅ LinkedIn session ready!");
        return this.page!;
    }

    /**
     * Load an existing browser session from disk.
     */
    private async loadSession(): Promise<boolean> {
        try {
            const sessionData = await fs.readFile(SESSION_FILE, "utf-8");
            const storageState = JSON.parse(sessionData);

            this.context = await this.browser!.newContext({
                storageState,
                userAgent:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/122.0.0.0 Safari/537.36",
                viewport: { width: 1280, height: 800 },
                locale: "en-US",
            });

            this.page = await this.context.newPage();
            console.log("📂 Loaded saved session from disk.");
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Perform a fresh login to LinkedIn using credentials.
     * Saves the session to disk after successful login.
     */
    private async freshLogin(): Promise<void> {
        // Create a new context if needed
        if (!this.context) {
            this.context = await this.browser!.newContext({
                userAgent:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/122.0.0.0 Safari/537.36",
                viewport: { width: 1280, height: 800 },
                locale: "en-US",
            });
        }

        this.page = await this.context.newPage();

        // Navigate to LinkedIn login
        await this.page.goto(`${LINKEDIN_URL}/login`, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
        });

        // Fill in credentials
        await this.page.fill('input[id="username"]', config.LINKEDIN_EMAIL);
        await this.page.fill('input[id="password"]', config.LINKEDIN_PASSWORD);

        // Click "Sign in"
        await this.page.click('button[type="submit"]');

        // Wait for navigation — LinkedIn may show a CAPTCHA or 2FA challenge
        try {
            await this.page.waitForURL("**/feed/**", { timeout: 30_000 });
            console.log("✅ Login successful!");
        } catch {
            // If we didn't reach the feed, we might need manual intervention
            console.log("⚠️  Login requires manual intervention (CAPTCHA/2FA).");
            console.log("   Complete the challenge in the browser window.");
            console.log("   Waiting up to 120 seconds...");

            await this.page.waitForURL("**/feed/**", { timeout: 120_000 });
            console.log("✅ Login completed after manual intervention!");
        }

        // Save the session
        await this.saveSession();
    }

    /**
     * Save the current browser session (cookies + storage) to disk.
     */
    private async saveSession(): Promise<void> {
        if (!this.context) return;

        const storageState = await this.context.storageState();
        await fs.writeFile(SESSION_FILE, JSON.stringify(storageState, null, 2));
        console.log("💾 Session saved to disk.");
    }

    /**
     * Verify that the current session is still logged in.
     */
    private async verifyLogin(): Promise<boolean> {
        if (!this.page) return false;

        try {
            await this.page.goto(`${LINKEDIN_URL}/feed/`, {
                waitUntil: "domcontentloaded",
                timeout: 30_000,
            });

            // Wait a moment for any redirects to complete
            await this.page.waitForTimeout(2000);

            // Check if we're redirected to login page
            const currentUrl = this.page.url();
            if (currentUrl.includes("/login") || currentUrl.includes("/authwall")) {
                return false;
            }

            // If we're on any LinkedIn page that isn't login, we're good
            if (currentUrl.includes("linkedin.com")) {
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Get the current Page instance.
     */
    getPage(): Page {
        if (!this.page) {
            throw new Error("Session not initialized. Call initialize() first.");
        }
        return this.page;
    }

    /**
     * Get the browser context.
     */
    getContext(): BrowserContext {
        if (!this.context) {
            throw new Error("Session not initialized. Call initialize() first.");
        }
        return this.context;
    }

    /**
     * Close the browser and save session.
     */
    async close(): Promise<void> {
        await this.saveSession();
        await this.browser?.close();
        this.browser = null;
        this.context = null;
        this.page = null;
        console.log("🔒 Browser session closed and saved.");
    }
}

// Singleton instance
export const sessionManager = new LinkedInSessionManager();
