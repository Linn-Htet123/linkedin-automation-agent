/**
 * Express API Server
 *
 * Exposes the LinkedIn agent as a REST API that the
 * Next.js/React frontend can call.
 *
 * Routes:
 *   POST /api/command   — Send a natural language command
 *   GET  /api/status    — Check if the agent is ready
 *   POST /api/init      — Initialize the LinkedIn session
 */

import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import { processCommand } from "./agent/index.js";
import { sessionManager } from "./linkedin/session-manager.js";

const app = express();

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

// ---- State ----
let isInitialized = false;
let isInitializing = false;

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
 * Process a natural language command.
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

        // Extract step/debug info from action results for better error reporting
        const actions = result.actions.map((a) => {
            const r = a.result as Record<string, unknown>;
            return {
                tool: a.tool,
                input: a.input,
                success: r?.success ?? true,
                step: r?.step,
                debugAvailable: r?.debugAvailable ?? false,
            };
        });

        const anyFailed = actions.some((a) => !a.success);

        res.json({
            success: !anyFailed,
            response: result.response,
            actions,
            ...(anyFailed && {
                error: "One or more actions failed. See individual action results.",
                step: actions.find((a) => !a.success)?.step,
                debugAvailable: actions.some((a) => a.debugAvailable),
            }),
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({
            success: false,
            error: msg,
            step: "server-error",
            debugAvailable: false,
        });
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
