/**
 * OpenClaw Agent Bridge
 *
 * Replaces the direct Anthropic SDK with OpenClaw as the AI brain.
 * Sends commands to the OpenClaw gateway via the `openclaw agent` CLI,
 * which handles Claude, tool calling, and conversation history internally.
 *
 * The LinkedIn tools (send, read, search) are registered in the OpenClaw
 * plugin (openclaw-plugin/index.ts) and called by OpenClaw's agent loop.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import type { MessageData } from "../linkedin/actions.js";

const execFileAsync = promisify(execFile);

// ============================================================
// TYPES
// ============================================================

export interface AgentResult {
    response: string;
    actions: ActionLog[];
}

interface ActionLog {
    tool: string;
    input: Record<string, unknown>;
    result: unknown;
}

/** OpenClaw agent --json output shape */
interface OpenClawAgentResult {
    status: "ok" | "error";
    summary?: string;
    result?: {
        payloads?: Array<{ text: string | null; mediaUrl: string | null }>;
        meta?: {
            durationMs?: number;
            agentMeta?: {
                sessionId?: string;
                provider?: string;
                model?: string;
            };
        };
    };
    error?: string;
}

// ============================================================
// AGENT EXECUTION
// ============================================================

/**
 * Process a natural language command through OpenClaw's agent.
 * OpenClaw handles Claude, tool calling, and conversation history.
 */
export async function processCommand(
    userCommand: string,
): Promise<AgentResult> {
    console.log(`\n🦞 Sending to OpenClaw: "${userCommand}"`);

    try {
        const { stdout, stderr } = await execFileAsync(
            "openclaw",
            ["agent", "--agent", "main", "--message", userCommand, "--json"],
            {
                timeout: 120_000, // 2 minute timeout
                env: process.env,
            }
        );

        if (stderr) {
            console.warn(`⚠️  OpenClaw stderr: ${stderr}`);
        }

        // Parse the JSON output from openclaw agent --json
        const parsed: OpenClawAgentResult = JSON.parse(stdout.trim());

        if (parsed.status === "error") {
            throw new Error(parsed.error ?? "OpenClaw agent returned an error");
        }

        // Extract the text response from payloads
        const payloads = parsed.result?.payloads ?? [];
        const responseText = payloads
            .map((p) => p.text ?? "")
            .filter(Boolean)
            .join("\n")
            || "Action completed.";

        console.log(`\n💬 OpenClaw response: ${responseText}`);

        return {
            response: responseText,
            actions: [], // OpenClaw manages tool call logs internally
        };
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error("Failed to parse OpenClaw agent response as JSON");
        }
        throw error;
    }
}

/**
 * Format messages for display.
 */
export function formatMessages(messages: MessageData[]): string {
    if (messages.length === 0) return "No messages found.";
    return messages
        .map((m) => `[${m.timestamp}] ${m.sender}: ${m.body}`)
        .join("\n");
}
