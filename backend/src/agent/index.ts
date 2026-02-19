import { execFile } from "child_process";
import { promisify } from "util";
import type { MessageData } from "../linkedin/actions.js";

const execFileAsync = promisify(execFile);

export interface AgentResult {
    response: string;
    actions: ActionLog[];
}

interface ActionLog {
    tool: string;
    input: Record<string, unknown>;
    result: unknown;
}

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

export async function checkOpenClaw(): Promise<boolean> {
    try {
        await execFileAsync("openclaw", ["--version"], { timeout: 5000 });
        return true;
    } catch (error) {
        console.error("OpenClaw is not installed or not in PATH:", error);
        return false;
    }
}

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

        const parsed: OpenClawAgentResult = JSON.parse(stdout.trim());

        if (parsed.status === "error") {
            throw new Error(parsed.error ?? "OpenClaw agent returned an error");
        }

        const payloads = parsed.result?.payloads ?? [];
        const responseText = payloads
            .map((p) => p.text ?? "")
            .filter(Boolean)
            .join("\n")
            || "Action completed.";

        console.log(`\n💬 OpenClaw response: ${responseText}`);

        return {
            response: responseText,
            actions: [],
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
