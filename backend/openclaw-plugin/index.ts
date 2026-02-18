/**
 * LinkedIn OpenClaw Plugin
 *
 * Registers three agent tools that execute LinkedIn Playwright actions
 * via the internal /api/linkedin-tool endpoint on the Express backend.
 *
 * Uses /api/linkedin-tool (NOT /api/command) to avoid a circular loop:
 *   OpenClaw agent → plugin tool → /api/linkedin-tool → Playwright ✅
 *   (if it called /api/command it would loop back through OpenClaw again)
 *
 * Tools registered:
 *   - linkedin_send_message
 *   - linkedin_read_messages
 *   - linkedin_search_profile
 *
 * Prerequisites:
 *   1. The LinkedIn backend must be running: `npm run dev` in the project root
 *   2. The LinkedIn session must be initialized: POST /api/init
 */

const DEFAULT_BACKEND_URL = "http://localhost:3001";

export default function linkedinPlugin(api: {
    registerTool: (tool: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
        execute: (id: string, params: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    }, opts?: { optional?: boolean }) => void;
    config?: { backendUrl?: string };
}) {
    const backendUrl = api.config?.backendUrl ?? DEFAULT_BACKEND_URL;

    // ── Helper ────────────────────────────────────────────────────────────────

    async function callTool(tool: string, params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
        const res = await fetch(`${backendUrl}/api/linkedin-tool`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool, params }),
        });

        if (!res.ok) {
            throw new Error(`LinkedIn backend error: ${res.status} ${res.statusText}`);
        }

        return res.json() as Promise<{ success: boolean; result?: unknown; error?: string }>;
    }

    function text(str: string) {
        return { content: [{ type: "text", text: str }] };
    }

    // ── Tool: linkedin_send_message ───────────────────────────────────────────

    api.registerTool(
        {
            name: "linkedin_send_message",
            description:
                "Send a direct message to a LinkedIn connection. " +
                "Use when the user wants to message someone on LinkedIn. " +
                "Expands casual instructions into professional messages if needed.",
            parameters: {
                type: "object",
                properties: {
                    recipient_name: {
                        type: "string",
                        description: "Full name of the LinkedIn connection to message (e.g. 'Myo Hsat', 'John Smith')",
                    },
                    message_text: {
                        type: "string",
                        description:
                            "The message to send. Expand casual instructions into a professional, friendly LinkedIn message.",
                    },
                },
                required: ["recipient_name", "message_text"],
                additionalProperties: false,
            },
            async execute(_id, params) {
                try {
                    const result = await callTool("send_message", {
                        recipient_name: params.recipient_name,
                        message_text: params.message_text,
                    });

                    if (result.success) {
                        return text(`✅ Message sent to ${params.recipient_name}.`);
                    } else {
                        return text(`❌ Failed to send message: ${result.error ?? "Unknown error"}`);
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    return text(`❌ LinkedIn backend error: ${msg}\n\nMake sure the backend is running (npm run dev) and initialized (POST /api/init).`);
                }
            },
        },
        { optional: true },
    );

    // ── Tool: linkedin_read_messages ──────────────────────────────────────────

    api.registerTool(
        {
            name: "linkedin_read_messages",
            description:
                "Read recent LinkedIn messages — either all recent conversations or from a specific person. " +
                "Use when the user wants to check, read, or review LinkedIn messages or conversations.",
            parameters: {
                type: "object",
                properties: {
                    person_name: {
                        type: "string",
                        description:
                            "Optional: name of the person to read messages from. " +
                            "If omitted, reads the most recent conversations.",
                    },
                    count: {
                        type: "number",
                        description: "Number of recent messages to retrieve (default: 10, max: 50).",
                    },
                },
                required: [],
                additionalProperties: false,
            },
            async execute(_id, params) {
                try {
                    const result = await callTool("read_messages", {
                        person_name: params.person_name,
                        count: params.count ?? 10,
                    });

                    if (result.success) {
                        const raw = result.result as { messages?: Array<{ sender: string; body: string; timestamp: string }> } | Array<{ sender: string; body: string; timestamp: string }>;

                        // Normalise: result.result may be the ReadResult object or the messages array directly
                        const messages = Array.isArray(raw)
                            ? raw
                            : (raw as { messages?: Array<{ sender: string; body: string; timestamp: string }> }).messages ?? [];

                        if (!Array.isArray(messages) || messages.length === 0) {
                            return text("No messages found in the conversation.");
                        }

                        // Format each message. If sender is Unknown, omit it — just show the body.
                        const formatted = messages
                            .map((m, i) => {
                                const senderPart = m.sender && m.sender !== "Unknown" ? `[${m.sender}] ` : "";
                                return `${i + 1}. ${senderPart}${m.body}`;
                            })
                            .join("\n");

                        const header = params.person_name
                            ? `Recent messages${params.person_name ? ` (conversation with ${params.person_name})` : ""}:`
                            : "Recent LinkedIn messages:";

                        return text(`${header}\n\n${formatted}`);
                    } else {
                        return text(`❌ Failed to read messages: ${result.error ?? "Unknown error"}`);
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    return text(`❌ LinkedIn backend error: ${msg}\n\nMake sure the backend is running (npm run dev) and initialized (POST /api/init).`);
                }
            },
        },
        { optional: true },
    );

    // ── Tool: linkedin_search_profile ─────────────────────────────────────────

    api.registerTool(
        {
            name: "linkedin_search_profile",
            description:
                "Search for a person's LinkedIn profile by name. " +
                "Use when the user wants to find someone on LinkedIn, look up their profile, or get their info.",
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Full name of the person to search for on LinkedIn.",
                    },
                },
                required: ["name"],
                additionalProperties: false,
            },
            async execute(_id, params) {
                try {
                    const result = await callTool("search_profile", {
                        name: params.name,
                    });

                    if (result.success) {
                        return text(`Profile found:\n\n${JSON.stringify(result.result, null, 2)}`);
                    } else {
                        return text(`❌ Profile search failed: ${result.error ?? "Unknown error"}`);
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    return text(`❌ LinkedIn backend error: ${msg}\n\nMake sure the backend is running (npm run dev) and initialized (POST /api/init).`);
                }
            },
        },
        { optional: true },
    );
}

