import { Router } from "express";
import { accountManager } from "../linkedin/account-manager.js";
import { sessionManager } from "../linkedin/session-manager.js";

const router = Router();

router.get("/", async (_req, res) => {
    try {
        const accounts = await accountManager.getAccounts();
        const active = await accountManager.getActiveAccount();

        // Return safe version (no passwords)
        const safeAccounts = accounts.map(a => ({
            id: a.id,
            email: a.email,
            isActive: active?.id === a.id,
            name: a.name,
            avatarUrl: a.avatarUrl
        }));

        res.json({ accounts: safeAccounts });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
    }
});

// POST /api/accounts - Add a new account
router.post("/", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        await accountManager.addAccount(email);
        res.json({ success: true, message: "Account added successfully" });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
    }
});

// POST /api/accounts/switch - Switch active account
router.post("/switch", async (req, res) => {
    try {
        const { accountId } = req.body;
        if (!accountId) {
            return res.status(400).json({ error: "AccountId is required" });
        }

        const success = await accountManager.setActiveAccount(accountId);
        if (!success) {
            return res.status(404).json({ error: "Account not found" });
        }

        // Re-initialize session manager with new account
        try {
            await sessionManager.initialize(accountId);
            res.json({ success: true, message: `Switched to account ${accountId}` });
        } catch (err: any) {
            res.json({ success: true, message: `Switched to account ${accountId}, but session init failed: ${err.message}` });
        }

    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await sessionManager.deleteSession(id);
        await accountManager.removeAccount(id);
        res.json({ success: true, message: "Account removed" });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
    }
});

export default router;
