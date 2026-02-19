import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";

const DATA_DIR = path.join(config.BACKEND_DIR || process.cwd(), "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");

export interface LinkedInAccount {
    id: string; // unique ID (e.g., email or uuid)
    email: string;
    isActive: boolean;
    name?: string;
    avatarUrl?: string;
}

export class AccountManager {
    private accounts: LinkedInAccount[] = [];
    private activeAccountId: string | null = null;

    constructor() {
        this.initialize();
    }

    private async initialize() {
        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
            const data = await fs.readFile(ACCOUNTS_FILE, "utf-8");
            const parsed = JSON.parse(data);
            this.accounts = parsed.accounts || [];
            this.activeAccountId = parsed.activeAccountId || null;

            // If we have accounts but no active one, default to the first
            if (this.accounts.length > 0 && !this.activeAccountId) {
                this.activeAccountId = this.accounts[0].id;
                await this.save();
            }
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err.code === "ENOENT") {
                console.warn("\n⚠️  WARNING: accounts.json not found.");
                console.warn("   To fix, run this from the project root:");
                console.warn("   cp backend/data/accounts.example.json backend/data/accounts.json\n");
                console.warn("   Starting with empty accounts list for now.");
            } else {
                console.error("Failed to load accounts:", err);
            }

            // File doesn't exist or is corrupt, start fresh
            this.accounts = [];
            this.activeAccountId = null;
        }
    }

    async getAccounts(): Promise<LinkedInAccount[]> {
        await this.initialize(); // Ensure loaded
        return this.accounts;
    }

    async getActiveAccount(): Promise<LinkedInAccount | null> {
        await this.initialize();
        if (!this.activeAccountId) return null;
        return this.accounts.find(a => a.id === this.activeAccountId) || null;
    }

    async addAccount(email: string): Promise<LinkedInAccount> {
        await this.initialize();

        // Check if exists
        const existing = this.accounts.find(a => a.email === email);
        if (existing) {
            return existing;
        }

        const newAccount: LinkedInAccount = {
            id: email, // simple ID for now
            email,
            isActive: false
        };

        this.accounts.push(newAccount);

        // If it's the first account, make it active
        if (this.accounts.length === 1) {
            this.activeAccountId = newAccount.id;
        }

        await this.save();
        return newAccount;
    }

    async setActiveAccount(accountId: string): Promise<boolean> {
        await this.initialize();
        const exists = this.accounts.find(a => a.id === accountId);
        if (!exists) return false;

        this.activeAccountId = accountId;
        await this.save();
        return true;
    }

    async removeAccount(accountId: string): Promise<void> {
        await this.initialize();
        this.accounts = this.accounts.filter(a => a.id !== accountId);

        if (this.activeAccountId === accountId) {
            this.activeAccountId = this.accounts.length > 0 ? this.accounts[0].id : null;
        }

        await this.save();
    }

    private async save() {
        const data = {
            accounts: this.accounts,
            activeAccountId: this.activeAccountId
        };
        await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
    }
}

export const accountManager = new AccountManager();
