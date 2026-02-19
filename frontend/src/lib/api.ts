import { ActionInfo, SetupStatus, Account } from "../types";

const API_BASE = "http://localhost:3001";

export async function fetchSetupStatus(): Promise<SetupStatus> {
    const res = await fetch(`${API_BASE}/api/setup/status`);
    return res.json();
}

export async function fetchAccounts(): Promise<{ accounts: Account[] }> {
    const res = await fetch(`${API_BASE}/api/accounts`);
    return res.json();
}

export async function addAccount(data: { email: string }): Promise<{ success: boolean; message: string; error?: string }> {
    const res = await fetch(`${API_BASE}/api/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function switchAccount(accountId: string): Promise<{ success: boolean; message: string; error?: string }> {
    const res = await fetch(`${API_BASE}/api/accounts/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
    });
    return res.json();
}

export async function removeAccount(accountId: string): Promise<{ success: boolean; message: string; error?: string }> {
    const res = await fetch(`${API_BASE}/api/accounts/${accountId}`, {
        method: "DELETE",
    });
    return res.json();
}

export async function saveCredentials(data: {
    linkedinEmail: string;
    linkedinPassword: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
    // Deprecated: Use addAccount instead
    const res = await fetch(`${API_BASE}/api/setup/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function installBrowser(): Promise<{
    success: boolean;
    message: string;
    error?: string;
}> {
    const res = await fetch(`${API_BASE}/api/setup/browser`, {
        method: "POST",
    });
    return res.json();
}

export async function checkAgentStatus(): Promise<{
    status: string;
    message: string;
}> {
    const res = await fetch(`${API_BASE}/api/status`);
    return res.json();
}

export async function initializeAgent(): Promise<{
    status: string;
    message: string;
}> {
    const res = await fetch(`${API_BASE}/api/init`, { method: "POST" });
    return res.json();
}

export async function sendCommand(command: string): Promise<{
    success: boolean;
    response: string;
    actions?: ActionInfo[];
    error?: string;
    step?: string;
    debugAvailable?: boolean;
}> {
    const res = await fetch(`${API_BASE}/api/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
    });
    return res.json();
}
