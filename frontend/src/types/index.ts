export interface ChatMessage {
    id: string;
    role: "user" | "agent";
    content: string;
    actions?: ActionInfo[];
    step?: string;
    debugAvailable?: boolean;
    timestamp: Date;
}

export interface ActionInfo {
    tool: string;
    input: Record<string, unknown>;
    success: boolean;
    step?: string;
    debugAvailable?: boolean;
}

export interface SetupStatus {
    steps: {
        credentials: boolean;
        browser: boolean;
        session: boolean;
    };
    email: string;
    allComplete: boolean;
}

export interface Account {
    id: string;
    email: string;
    isActive: boolean;
    name?: string;
    avatarUrl?: string;
}

export type AppScreen = "loading" | "setup" | "main";
export type AgentStatus = "checking" | "offline" | "ready" | "initializing";
export type SetupStep = "credentials" | "browser" | "complete";
