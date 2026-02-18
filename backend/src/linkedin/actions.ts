/**
 * LinkedIn Actions Module — v2 (Resilient Locators)
 *
 * Complete rewrite using Playwright's semantic locator API instead of
 * brittle CSS class selectors. LinkedIn auto-generates class names and
 * changes them on every deploy — this version uses:
 *
 *   - getByRole()        → buttons, textboxes, search inputs
 *   - getByPlaceholder() → input fields
 *   - getByText()        → links, labels, conversation names
 *   - getByLabel()       → labeled inputs
 *
 * Includes:
 *   - DOM dump debugging at every step (gated by DEBUG=true)
 *   - Human-like typing delays
 *   - Retry logic (max 2 retries)
 *   - Structured error reporting with step names
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

/**
 * Remove LinkedIn's global search typeahead overlay that intercepts
 * all pointer events across the entire page.
 */
async function clearSearchOverlay(page: Page): Promise<void> {
    try {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);

        await page.evaluate(() => {
            // Blur whatever has focus
            (document.activeElement as HTMLElement)?.blur();

            // Nuke the search overlay that blocks everything
            document.querySelectorAll<HTMLElement>(
                ".search-global-typeahead__overlay, .search-global-typeahead-hit"
            ).forEach((el) => {
                el.style.display = "none";
                el.style.pointerEvents = "none";
            });
        });
    } catch {
        // Ignore — page may not be ready
    }
}

/**
 * Dismiss common LinkedIn overlays/modals/toasts using resilient locators.
 */
async function dismissOverlays(page: Page): Promise<void> {
    await clearSearchOverlay(page);

    // Use semantic locators to find dismiss/close buttons
    const dismissPatterns = [/dismiss/i, /close/i, /got it/i, /not now/i, /skip/i];

    for (const pattern of dismissPatterns) {
        try {
            const btn = page.getByRole("button", { name: pattern });
            if (await btn.first().isVisible({ timeout: 500 }).catch(() => false)) {
                await btn.first().click({ force: true });
                console.log(`🗑️  Dismissed overlay matching: ${pattern}`);
                await page.waitForTimeout(500);
            }
        } catch {
            // Not present — that's fine
        }
    }
}

// ============================================================
// NAVIGATION
// ============================================================

/**
 * Navigate to LinkedIn Messaging and wait for the page to stabilize.
 */
async function navigateToMessaging(page: Page): Promise<void> {
    console.log("📨 Navigating to LinkedIn Messaging...");
    await page.goto("https://www.linkedin.com/messaging/", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
    });

    // Wait for initial render
    await page.waitForTimeout(2000);

    // Dismiss overlays
    await clearSearchOverlay(page);
    await dismissOverlays(page);

    // Wait for the page to settle — try networkidle with a safety timeout
    try {
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
    } catch {
        // Networkidle can hang on heavy pages — just continue
    }

    // Final overlay clear
    await clearSearchOverlay(page);

    console.log(`📍 URL: ${page.url()}`);
    console.log("✅ Messaging page loaded.");
}

// ============================================================
// CORE: sendMessage  (with retry logic)
// ============================================================

/**
 * Send a message to a LinkedIn connection.
 * Uses Playwright's resilient locator API throughout.
 *
 * Wrapped in retry logic: max 2 retries on failure.
 */
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

        const result = await sendMessageAttempt(
            recipientName,
            messageText,
            attempt,
        );

        if (result.success) {
            return result;
        }

        lastError = result.message;
        lastStep = result.step || "unknown";
        if (result.debugFiles) {
            allDebugFiles.push(...result.debugFiles);
        }
    }

    // All retries exhausted
    console.error(`❌ All ${MAX_RETRIES + 1} attempts failed.`);
    return {
        success: false,
        message: `Failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`,
        step: lastStep,
        debugAvailable: allDebugFiles.length > 0,
        debugFiles: allDebugFiles,
    };
}

/**
 * Single attempt to send a message.
 */
async function sendMessageAttempt(
    recipientName: string,
    messageText: string,
    attempt: number,
): Promise<ActionResult> {
    const page = sessionManager.getPage();
    const debugFiles: string[] = [];
    let currentStep = "init";

    try {
        console.log(`📤 Sending message to "${recipientName}"... (attempt ${attempt})`);

        // ── Step 1: Navigate to messaging ─────────────────────
        currentStep = "navigate-to-messaging";
        await navigateToMessaging(page);
        debugFiles.push(...await dumpDOM(page, `${attempt}-after-nav`));

        // ── Step 2: Dismiss overlays ──────────────────────────
        currentStep = "dismiss-overlays";
        await dismissOverlays(page);

        // ── Step 3: Find and use the messaging search input ───
        currentStep = "find-search-input";
        debugFiles.push(...await dumpDOM(page, `${attempt}-before-search`));

        const searchInput = await findMessagingSearchInput(page);
        await clearSearchOverlay(page);

        // ── Step 4: Type recipient name with human-like delay ─
        currentStep = "type-recipient-name";
        await humanClick(searchInput);
        await searchInput.fill(""); // Clear first
        await humanType(page, searchInput, recipientName, 50, 120);
        await randomDelay(2000, 3500); // Wait for search results

        await clearSearchOverlay(page);
        debugFiles.push(...await dumpDOM(page, `${attempt}-after-search`));

        // ── Step 5: Click on the matching conversation ────────
        currentStep = "find-recipient";
        const conversationClicked = await clickConversation(page, recipientName);

        if (!conversationClicked) {
            // Try starting a new message via compose flow
            currentStep = "compose-new-message";
            console.log("📝 No existing conversation found. Starting new message...");
            await startNewMessage(page, recipientName);
        }

        await randomDelay(1500, 2500);
        await clearSearchOverlay(page);
        debugFiles.push(...await dumpDOM(page, `${attempt}-conversation-loaded`));

        // ── Step 6: Find the message input ────────────────────
        currentStep = "find-message-input";
        const msgInput = await findMessageTextbox(page);

        // ── Step 7: Type the message ──────────────────────────
        currentStep = "type-message";
        await humanClick(msgInput);
        await randomDelay(300, 600);
        await humanType(page, msgInput, messageText, 30, 100);
        await randomDelay(400, 800);

        debugFiles.push(...await dumpDOM(page, `${attempt}-before-send`));

        // ── Step 8: Find and click the send button ────────────
        currentStep = "click-send";
        await clearSearchOverlay(page);
        const sendBtn = await findSendButton(page);
        await humanClick(sendBtn);
        await randomDelay(1000, 2000);

        debugFiles.push(...await dumpDOM(page, `${attempt}-after-send`));

        // ── Success! ──────────────────────────────────────────
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

        // Always dump on error, regardless of DEBUG flag
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
// LOCATOR HELPERS — Resilient element finding
// ============================================================

/**
 * Find the messaging search input using resilient locators.
 * Tries multiple strategies: placeholder, label, role.
 */
async function findMessagingSearchInput(page: Page): Promise<Locator> {
    // Strategy 1: Search by placeholder text
    const byPlaceholder = page.getByPlaceholder(/search messages/i);
    if (await byPlaceholder.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via placeholder");
        return byPlaceholder;
    }

    // Strategy 2: Search by aria-label
    const byLabel = page.getByLabel(/search messages/i);
    if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via label");
        return byLabel;
    }

    // Strategy 3: Search by role
    const byRole = page.getByRole("searchbox");
    if (await byRole.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via role=searchbox");
        return byRole.first();
    }

    // Strategy 4: Generic search input
    const byGenericPlaceholder = page.getByPlaceholder(/search/i);
    // Scope to the messaging area — not the global nav search
    const messagingArea = page.locator("main, .scaffold-layout, [role='main']").first();
    const scopedSearch = messagingArea.getByPlaceholder(/search/i);
    if (await scopedSearch.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via scoped search placeholder");
        return scopedSearch.first();
    }

    // Strategy 5: Any visible input inside messaging content area
    if (await byGenericPlaceholder.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("🔍 Found search input via generic placeholder");
        return byGenericPlaceholder.first();
    }

    throw new Error(
        "Could not find messaging search input. " +
        "LinkedIn may have changed their messaging interface."
    );
}

/**
 * Click on a conversation that matches the recipient name.
 * Uses text-based matching instead of CSS class selectors.
 *
 * @returns true if a conversation was found and clicked
 */
async function clickConversation(
    page: Page,
    recipientName: string,
): Promise<boolean> {
    await clearSearchOverlay(page);

    // Strategy 1: Find a list item whose text contains the recipient name
    // LinkedIn messaging shows conversations as list items
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

    // Strategy 2: Use getByText to find a link or element with the name
    try {
        const nameLink = page.getByText(recipientName, { exact: false }).first();
        if (await nameLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`✅ Found "${recipientName}" via getByText`);
            await clearSearchOverlay(page);
            await humanClick(nameLink);
            return true;
        }
    } catch {
        // Not found via text
    }

    // Strategy 3: Try clicking any anchor that contains the name
    try {
        const links = page.locator(`a:has-text("${recipientName}")`);
        if (await links.first().isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`✅ Found "${recipientName}" via anchor text`);
            await clearSearchOverlay(page);
            await humanClick(links.first());
            return true;
        }
    } catch {
        // Not found
    }

    console.log(`⚠️  No conversation found for "${recipientName}"`);
    return false;
}

/**
 * Start a new message via the compose flow.
 */
async function startNewMessage(page: Page, recipientName: string): Promise<void> {
    await clearSearchOverlay(page);

    // Find the compose/new message button
    const composeBtn =
        page.getByRole("button", { name: /compose|new message|write/i }).first();

    // Fallback: look for a link to /messaging/new/
    const composeLink = page.locator('a[href*="/messaging/new"]').first();

    let found = false;
    if (await composeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await humanClick(composeBtn);
        found = true;
    } else if (await composeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await humanClick(composeLink);
        found = true;
    }

    if (!found) {
        throw new Error(
            "Could not find the 'Compose message' or 'New message' button."
        );
    }

    await randomDelay(1500, 2500);
    await clearSearchOverlay(page);
    await dumpDOM(page, "compose-dialog-opened");

    // Find recipient input
    const recipientInput = await findRecipientInput(page);

    // Type name with human delays
    await humanType(page, recipientInput, recipientName, 60, 140);
    await randomDelay(2000, 3000);

    await dumpDOM(page, "compose-recipient-typed");

    // Click the first suggestion using semantic locators
    await clearSearchOverlay(page);

    // Try multiple strategies to find suggestions
    const suggestion =
        page.getByRole("option").first()       // ARIA combobox option
        || page.getByRole("listitem").first();  // Generic list item in dropdown

    // Strategy 1: role=option
    if (await page.getByRole("option").first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await humanClick(page.getByRole("option").first());
        return;
    }

    // Strategy 2: Any element containing the recipient name in the dropdown
    const nameMatch = page.getByText(recipientName, { exact: false });
    const matchCount = await nameMatch.count().catch(() => 0);
    if (matchCount > 0) {
        // Find the one that looks like a suggestion (not the input itself)
        for (let i = 0; i < matchCount; i++) {
            const el = nameMatch.nth(i);
            const tag = await el.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
            if (tag !== "input" && tag !== "textarea") {
                await humanClick(el);
                return;
            }
        }
    }

    // Strategy 3: Use role=listbox children
    if (await page.getByRole("listbox").isVisible({ timeout: 2000 }).catch(() => false)) {
        const firstOption = page.getByRole("listbox").locator("> *").first();
        if (await firstOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await humanClick(firstOption);
            return;
        }
    }

    throw new Error(
        `No matching contact found for "${recipientName}". ` +
        `Make sure you are connected with this person on LinkedIn.`
    );
}

/**
 * Find the recipient input in the compose dialog using resilient locators.
 */
async function findRecipientInput(page: Page): Promise<Locator> {
    // Strategy 1: By placeholder
    const byPlaceholder = page.getByPlaceholder(/type a name/i);
    if (await byPlaceholder.isVisible({ timeout: 2000 }).catch(() => false)) {
        return byPlaceholder;
    }

    // Strategy 2: By label
    const byLabel = page.getByLabel(/type a name/i);
    if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
        return byLabel;
    }

    // Strategy 3: By role combobox (typeahead inputs)
    const byCombobox = page.getByRole("combobox");
    if (await byCombobox.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        return byCombobox.first();
    }

    // Strategy 4: Any input that appeared recently in a dialog/modal
    const dialogInput = page.locator('[role="dialog"] input, [role="dialog"] [contenteditable]').first();
    if (await dialogInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        return dialogInput;
    }

    throw new Error("Could not find the recipient input field in compose dialog.");
}

/**
 * Find the message textbox using resilient locators.
 * LinkedIn uses contenteditable divs with role="textbox".
 */
async function findMessageTextbox(page: Page): Promise<Locator> {
    // Strategy 1: textbox role with message-related name
    const byRole = page.getByRole("textbox", { name: /write a message|message/i });
    if (await byRole.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log("📝 Found message input via role=textbox + name");
        return byRole.first();
    }

    // Strategy 2: Any visible textbox (there should be one in the conversation view)
    const anyTextbox = page.getByRole("textbox");
    const tbCount = await anyTextbox.count().catch(() => 0);
    // Pick the LAST textbox — usually the message input is below the conversation
    if (tbCount > 0) {
        const lastTextbox = anyTextbox.nth(tbCount - 1);
        if (await lastTextbox.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`📝 Found message input: last of ${tbCount} textbox(es)`);
            return lastTextbox;
        }
    }

    // Strategy 3: By placeholder
    const byPlaceholder = page.getByPlaceholder(/write a message/i);
    if (await byPlaceholder.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📝 Found message input via placeholder");
        return byPlaceholder;
    }

    // Strategy 4: By label
    const byLabel = page.getByLabel(/write a message/i);
    if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📝 Found message input via label");
        return byLabel;
    }

    // Strategy 5: contenteditable div (fallback)
    const contentEditable = page.locator('div[contenteditable="true"]');
    if (await contentEditable.last().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📝 Found message input via contenteditable");
        return contentEditable.last();
    }

    throw new Error(
        "Could not find the message input box. " +
        "LinkedIn may have changed their messaging interface."
    );
}

/**
 * Find the send button using resilient locators.
 */
async function findSendButton(page: Page): Promise<Locator> {
    // Strategy 1: button with name "Send"
    const byRole = page.getByRole("button", { name: /^send$/i });
    if (await byRole.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📨 Found send button via role + name 'Send'");
        return byRole.first();
    }

    // Strategy 2: button with aria-label containing "send"
    const byLabel = page.getByLabel(/send/i);
    const labelCount = await byLabel.count().catch(() => 0);
    for (let i = 0; i < labelCount; i++) {
        const el = byLabel.nth(i);
        const tag = await el.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
        if (tag === "button") {
            console.log("📨 Found send button via label");
            return el;
        }
    }

    // Strategy 3: submit button (form-based)
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.last().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📨 Found send button via submit type");
        return submitBtn.last();
    }

    // Strategy 4: button whose text is "Send"
    const byText = page.locator('button:has-text("Send")');
    if (await byText.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("📨 Found send button via text content");
        return byText.first();
    }

    throw new Error(
        "Could not find the send button. " +
        "LinkedIn may have changed their messaging interface."
    );
}

// ============================================================
// READ MESSAGES
// ============================================================

/**
 * Read recent messages from a conversation or the messaging page.
 */
export async function readMessages(
    recipientName?: string,
    count: number = 10,
): Promise<ReadResult> {
    const page = sessionManager.getPage();
    let currentStep = "init";

    try {
        currentStep = "navigate-to-messaging";
        await navigateToMessaging(page);
        await dumpDOM(page, "read-after-nav");

        // If a specific person is requested, search and click
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
            await randomDelay(1500, 2500);
        }

        await dumpDOM(page, "read-conversation-loaded");

        // Extract messages from the thread using resilient selectors
        currentStep = "extract-messages";
        const messages: MessageData[] = [];

        // Detect if we are on the messaging page
        const mainArea = page.locator("main, .scaffold-layout__main, [role='main']").first();
        if (!await mainArea.isVisible({ timeout: 5000 }).catch(() => false)) {
            throw new Error("Could not find the main messaging area. Page might not have loaded.");
        }

        // Strategy: The message list is usually the only 'list' inside the 'main' content area
        // or it has a specific class/aria-label.
        let msgList = mainArea.getByRole("list").first();

        // If there are multiple lists in main, try to find the one that looks like a message thread
        // often aria-label="Message list" or similar
        const lists = await mainArea.getByRole("list").all();
        if (lists.length > 1) {
            // Try to find one with "message" in label
            for (const list of lists) {
                const label = await list.getAttribute("aria-label") || "";
                if (label.toLowerCase().includes("message")) {
                    msgList = list;
                    break;
                }
            }
            // Fallback: usually the last list in main is the chat
            msgList = lists[lists.length - 1];
        }

        // Get all items from this specific list
        const msgItems = msgList.locator("li");
        const totalItems = await msgItems.count().catch(() => 0);
        console.log(`🔍 Found ${totalItems} items in the conversation thread.`);

        // Take the last N items
        const startIdx = Math.max(0, totalItems - count);
        for (let i = startIdx; i < totalItems; i++) {
            const item = msgItems.nth(i);

            // Scroll into view to ensure text content is rendered (virtualization)
            await item.scrollIntoViewIfNeeded().catch(() => { });

            const text = (await item.innerText().catch(() => ""))?.trim() || "";

            if (text.length > 0) {
                // Improved extraction:
                // 1. Try to find the message body specifically in a <p> tag (LinkedIn standard)
                const bodyEl = item.locator("p").first();
                let body = "";

                if (await bodyEl.isVisible().catch(() => false)) {
                    body = (await bodyEl.innerText().catch(() => ""))?.trim() || "";
                }

                // fallback if <p> not found or empty
                if (!body) {
                    // removing known UI noise
                    const lines = text.split("\n")
                        .map(l => l.trim())
                        .filter(l =>
                            l.length > 0 &&
                            !l.match(/^(Remove reaction|Reaction|Reply|•|Edited)$/i) &&
                            !l.match(/^\d+$/) // ignore single numbers (reaction counts)
                        );

                    if (lines.length >= 2) {
                        body = lines.slice(1).join("\n").trim();
                    } else if (lines.length === 1) {
                        body = lines[0];
                    }
                }

                // extracting sender name
                // usually the first strong text or the first line
                // or specific class .msg-s-message-group__name
                let sender = "Unknown";
                const senderEl = item.locator(".msg-s-message-group__name, .msg-s-event-listitem__name").first();
                if (await senderEl.isVisible().catch(() => false)) {
                    sender = (await senderEl.innerText().catch(() => ""))?.trim() || "Unknown";
                } else {
                    // heuristic: first line if body was found separately
                    const lines = text.split("\n");
                    if (lines.length > 0) sender = lines[0].trim();
                }

                // Filter out empty messages or just reaction metadata
                if (body && body !== "Remove reaction" && !body.match(/^\d+$/)) {
                    messages.push({
                        sender: sender,
                        body: body,
                        timestamp: "recent",
                    });
                }
            }
        }

        console.log(`📖 Successfully extracted ${messages.length} messages.`);
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
// SEARCH PROFILE
// ============================================================

/**
 * Search for a LinkedIn profile by name.
 */
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

        // Strategy 1: Find the first link in search results that contains the name
        const resultLink = page.getByRole("link", { name: new RegExp(name, "i") }).first();
        if (await resultLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            const href = await resultLink.getAttribute("href");
            return {
                success: true,
                profileUrl: href ? `https://www.linkedin.com${href}` : undefined,
            };
        }

        // Strategy 2: Find any link whose text contains the name
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
