/**
 * Setup Routes
 *
 * API endpoints that handle the entire onboarding flow from the UI,
 * so non-technical users never need to touch the terminal.
 *
 * Routes:
 *   GET  /api/setup/status      — Check which setup steps are complete
 *   POST /api/setup/credentials — Save LinkedIn + Anthropic credentials
 *   POST /api/setup/browser     — Install Playwright Chromium browser
 */

import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

// Paths
const BACKEND_DIR = path.resolve(import.meta.dirname, "../..");
const ENV_FILE = path.join(BACKEND_DIR, ".env");
const SESSION_DIR = path.join(BACKEND_DIR, "sessions");
const SESSION_FILE = path.join(SESSION_DIR, "linkedin-session.json");

// ---- Helper: Parse .env file into key-value pairs ----
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

// ---- Helper: Write key-value pairs back to .env ----
function buildEnvFile(values: Record<string, string>): string {
    const lines = [
        "# ============================================",
        "# LinkedIn Automation Agent - Environment Config",
        "# ============================================",
        "",
        "# Anthropic Claude API Key (required)",
        `ANTHROPIC_API_KEY=${values.ANTHROPIC_API_KEY || ""}`,
        "",
        "# LinkedIn Credentials (for browser automation login)",
        `LINKEDIN_EMAIL=${values.LINKEDIN_EMAIL || ""}`,
        `LINKEDIN_PASSWORD=${values.LINKEDIN_PASSWORD || ""}`,
        "",
        "# Server Configuration",
        `PORT=${values.PORT || "3001"}`,
        `NODE_ENV=${values.NODE_ENV || "development"}`,
        "",
        "# Browser Automation Settings",
        `HEADLESS=${values.HEADLESS || "false"}`,
        `BROWSER_SLOW_MO=${values.BROWSER_SLOW_MO || "50"}`,
        "",
        "# Session Storage Path (for persistent login)",
        `SESSION_DIR=${values.SESSION_DIR || "./sessions"}`,
        "",
    ];
    return lines.join("\n");
}

// ============================================================
// GET /api/setup/status
// Returns which setup steps have been completed
// ============================================================
router.get("/status", async (_req, res) => {
    try {
        // Check 1: Do we have a .env file with real credentials?
        let hasCredentials = false;
        let hasApiKey = false;
        let email = "";

        try {
            const envContent = await fs.readFile(ENV_FILE, "utf-8");
            const env = parseEnvFile(envContent);
            hasApiKey =
                !!env.ANTHROPIC_API_KEY &&
                env.ANTHROPIC_API_KEY !== "sk-ant-api03-your-key-here" &&
                env.ANTHROPIC_API_KEY.length > 10;
            hasCredentials =
                !!env.LINKEDIN_EMAIL &&
                env.LINKEDIN_EMAIL !== "your-email@example.com" &&
                !!env.LINKEDIN_PASSWORD &&
                env.LINKEDIN_PASSWORD !== "your-password-here" &&
                env.LINKEDIN_PASSWORD.length > 0;
            email = env.LINKEDIN_EMAIL || "";
        } catch {
            // No .env file
        }

        // Check 2: Is Playwright Chromium installed?
        let hasBrowser = false;
        try {
            const { stdout } = await execAsync("npx playwright install --dry-run chromium 2>&1", {
                cwd: BACKEND_DIR,
                timeout: 15000,
            });
            // If dry-run says "is already installed" or exits 0, we're good
            hasBrowser = stdout.includes("already installed") || true;
        } catch {
            // Try another check
            try {
                // Check if chromium binary exists in playwright cache
                const { stdout } = await execAsync("npx playwright install --list 2>&1", {
                    cwd: BACKEND_DIR,
                    timeout: 15000,
                });
                hasBrowser = stdout.toLowerCase().includes("chromium");
            } catch {
                hasBrowser = false;
            }
        }

        // Check 3: Do we have a saved LinkedIn session?
        let hasSession = false;
        try {
            await fs.access(SESSION_FILE);
            const stat = await fs.stat(SESSION_FILE);
            hasSession = stat.size > 100; // Not an empty/corrupt file
        } catch {
            // No session file
        }

        res.json({
            steps: {
                credentials: hasCredentials && hasApiKey,
                browser: hasBrowser,
                session: hasSession,
            },
            email: email,
            allComplete: hasCredentials && hasApiKey && hasBrowser,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
    }
});

// ============================================================
// POST /api/setup/credentials
// Save LinkedIn credentials and API key to .env
// ============================================================
router.post("/credentials", async (req, res) => {
    try {
        const { linkedinEmail, linkedinPassword, anthropicApiKey } = req.body;

        if (!linkedinEmail || !linkedinPassword || !anthropicApiKey) {
            return res.status(400).json({
                error: "All fields are required: linkedinEmail, linkedinPassword, anthropicApiKey",
            });
        }

        // Read existing .env or start fresh
        let existing: Record<string, string> = {};
        try {
            const content = await fs.readFile(ENV_FILE, "utf-8");
            existing = parseEnvFile(content);
        } catch {
            // No existing file
        }

        // Update credentials
        existing.ANTHROPIC_API_KEY = anthropicApiKey;
        existing.LINKEDIN_EMAIL = linkedinEmail;
        existing.LINKEDIN_PASSWORD = linkedinPassword;

        // Ensure defaults
        existing.PORT = existing.PORT || "3001";
        existing.NODE_ENV = existing.NODE_ENV || "development";
        existing.HEADLESS = existing.HEADLESS || "false";
        existing.BROWSER_SLOW_MO = existing.BROWSER_SLOW_MO || "50";
        existing.SESSION_DIR = existing.SESSION_DIR || "./sessions";

        // Write .env
        await fs.writeFile(ENV_FILE, buildEnvFile(existing), "utf-8");

        console.log("✅ Credentials saved to .env");
        res.json({
            success: true,
            message: "Credentials saved! The server will need to restart to pick up new values.",
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
    }
});

// ============================================================
// POST /api/setup/browser
// Install Playwright Chromium
// ============================================================
router.post("/browser", async (_req, res) => {
    try {
        console.log("📦 Installing Playwright Chromium...");

        const { stdout, stderr } = await execAsync(
            "npx playwright install chromium 2>&1",
            {
                cwd: BACKEND_DIR,
                timeout: 120000, // 2 minutes
            },
        );

        console.log("✅ Browser installation complete");
        console.log(stdout);
        if (stderr) console.error(stderr);

        res.json({
            success: true,
            message: "Chromium browser installed successfully!",
            output: stdout,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ Browser installation failed: ${msg}`);
        res.status(500).json({
            success: false,
            error: `Browser installation failed: ${msg}`,
        });
    }
});

export default router;
