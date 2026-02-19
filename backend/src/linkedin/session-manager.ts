import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";
import { accountManager } from "./account-manager.js";

const LINKEDIN_URL = "https://www.linkedin.com";

export class LinkedInSessionManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private currentAccountId: string | null = null;

    async initialize(accountId?: string): Promise<Page> {
        console.log("Initializing LinkedIn browser session...");

        // If specific account requested, switch to it. Otherwise use active.
        if (accountId) {
            await accountManager.setActiveAccount(accountId);
        }

        const activeAccount = await accountManager.getActiveAccount();
        if (!activeAccount) {
            throw new Error("No active LinkedIn account found. Please add an account first.");
        }
        this.currentAccountId = activeAccount.id;

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
            console.log(`No saved session found for ${activeAccount.email}. Starting fresh login...`);
            await this.freshLogin();
        } else {
            const isLoggedIn = await this.verifyLogin();
            if (!isLoggedIn) {
                console.log(`Session expired for ${activeAccount.email}. Re-authenticating...`);
                await this.freshLogin();
            }
        }

        console.log(`LinkedIn session ready for ${activeAccount.email}!`);
        return this.page!;
    }

    private getSessionFilePath(): string {
        if (!this.currentAccountId) throw new Error("No active account ID");
        // Sanitize ID for filename
        const safeId = this.currentAccountId.replace(/[^a-z0-9]/gi, '_');
        return path.join(config.SESSION_DIR, `linkedin-session-${safeId}.json`);
    }

    private async loadSession(): Promise<boolean> {
        try {
            const sessionFile = this.getSessionFilePath();
            const sessionData = await fs.readFile(sessionFile, "utf-8");
            const storageState = JSON.parse(sessionData);

            this.context = await this.browser!.newContext({
                storageState,
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
        const activeAccount = await accountManager.getActiveAccount();
        if (!activeAccount) throw new Error("No active account for login");

        if (!this.context) {
            this.context = await this.browser!.newContext({
                viewport: { width: 1280, height: 800 },
                locale: "en-US",
            });
        }

        this.page = await this.context.newPage();

        await this.page.goto(`${LINKEDIN_URL}/login`, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
        });


        const emailInput = this.page.locator('input[id="username"]').or(this.page.locator('input[name="session_key"]'));
        await emailInput.fill(activeAccount.email);


        console.log("Waiting up to 120 seconds for login to complete...");

        try {
            await this.page.waitForURL("**/feed/**", { timeout: 120_000 });
            console.log("Login successful!");
        } catch {
            console.log("Login timed out. Please try again.");
        }

        await this.saveSession();
    }

    private async saveSession(): Promise<void> {
        if (!this.context) return;
        const storageState = await this.context.storageState();
        await fs.writeFile(this.getSessionFilePath(), JSON.stringify(storageState, null, 2));
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

export const sessionManager = new LinkedInSessionManager();
