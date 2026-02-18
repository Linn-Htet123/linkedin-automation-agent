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

    async initialize(): Promise<Page> {
        console.log("Initializing LinkedIn browser session...");

        await fs.mkdir(config.SESSION_DIR, { recursive: true });

        this.browser = await chromium.launch({
            headless: config.HEADLESS,
            slowMo: config.BROWSER_SLOW_MO,
            args: [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ],
        });

        const hasSession = await this.loadSession();

        if (!hasSession) {
            console.log("No saved session found. Starting fresh login...");
            await this.freshLogin();
        } else {
            const isLoggedIn = await this.verifyLogin();
            if (!isLoggedIn) {
                console.log("Session expired. Re-authenticating...");
                await this.freshLogin();
            }
        }

        console.log("LinkedIn session ready!");
        return this.page!;
    }

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
            console.log("Loaded saved session from disk.");
            return true;
        } catch {
            return false;
        }
    }

    private async freshLogin(): Promise<void> {
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

        await this.page.goto(`${LINKEDIN_URL}/login`, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
        });

        await this.page.fill('input[id="username"]', config.LINKEDIN_EMAIL);
        await this.page.fill('input[id="password"]', config.LINKEDIN_PASSWORD);

        await this.page.click('button[type="submit"]');

        try {
            await this.page.waitForURL("**/feed/**", { timeout: 30_000 });
            console.log("Login successful!");
        } catch {
            console.log("Login requires manual intervention (CAPTCHA/2FA).");
            console.log("   Complete the challenge in the browser window.");
            console.log("   Waiting up to 120 seconds...");

            await this.page.waitForURL("**/feed/**", { timeout: 120_000 });
            console.log("Login completed after manual intervention!");
        }

        await this.saveSession();
    }

    private async saveSession(): Promise<void> {
        if (!this.context) return;
        const storageState = await this.context.storageState();
        await fs.writeFile(SESSION_FILE, JSON.stringify(storageState, null, 2));
        console.log("Session saved to disk.");
    }

    private async verifyLogin(): Promise<boolean> {
        if (!this.page) return false;

        try {
            await this.page.goto(`${LINKEDIN_URL}/feed/`, {
                waitUntil: "domcontentloaded",
                timeout: 30_000,
            });

            await this.page.waitForTimeout(2000);

            const currentUrl = this.page.url();
            if (currentUrl.includes("/login") || currentUrl.includes("/authwall")) {
                return false;
            }

            if (currentUrl.includes("linkedin.com")) {
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    getPage(): Page {
        if (!this.page) {
            throw new Error("Session not initialized. Call initialize() first.");
        }
        return this.page;
    }

    getContext(): BrowserContext {
        if (!this.context) {
            throw new Error("Session not initialized. Call initialize() first.");
        }
        return this.context;
    }

    async close(): Promise<void> {
        await this.saveSession();
        await this.browser?.close();
        this.browser = null;
        this.context = null;
        this.page = null;
        console.log("Browser session closed and saved.");
    }
}

// Singleton instance
export const sessionManager = new LinkedInSessionManager();
