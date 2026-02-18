/**
 * Claude AI Agent — The "Brain" of the Digital Twin
 *
 * This module wraps the Anthropic Claude 3.5 Sonnet API to:
 * 1. Parse natural language commands ("Send a message to Nadav...")
 * 2. Determine the appropriate LinkedIn action (send, read, search)
 * 3. Extract structured parameters (recipient, message content)
 * 4. Execute the action via the LinkedIn actions module
 * 5. Return a human-readable response
 *
 * This is the core integration point with the OpenClaw framework —
 * in OpenClaw, this would be wired as a "skill" that the agent can invoke.
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config/index.js";
import {
    sendMessage,
    readMessages,
    searchProfile,
    type MessageData,
} from "../linkedin/actions.js";

const anthropic = new Anthropic({
    apiKey: config.ANTHROPIC_API_KEY,
});

// ============================================================
// TOOL DEFINITIONS (Claude Tool Use / Function Calling)
// ============================================================

const LINKEDIN_TOOLS: Anthropic.Tool[] = [
    {
        name: "send_linkedin_message",
        description:
            "Send a direct message to a LinkedIn connection. " +
            "Use this when the user wants to message someone on LinkedIn.",
        input_schema: {
            type: "object" as const,
            properties: {
                recipient_name: {
                    type: "string",
                    description:
                        "The name of the LinkedIn connection to message (e.g., 'Nadav', 'John Smith')",
                },
                message_text: {
                    type: "string",
                    description:
                        "The message content to send. If the user gives a summary, " +
                        "expand it into a professional LinkedIn message.",
                },
            },
            required: ["recipient_name", "message_text"],
        },
    },
    {
        name: "read_linkedin_messages",
        description:
            "Read recent messages from LinkedIn — either all recent or from a specific person.",
        input_schema: {
            type: "object" as const,
            properties: {
                person_name: {
                    type: "string",
                    description:
                        "Optional: name of the person to read messages from. " +
                        "If not provided, reads the most recent conversations.",
                },
                count: {
                    type: "number",
                    description: "Number of recent messages to retrieve (default: 10).",
                },
            },
            required: [],
        },
    },
    {
        name: "search_linkedin_profile",
        description:
            "Search for a person's LinkedIn profile by name.",
        input_schema: {
            type: "object" as const,
            properties: {
                name: {
                    type: "string",
                    description: "The name of the person to search for on LinkedIn.",
                },
            },
            required: ["name"],
        },
    },
];

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `You are a LinkedIn Digital Twin agent for Geodo. Your job is to help the user manage their LinkedIn outreach by:

1. **Sending Messages**: When the user says things like "Send a message to Nadav saying I have started the task", use the send_linkedin_message tool.
2. **Reading Messages**: When the user wants to check messages, use the read_linkedin_messages tool.
3. **Searching Profiles**: When the user wants to find someone, use the search_linkedin_profile tool.

Guidelines:
- Always be professional and courteous in messages you compose.
- If the user provides a casual/shorthand instruction like "tell Nadav I started", expand it into a professional but friendly LinkedIn message.
- Confirm actions before and after execution.
- If something fails, explain the error clearly and suggest a fix.
- You can chain multiple actions if needed (e.g., search for a profile, then send a message).

You are operating as a browser automation agent. The LinkedIn session is managed securely with saved cookies.`;

// ============================================================
// AGENT EXECUTION
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

/**
 * Process a natural language command through the Claude agent.
 * Claude will decide which LinkedIn tool(s) to call.
 */
export async function processCommand(userCommand: string): Promise<AgentResult> {
    console.log(`\n🧠 Processing command: "${userCommand}"`);

    const actions: ActionLog[] = [];

    // Initial request to Claude with tool definitions
    let response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: LINKEDIN_TOOLS,
        messages: [
            {
                role: "user",
                content: userCommand,
            },
        ],
    });

    // Agentic loop: keep processing until Claude is done with tool calls
    const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userCommand },
    ];

    while (response.stop_reason === "tool_use") {
        // Collect all tool use blocks
        const toolUseBlocks = response.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
        );

        // Add the assistant's response to message history
        messages.push({ role: "assistant", content: response.content });

        // Execute each tool call and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
            console.log(`🔧 Executing tool: ${toolUse.name}`);
            const input = toolUse.input as Record<string, unknown>;
            let result: unknown;

            try {
                switch (toolUse.name) {
                    case "send_linkedin_message":
                        result = await sendMessage(
                            input.recipient_name as string,
                            input.message_text as string
                        );
                        break;

                    case "read_linkedin_messages":
                        result = await readMessages(
                            input.person_name as string | undefined,
                            (input.count as number) || 10
                        );
                        break;

                    case "search_linkedin_profile":
                        result = await searchProfile(input.name as string);
                        break;

                    default:
                        result = { error: `Unknown tool: ${toolUse.name}` };
                }
            } catch (error) {
                result = {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unknown error during tool execution",
                };
            }

            actions.push({ tool: toolUse.name, input, result });

            toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
            });
        }

        // Send tool results back to Claude
        messages.push({ role: "user", content: toolResults });

        response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: LINKEDIN_TOOLS,
            messages,
        });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const finalResponse =
        textBlocks.map((b) => b.text).join("\n") ||
        "Action completed successfully.";

    console.log(`\n💬 Agent response: ${finalResponse}`);

    return { response: finalResponse, actions };
}

/**
 * Format messages for display.
 */
export function formatMessages(messages: MessageData[]): string {
    if (messages.length === 0) return "No messages found.";

    return messages
        .map(
            (m) =>
                `[${m.timestamp}] ${m.sender}: ${m.body}`
        )
        .join("\n");
}
