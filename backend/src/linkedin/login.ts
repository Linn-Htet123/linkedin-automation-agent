/**
 * LinkedIn Login Script
 *
 * Run this standalone to authenticate with LinkedIn.
 * Usage: npm run linkedin:login
 *
 * This will:
 * 1. Open a visible browser window
 * 2. Navigate to LinkedIn login
 * 3. Fill in your credentials
 * 4. Wait for you to solve any CAPTCHA/2FA
 * 5. Save the session cookies to disk
 *
 * After running this once, the agent can reuse the saved session.
 */

import { sessionManager } from "./session-manager.js";

async function main() {
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║   LinkedIn Login — Session Setup             ║");
    console.log("╠══════════════════════════════════════════════╣");
    console.log("║   This will open a browser and log into      ║");
    console.log("║   LinkedIn. If a CAPTCHA or 2FA appears,     ║");
    console.log("║   complete it in the browser window.          ║");
    console.log("║                                              ║");
    console.log("║   Your session will be saved for reuse.       ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log();

    try {
        const page = await sessionManager.initialize();
        console.log("\n🎉 Login successful! Session has been saved.");
        console.log("   The agent can now use this session.");
        console.log(`\n   Current URL: ${page.url()}`);

        // Keep the browser open for 10 seconds so the user can verify
        console.log("\n⏳ Closing browser in 10 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 10_000));

        await sessionManager.close();
        console.log("\n✅ All done! You can now start the agent.");
    } catch (error) {
        console.error("\n❌ Login failed:", error);
        await sessionManager.close();
        process.exit(1);
    }
}

main();
