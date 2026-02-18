/**
 * Express API Server
 *
 * Exposes the LinkedIn agent as a REST API that the
 * Next.js/React frontend can call.
 *
 * Routes:
 *   POST /api/command          — Send a natural language command (→ OpenClaw)
 *   POST /api/linkedin-tool    — Internal: execute a Playwright action directly
 *   GET  /api/status           — Check if the agent is ready
 *   POST /api/init             — Initialize the LinkedIn session
 *   GET  /api/setup/status     — Check setup progress
 *   POST /api/setup/credentials — Save credentials
 *   POST /api/setup/browser    — Install Chromium
 */

import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import { processCommand } from "./agent/index.js";
import { sessionManager } from "./linkedin/session-manager.js";
import { sendMessage, readMessages, searchProfile } from "./linkedin/actions.js";
import setupRoutes from "./routes/setup.js";
import accountsRouter from "./routes/accounts.js";

const app = express();

app.use(cors({ origin: "*" })); // Allow all origins for local dev
app.use(express.json());

// ---- State ----
let isInitialized = false;
let isInitializing = false;

// ---- Mount Setup Routes ----
app.use("/api/setup", setupRoutes);
app.use("/api/accounts", accountsRouter);

// ---- Routes ----

/**
 * Health check / status endpoint
 */
app.get("/api/status", (_req, res) => {
    res.json({
        status: isInitialized ? "ready" : "not_initialized",
        message: isInitialized
            ? "Agent is ready to receive commands."
            : "LinkedIn session not initialized. POST /api/init first.",
    });
});

/**
 * Initialize the LinkedIn browser session.
 */
app.post("/api/init", async (_req, res) => {
    if (isInitialized) {
        return res.json({ status: "already_initialized" });
    }

    if (isInitializing) {
        return res.json({ status: "initializing", message: "Please wait..." });
    }

    isInitializing = true;

    try {
        await sessionManager.initialize();
        isInitialized = true;
        isInitializing = false;
        res.json({ status: "initialized", message: "LinkedIn session is ready!" });
    } catch (error) {
        isInitializing = false;
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ status: "error", message: msg });
    }
});

/**
 * Process a natural language command via OpenClaw's agent.
 * OpenClaw handles Claude, tool calling, and conversation history.
 */
app.post("/api/command", async (req, res) => {
    if (!isInitialized) {
        return res.status(400).json({
            error: "Agent not initialized. POST /api/init first.",
        });
    }

    const { command } = req.body;

    if (!command || typeof command !== "string") {
        return res.status(400).json({
            error: 'Missing "command" field in request body.',
        });
    }

    try {
        const result = await processCommand(command);

        res.json({
            success: true,
            response: result.response,
            actions: result.actions,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({
            success: false,
            error: msg,
            step: "openclaw-error",
            debugAvailable: false,
        });
    }
});

/**
 * Internal endpoint called by the OpenClaw LinkedIn plugin.
 * Executes Playwright actions directly — bypasses the agent loop
 * to avoid circular calls (plugin → agent → plugin).
 */
app.post("/api/linkedin-tool", async (req, res) => {
    if (!isInitialized) {
        return res.status(400).json({
            success: false,
            error: "LinkedIn session not initialized. POST /api/init first.",
        });
    }

    const { tool, params } = req.body as {
        tool: "send_message" | "read_messages" | "search_profile";
        params: Record<string, unknown>;
    };

    try {
        let result: unknown;

        switch (tool) {
            case "send_message":
                result = await sendMessage(
                    params.recipient_name as string,
                    params.message_text as string,
                );
                break;

            case "read_messages": {
                const readResult = await readMessages(
                    params.person_name as string | undefined,
                    (params.count as number) || 10,
                );
                if (!readResult.success) {
                    return res.json({ success: false, error: readResult.error });
                }
                result = readResult.messages;
                break;
            }

            case "search_profile":
                result = await searchProfile(params.name as string);
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: `Unknown tool: ${tool}`,
                });
        }

        res.json({ success: true, result });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, error: msg });
    }
});

// ---- Start ----
app.listen(config.PORT, () => {
    console.log(`\n  🦞 LinkedIn Automation Agent — API Server`);
    console.log(`  ────────────────────────────────────────`);
    console.log(`  🌐 Server:    http://localhost:${config.PORT}`);
    console.log(`  📊 Status:    http://localhost:${config.PORT}/api/status`);
    console.log(`  🚀 Init:      POST http://localhost:${config.PORT}/api/init`);
    console.log(`  💬 Command:   POST http://localhost:${config.PORT}/api/command`);
    console.log(`  🔧 Setup:     http://localhost:${config.PORT}/api/setup/status`);
    console.log(`  🦞 OpenClaw:  gateway at ws://127.0.0.1:18789`);
    console.log(`  ────────────────────────────────────────\n`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n🔒 Shutting down gracefully...");
    await sessionManager.close();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    await sessionManager.close();
    process.exit(0);
});
