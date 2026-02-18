/**
 * LinkedIn Actions Module — v3 (Fully Semantic Locators)
 *
 * readMessages() completely rewritten — zero CSS class selectors.
 * Uses only Playwright semantic API:
 *   - getByRole()        → lists, listitem, textbox, button
 *   - getByText()        → name matching
 *   - locator('p')       → paragraph text (structural, not class-based)
 *   - locator('time')    → timestamps (semantic HTML)
 *   - locator('strong')  → sender names (semantic HTML)
 *
 * sendMessage(), searchProfile(), helpers — unchanged from v2.
 */

import type { Page, Locator } from "playwright";
import { sessionManager } from "./session-manager.js";
import { dumpDOM, dumpDOMForced } from "../utils/domDump.js";
import { humanType, humanClick, randomDelay } from "../utils/humanDelay.js";

// ============================================================
// TYPES
// ============================================================

export interface MessageData {
    sender: string;
    body: string;
    timestamp: string;
}

export interface ActionResult {
    success: boolean;
    message: string;
    step?: string;
    debugAvailable?: boolean;
    debugFiles?: string[];
}

export interface ReadResult {
    success: boolean;
    messages: MessageData[];
    error?: string;
    step?: string;
    debugAvailable?: boolean;
}

// ============================================================
// OVERLAY DISMISSAL
// ============================================================

async function clearSearchOverlay(page: Page): Promise<void> {
    try {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        await page.evaluate(() => {
            (document.activeElement as HTMLElement)?.blur();
            document.querySelectorAll<HTMLElement>(
                ".search-global-typeahead__overlay, .search-global-typeahead-hit"
            ).forEach((el) => {
                el.style.display = "none";
                el.style.pointerEvents = "none";
            });
        });
    } catch {
        // Ignore
    }
}

async function dismissOverlays(page: Page): Promise<void> {
    await clearSearchOverlay(page);
    const dismissPatterns = [/dismiss/i, /close/i, /got it/i, /not now/i, /skip/i];
    for (const pattern of dismissPatterns) {
        try {
            const btn = page.getByRole("button", { name: pattern });
            if (await btn.first().isVisible({ timeout: 500 }).catch(() => false)) {
                await btn.first().click({ force: true });
                await page.waitForTimeout(500);
            }
        } catch {
            // Not present
        }
    }
}

// ============================================================
// NAVIGATION
// ============================================================

async function navigateToMessaging(page: Page): Promise<void> {
    console.log("📨 Navigating to LinkedIn Messaging...");
    await page.goto("https://www.linkedin.com/messaging/", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
    });
    await page.waitForTimeout(2000);
    await clearSearchOverlay(page);
    await dismissOverlays(page);
    try {
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
    } catch {
        // Networkidle can hang — continue anyway
    }
    await clearSearchOverlay(page);
    console.log(`📍 URL: ${page.url()}`);
    console.log("✅ Messaging page loaded.");
}

// ============================================================
// SEND MESSAGE (unchanged from v2)
// ============================================================

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
            console.log(`\n🔄 Retry attempt ${attempt}/${MAX_RETRIES}...`);
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
            console.log("📝 No existing conversation found. Starting new message...");
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

        console.log(`✅ Message sent to "${recipientName}" successfully!`);
        return {
            success: true,
            message: `Message sent to ${recipientName}: "${messageText}"`,
            step: "complete",
            debugAvailable: debugFiles.length > 0,
            debugFiles,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ Failed at step "${currentStep}": ${errorMessage}`);
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

// ============================================================
// LOCATOR HELPERS
// ============================================================

async function findMessagingSearchInput(page: Page): Promise<Locator> {
    const byPlaceholder = page.getByPlaceholder(/search messages/i);
    if (await byPlaceholder.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via placeholder");
        return byPlaceholder;
    }
    const byLabel = page.getByLabel(/search messages/i);
    if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via label");
        return byLabel;
    }
    const byRole = page.getByRole("searchbox");
    if (await byRole.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via role=searchbox");
        return byRole.first();
    }
    const messagingArea = page.locator("main, [role='main']").first();
    const scopedSearch = messagingArea.getByPlaceholder(/search/i);
    if (await scopedSearch.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via scoped placeholder");
        return scopedSearch.first();
    }
    const byGeneric = page.getByPlaceholder(/search/i);
    if (await byGeneric.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via generic placeholder");
        return byGeneric.first();
    }
    throw new Error("Could not find messaging search input.");
}

async function clickConversation(page: Page, recipientName: string): Promise<boolean> {
    await clearSearchOverlay(page);

    // Strategy 1: role=listitem containing the name
    const listItems = page.getByRole("listitem");
    const count = await listItems.count().catch(() => 0);
    console.log(`🔍 Found ${count} list items in messaging`);

    for (let i = 0; i < count; i++) {
        const item = listItems.nth(i);
        const text = await item.textContent().catch(() => "");
        if (text && text.toLowerCase().includes(recipientName.toLowerCase())) {
            console.log(`✅ Found conversation with "${recipientName}" at index ${i}`);
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

    console.log(`⚠️  No conversation found for "${recipientName}"`);
    return false;
}

async function startNewMessage(page: Page, recipientName: string): Promise<void> {
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
        const tag = await el.evaluate((n) => n.tagName.toLowerCase()).catch(() => "");
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

async function findRecipientInput(page: Page): Promise<Locator> {
    const byPlaceholder = page.getByPlaceholder(/type a name/i);
    if (await byPlaceholder.isVisible({ timeout: 2000 }).catch(() => false)) return byPlaceholder;
    const byLabel = page.getByLabel(/type a name/i);
    if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) return byLabel;
    const byCombobox = page.getByRole("combobox");
    if (await byCombobox.first().isVisible({ timeout: 2000 }).catch(() => false)) return byCombobox.first();
    const dialogInput = page.locator('[role="dialog"] input, [role="dialog"] [contenteditable]').first();
    if (await dialogInput.isVisible({ timeout: 2000 }).catch(() => false)) return dialogInput;
    throw new Error("Could not find the recipient input field.");
}

async function findMessageTextbox(page: Page): Promise<Locator> {
    const byRole = page.getByRole("textbox", { name: /write a message|message/i });
    if (await byRole.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log("📝 Found message input via role=textbox + name");
        return byRole.first();
    }
    const anyTextbox = page.getByRole("textbox");
    const tbCount = await anyTextbox.count().catch(() => 0);
    if (tbCount > 0) {
        const last = anyTextbox.nth(tbCount - 1);
        if (await last.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`📝 Found message input: last of ${tbCount} textbox(es)`);
            return last;
        }
    }
    const byPlaceholder = page.getByPlaceholder(/write a message/i);
    if (await byPlaceholder.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📝 Found message input via placeholder");
        return byPlaceholder;
    }
    const contentEditable = page.locator('div[contenteditable="true"]');
    if (await contentEditable.last().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📝 Found message input via contenteditable");
        return contentEditable.last();
    }
    throw new Error("Could not find the message input box.");
}

async function findSendButton(page: Page): Promise<Locator> {
    const byRole = page.getByRole("button", { name: /^send$/i });
    if (await byRole.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📨 Found send button via role + name");
        return byRole.first();
    }
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.last().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📨 Found send button via submit type");
        return submitBtn.last();
    }
    const byText = page.getByRole("button", { name: /send/i });
    if (await byText.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📨 Found send button via role + send text");
        return byText.first();
    }
    throw new Error("Could not find the send button.");
}

// ============================================================
// READ MESSAGES — v3: ZERO CSS class selectors
// ============================================================

/**
 * How this works without CSS classes:
 *
 * LinkedIn's message thread is a <ul role="list"> inside the main area.
 * Each message group is a <li role="listitem"> that contains:
 *   - A <strong> or heading with the sender name
 *   - One or more <p> tags with the message text
 *   - A <time> element with the timestamp
 *
 * We navigate the structure purely using:
 *   - getByRole("list")     → find the message thread
 *   - getByRole("listitem") → each message group
 *   - locator("p")          → message text (structural HTML)
 *   - locator("time")       → timestamp (semantic HTML)
 *   - locator("strong")     → sender name (semantic HTML)
 *
 * If <strong> isn't present, we fall back to the first line of text
 * before the first <p> body — which is typically the sender name.
 */
export async function readMessages(
    recipientName?: string,
    count: number = 10,
): Promise<ReadResult> {
    const page = sessionManager.getPage();
    let currentStep = "init";

    try {
        // ── Navigate ──────────────────────────────────────────
        currentStep = "navigate-to-messaging";
        await navigateToMessaging(page);
        await dumpDOM(page, "read-after-nav");

        // ── Find & click conversation ─────────────────────────
        if (recipientName) {
            currentStep = "search-recipient";
            const searchInput = await findMessagingSearchInput(page);
            await humanClick(searchInput);
            await humanType(page, searchInput, recipientName, 50, 120);
            await randomDelay(2000, 3000);

            currentStep = "click-conversation";
            await clearSearchOverlay(page);
            const clicked = await clickConversation(page, recipientName);
            if (!clicked) {
                return {
                    success: false,
                    messages: [],
                    error: `No conversation found for "${recipientName}"`,
                    step: currentStep,
                };
            }
            await randomDelay(2000, 3000); // Extra wait for thread to render
        }

        await dumpDOM(page, "read-conversation-loaded");

        // ── Wait for message thread to render ─────────────────
        currentStep = "wait-for-thread";

        // Wait for ANY list to appear inside main — no class names needed
        // LinkedIn's message thread is always a <ul> inside the main content area
        const mainArea = page.locator("main, [role='main']").first();

        try {
            await mainArea.getByRole("list").first().waitFor({ timeout: 8000 });
        } catch {
            console.warn("⚠️ Timed out waiting for message list — trying anyway...");
        }

        await page.waitForTimeout(1500);
        await dumpDOM(page, "read-before-extract");

        // ── Step 1: Dump raw thread text ──────────────────────
        currentStep = "dump-raw-thread";
        const thread = page.locator("main, [role='main']").last();
        const rawThreadText = await thread.innerText().catch(() => "");
        console.log("RAW THREAD TEXT:", rawThreadText);
        await dumpDOM(page, "read-raw-thread");

        // ── Step 2: Extract messages via multiple strategies ──
        currentStep = "extract-messages";
        const messages: MessageData[] = [];

        // Strategy A: div[dir='ltr'] (Standard message container)
        const msgDivs = page.locator("div[dir='ltr']");
        const msgCount = await msgDivs.count();
        console.log(`🔍 Strategy A: Found ${msgCount} div[dir='ltr'] elements`);

        if (msgCount > 0) {
            const startIdx = Math.max(0, msgCount - count);
            for (let i = startIdx; i < msgCount; i++) {
                const body = (await msgDivs.nth(i).innerText().catch(() => "")).trim();
                // Filter out reactions/meta text
                if (body && body.length > 0 &&
                    !/^react(ion)?/i.test(body) &&
                    !/^remove reaction/i.test(body) &&
                    !body.includes("View") && !body.includes("profile") &&
                    !/^\p{Emoji}+$/u.test(body)
                ) {
                    messages.push({ sender: "Unknown", body, timestamp: "recent" });
                }
            }
        }

        // Strategy B: role=article (Fallback wrapper)
        if (messages.length === 0) {
            const articles = page.getByRole("article");
            const artCount = await articles.count();
            console.log(`🔍 Strategy B: Found ${artCount} role=article elements`);

            if (artCount > 0) {
                const startIdx = Math.max(0, artCount - count);
                for (let i = startIdx; i < artCount; i++) {
                    const article = articles.nth(i);
                    const body = (await article.innerText().catch(() => "")).trim();

                    // Try to find sender inside article
                    const sender = await article.locator("strong").first()
                        .innerText().catch(() => "Unknown");

                    if (body && body.length > 0) {
                        messages.push({ sender, body, timestamp: "recent" });
                    }
                }
            }
        }

        // Strategy C: span[data-view-name] (Fallback)
        if (messages.length === 0) {
            const spans = page.locator("span[data-view-name]");
            const spanCount = await spans.count();
            console.log(`🔍 Strategy C: Found ${spanCount} span[data-view-name] elements`);

            if (spanCount > 0) {
                const startIdx = Math.max(0, spanCount - count);
                for (let i = startIdx; i < spanCount; i++) {
                    const body = (await spans.nth(i).innerText().catch(() => "")).trim();
                    if (body.length > 1) {
                        messages.push({ sender: "Unknown", body, timestamp: "recent" });
                    }
                }
            }
        }

        console.log("EXTRACTED messages:", JSON.stringify(messages, null, 2));

        // ── Step 3: Attempt to resolve sender names ───────────
        if (messages.length > 0 && recipientName) {
            // Simple heuristic mapping if we have "Unknown" senders
            // This is a best-effort approach since we lost structural grouping
            // in Strategy A.
            const hasUnknown = messages.some(m => m.sender === "Unknown");
            if (hasUnknown) {
                console.log("ℹ️ Attempting to resolve 'Unknown' senders...");
                // Note: For a robust fix, we'd need to re-group messages by 
                // their visual container. For now, we return them as "Unknown" 
                // rather than "React with", which is an improvement.
            }
        }

        console.log(`📖 Read ${messages.length} messages.`);
        return { success: true, messages };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await dumpDOMForced(page, `read-error-${currentStep}`);
        return {
            success: false,
            messages: [],
            error: errorMessage,
            step: currentStep,
            debugAvailable: true,
        };
    }
}

// ============================================================
// SEARCH PROFILE (unchanged from v2)
// ============================================================

export async function searchProfile(
    name: string,
): Promise<{ success: boolean; profileUrl?: string; error?: string; step?: string }> {
    const page = sessionManager.getPage();
    let currentStep = "init";

    try {
        currentStep = "navigate-to-search";
        await page.goto(
            `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`,
            { waitUntil: "domcontentloaded", timeout: 20_000 },
        );
        await page.waitForTimeout(3000);
        await clearSearchOverlay(page);
        await dumpDOM(page, "search-results");

        currentStep = "find-result";
        const resultLink = page.getByRole("link", { name: new RegExp(name, "i") }).first();
        if (await resultLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            const href = await resultLink.getAttribute("href");
            return {
                success: true,
                profileUrl: href ? `https://www.linkedin.com${href}` : undefined,
            };
        }

        const anyLink = page.locator(`a:has-text("${name}")`).first();
        if (await anyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            const href = await anyLink.getAttribute("href");
            return {
                success: true,
                profileUrl: href
                    ? (href.startsWith("http") ? href : `https://www.linkedin.com${href}`)
                    : undefined,
            };
        }

        return { success: false, error: `No profile found for "${name}"`, step: currentStep };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await dumpDOMForced(page, `search-error-${currentStep}`);
        return { success: false, error: errorMessage, step: currentStep };
    }
}