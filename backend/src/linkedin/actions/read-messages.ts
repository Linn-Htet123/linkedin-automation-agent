/**
 * Read Messages Action
 *
 * Scrapes messages from the LinkedIn messaging interface
 * using semantic locators (no brittle CSS classes).
 */

import { sessionManager } from "../session-manager.js";
import { navigateToMessaging, clearSearchOverlay } from "../utils/navigation.js";
import { findMessagingSearchInput } from "../utils/locators.js";
import { humanClick, humanType, randomDelay } from "../../utils/humanDelay.js";
import { dumpDOM, dumpDOMForced } from "../../utils/domDump.js";

// Types derived from original actions.ts
export interface MessageData {
    sender: string;
    body: string;
    timestamp: string;
}

export interface ReadResult {
    success: boolean;
    messages: MessageData[];
    error?: string;
    step?: string;
    debugAvailable?: boolean;
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

export async function readMessages(
    recipientName?: string,
    count: number = 10,
): Promise<ReadResult> {
    const page = sessionManager.getPage();
    let currentStep = "init";

    try {
        // Navigate
        currentStep = "navigate-to-messaging";
        await navigateToMessaging(page);
        await dumpDOM(page, "read-after-nav");

        // Find & click conversation
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
            await randomDelay(2000, 3000); // Wait for thread to render
        }

        await dumpDOM(page, "read-conversation-loaded");

        // Wait for message thread to render
        currentStep = "wait-for-thread";

        const mainArea = page.locator("main, [role='main']").first();

        try {
            await mainArea.getByRole("list").first().waitFor({ timeout: 8000 });
        } catch {
            console.warn("Timed out waiting for message list — trying anyway...");
        }

        await page.waitForTimeout(1500);
        await dumpDOM(page, "read-before-extract");

        // Dump raw thread text
        currentStep = "dump-raw-thread";
        const thread = page.locator("main, [role='main']").last();
        const rawThreadText = await thread.innerText().catch(() => "");
        console.log("RAW THREAD TEXT:", rawThreadText);
        await dumpDOM(page, "read-raw-thread");

        // Extract messages via multiple strategies
        currentStep = "extract-messages";
        const messages: MessageData[] = [];

        // Strategy A: div[dir='ltr'] (Standard message container)
        const msgDivs = page.locator("div[dir='ltr']");
        const msgCount = await msgDivs.count();
        console.log(`Strategy A: Found ${msgCount} div[dir='ltr'] elements`);

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
            console.log(`Strategy B: Found ${artCount} role=article elements`);

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
            console.log(`Strategy C: Found ${spanCount} span[data-view-name] elements`);

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

        if (messages.length > 0 && recipientName) {
            /* 
               Note: For a robust fix, we'd need to re-group messages by 
               their visual container. For now, we return them as "Unknown".
            */
            const hasUnknown = messages.some(m => m.sender === "Unknown");
            if (hasUnknown) {
                console.log("Attempting to resolve 'Unknown' senders...");
            }
        }

        console.log(`Read ${messages.length} messages.`);
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
