/**
 * Send Message Action
 *
 * Handles sending messages on LinkedIn.
 */

import { sessionManager } from "../session-manager.js";
import { navigateToMessaging, clearSearchOverlay, dismissOverlays } from "../utils/navigation.js";
import { findMessagingSearchInput, findMessageTextbox, findSendButton, findRecipientInput } from "../utils/locators.js";
import { humanClick, humanType, randomDelay } from "../../utils/humanDelay.js";
import { dumpDOM, dumpDOMForced } from "../../utils/domDump.js";

// Types from original actions.ts
export interface ActionResult {
    success: boolean;
    message: string;
    step?: string;
    debugAvailable?: boolean;
    debugFiles?: string[];
}

async function clickConversation(page: any, recipientName: string): Promise<boolean> {
    await clearSearchOverlay(page);

    // Strategy 1: role=listitem containing the name
    const listItems = page.getByRole("listitem");
    const count = await listItems.count().catch(() => 0);
    console.log(`Found ${count} list items in messaging`);

    for (let i = 0; i < count; i++) {
        const item = listItems.nth(i);
        const text = await item.textContent().catch(() => "");
        if (text && text.toLowerCase().includes(recipientName.toLowerCase())) {
            console.log(`Found conversation with "${recipientName}" at index ${i}`);
            await clearSearchOverlay(page);
            await humanClick(item);
            return true;
        }
    }

    // Strategy 2: getByText
    try {
        const nameLink = page.getByText(recipientName, { exact: false }).first();
        if (await nameLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await clearSearchOverlay(page);
            await humanClick(nameLink);
            return true;
        }
    } catch { /* not found */ }

    // Strategy 3: anchor containing name
    try {
        const links = page.locator(`a:has-text("${recipientName}")`);
        if (await links.first().isVisible({ timeout: 2000 }).catch(() => false)) {
            await clearSearchOverlay(page);
            await humanClick(links.first());
            return true;
        }
    } catch { /* not found */ }

    console.log(`No conversation found for "${recipientName}"`);
    return false;
}


async function startNewMessage(page: any, recipientName: string): Promise<void> {
    await clearSearchOverlay(page);
    const composeBtn = page.getByRole("button", { name: /compose|new message|write/i }).first();
    const composeLink = page.locator('a[href*="/messaging/new"]').first();

    let found = false;
    if (await composeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await humanClick(composeBtn);
        found = true;
    } else if (await composeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await humanClick(composeLink);
        found = true;
    }
    if (!found) throw new Error("Could not find the 'Compose message' button.");

    await randomDelay(1500, 2500);
    await clearSearchOverlay(page);
    await dumpDOM(page, "compose-dialog-opened");

    const recipientInput = await findRecipientInput(page);
    await humanType(page, recipientInput, recipientName, 60, 140);
    await randomDelay(2000, 3000);
    await dumpDOM(page, "compose-recipient-typed");
    await clearSearchOverlay(page);

    if (await page.getByRole("option").first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await humanClick(page.getByRole("option").first());
        return;
    }
    const nameMatch = page.getByText(recipientName, { exact: false });
    const matchCount = await nameMatch.count().catch(() => 0);
    for (let i = 0; i < matchCount; i++) {
        const el = nameMatch.nth(i);
        const tag = await el.evaluate((n: any) => n.tagName.toLowerCase()).catch(() => "");
        if (tag !== "input" && tag !== "textarea") {
            await humanClick(el);
            return;
        }
    }
    if (await page.getByRole("listbox").isVisible({ timeout: 2000 }).catch(() => false)) {
        const firstOption = page.getByRole("listbox").locator("> *").first();
        if (await firstOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await humanClick(firstOption);
            return;
        }
    }
    throw new Error(`No matching contact found for "${recipientName}".`);
}

async function sendMessageAttempt(
    recipientName: string,
    messageText: string,
    attempt: number,
): Promise<ActionResult> {
    const page = sessionManager.getPage();
    const debugFiles: string[] = [];
    let currentStep = "init";

    try {
        currentStep = "navigate-to-messaging";
        await navigateToMessaging(page);
        debugFiles.push(...await dumpDOM(page, `${attempt}-after-nav`));

        currentStep = "dismiss-overlays";
        await dismissOverlays(page);

        currentStep = "find-search-input";
        debugFiles.push(...await dumpDOM(page, `${attempt}-before-search`));
        const searchInput = await findMessagingSearchInput(page);
        await clearSearchOverlay(page);

        currentStep = "type-recipient-name";
        await humanClick(searchInput);
        await searchInput.fill("");
        await humanType(page, searchInput, recipientName, 50, 120);
        await randomDelay(2000, 3500);
        await clearSearchOverlay(page);
        debugFiles.push(...await dumpDOM(page, `${attempt}-after-search`));

        currentStep = "find-recipient";
        const conversationClicked = await clickConversation(page, recipientName);
        if (!conversationClicked) {
            currentStep = "compose-new-message";
            console.log("No existing conversation found. Starting new message...");
            await startNewMessage(page, recipientName);
        }

        await randomDelay(1500, 2500);
        await clearSearchOverlay(page);
        debugFiles.push(...await dumpDOM(page, `${attempt}-conversation-loaded`));

        currentStep = "find-message-input";
        const msgInput = await findMessageTextbox(page);

        currentStep = "type-message";
        await humanClick(msgInput);
        await randomDelay(300, 600);
        await humanType(page, msgInput, messageText, 30, 100);
        await randomDelay(400, 800);
        debugFiles.push(...await dumpDOM(page, `${attempt}-before-send`));

        currentStep = "click-send";
        await clearSearchOverlay(page);
        const sendBtn = await findSendButton(page);
        await humanClick(sendBtn);
        await randomDelay(1000, 2000);
        debugFiles.push(...await dumpDOM(page, `${attempt}-after-send`));

        console.log(`Message sent to "${recipientName}" successfully!`);
        return {
            success: true,
            message: `Message sent to ${recipientName}: "${messageText}"`,
            step: "complete",
            debugAvailable: debugFiles.length > 0,
            debugFiles,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Failed at step "${currentStep}": ${errorMessage}`);
        debugFiles.push(...await dumpDOMForced(page, `${attempt}-error-${currentStep}`));
        return {
            success: false,
            message: `Step "${currentStep}" failed: ${errorMessage}`,
            step: currentStep,
            debugAvailable: debugFiles.length > 0,
            debugFiles,
        };
    }
}

export async function sendMessage(
    recipientName: string,
    messageText: string,
): Promise<ActionResult> {
    const MAX_RETRIES = 2;
    let lastError = "";
    let lastStep = "";
    const allDebugFiles: string[] = [];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            console.log(`\nRetry attempt ${attempt}/${MAX_RETRIES}...`);
            await randomDelay(2000, 4000);
        }
        const result = await sendMessageAttempt(recipientName, messageText, attempt);
        if (result.success) return result;
        lastError = result.message;
        lastStep = result.step || "unknown";
        if (result.debugFiles) allDebugFiles.push(...result.debugFiles);
    }

    return {
        success: false,
        message: `Failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`,
        step: lastStep,
        debugAvailable: allDebugFiles.length > 0,
        debugFiles: allDebugFiles,
    };
}
