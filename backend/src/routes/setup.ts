import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

const BACKEND_DIR = path.resolve(import.meta.dirname, "../..");
const ENV_FILE = path.join(BACKEND_DIR, ".env");
const SESSION_DIR = path.join(BACKEND_DIR, "sessions");
const SESSION_FILE = path.join(SESSION_DIR, "linkedin-session.json");

function parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
            const key = trimmed.substring(0, eqIndex);
            const value = trimmed.substring(eqIndex + 1);
            result[key] = value;
        }
    }
    return result;
}

function buildEnvFile(values: Record<string, string>): string {
    const lines = [
        `LINKEDIN_EMAIL=${values.LINKEDIN_EMAIL || ""}`,
        `LINKEDIN_PASSWORD=${values.LINKEDIN_PASSWORD || ""}`,
        `PORT=${values.PORT || "3001"}`,
        `NODE_ENV=${values.NODE_ENV || "development"}`,
        `HEADLESS=${values.HEADLESS || "false"}`,
        `BROWSER_SLOW_MO=${values.BROWSER_SLOW_MO || "50"}`,
        `SESSION_DIR=${values.SESSION_DIR || "./sessions"}`,
    ];
    return lines.join("\n");
}

import { accountManager } from "../linkedin/account-manager.js";

router.get("/status", async (_req, res) => {
    try {
        const accounts = await accountManager.getAccounts();
        const hasCredentials = accounts.length > 0;
        const email = hasCredentials ? accounts[0].email : "";

        let hasBrowser = false;
        try {
            const { stdout } = await execAsync("npx playwright install --dry-run chromium 2>&1", {
                cwd: BACKEND_DIR,
                timeout: 15000,
            });
            hasBrowser = stdout.includes("already installed") || true;
        } catch {
            try {
                const { stdout } = await execAsync("npx playwright install --list 2>&1", {
                    cwd: BACKEND_DIR,
                    timeout: 15000,
                });
                hasBrowser = stdout.toLowerCase().includes("chromium");
            } catch {
                hasBrowser = false;
            }
        }

        let hasSession = false;
        try {
            await fs.access(SESSION_FILE);
            const stat = await fs.stat(SESSION_FILE);
            hasSession = stat.size > 100;
        } catch {
        }

        res.json({
            steps: {
                credentials: hasCredentials,
                browser: hasBrowser,
                session: hasSession,
            },
            email: email,
            allComplete: hasCredentials && hasBrowser,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
    }
});

router.post("/credentials", async (req, res) => {
    try {
        const { linkedinEmail, linkedinPassword } = req.body;

        if (!linkedinEmail || !linkedinPassword) {
            return res.status(400).json({
                error: "All fields are required: linkedinEmail, linkedinPassword",
            });
        }

        let existing: Record<string, string> = {};
        try {
            const content = await fs.readFile(ENV_FILE, "utf-8");
            existing = parseEnvFile(content);
        } catch {
        }

        existing.LINKEDIN_EMAIL = linkedinEmail;
        existing.LINKEDIN_PASSWORD = linkedinPassword;

        existing.PORT = existing.PORT || "3001";
        existing.NODE_ENV = existing.NODE_ENV || "development";
        existing.HEADLESS = existing.HEADLESS || "false";
        existing.BROWSER_SLOW_MO = existing.BROWSER_SLOW_MO || "50";
        existing.SESSION_DIR = existing.SESSION_DIR || "./sessions";

        await fs.writeFile(ENV_FILE, buildEnvFile(existing), "utf-8");

        console.log("Credentials saved to .env");
        res.json({
            success: true,
            message: "Credentials saved! The server will need to restart to pick up new values.",
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
    }
});

router.post("/browser", async (_req, res) => {
    try {
        console.log("Installing Playwright Chromium...");

        const { stdout, stderr } = await execAsync(
            "npx playwright install chromium 2>&1",
            {
                cwd: BACKEND_DIR,
                timeout: 120000,
            },
        );

        console.log("Browser installation complete");
        console.log(stdout);
        if (stderr) console.error(stderr);

        res.json({
            success: true,
            message: "Chromium browser installed successfully!",
            output: stdout,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error(`Browser installation failed: ${msg}`);
        res.status(500).json({
            success: false,
            error: `Browser installation failed: ${msg}`,
        });
    }
});

export default router;
