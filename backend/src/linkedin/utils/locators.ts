/**
 * Locator Helpers
 *
 * Strategies to find key UI elements (search boxes, buttons, inputs)
 * robustly across different LinkedIn UI versions.
 */

import type { Page, Locator } from "playwright";

export async function findMessagingSearchInput(page: Page): Promise<Locator> {
    const byPlaceholder = page.getByPlaceholder(/search messages/i);
    if (await byPlaceholder.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found search input via placeholder");
        return byPlaceholder;
    }
    const byLabel = page.getByLabel(/search messages/i);
    if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found search input via label");
        return byLabel;
    }
    const byRole = page.getByRole("searchbox");
    if (await byRole.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found search input via role=searchbox");
        return byRole.first();
    }
    const messagingArea = page.locator("main, [role='main']").first();
    const scopedSearch = messagingArea.getByPlaceholder(/search/i);
    if (await scopedSearch.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found search input via scoped placeholder");
        return scopedSearch.first();
    }
    const byGeneric = page.getByPlaceholder(/search/i);
    if (await byGeneric.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found search input via generic placeholder");
        return byGeneric.first();
    }
    throw new Error("Could not find messaging search input.");
}

export async function findRecipientInput(page: Page): Promise<Locator> {
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

export async function findMessageTextbox(page: Page): Promise<Locator> {
    const byRole = page.getByRole("textbox", { name: /write a message|message/i });
    if (await byRole.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log("Found message input via role=textbox + name");
        return byRole.first();
    }
    const anyTextbox = page.getByRole("textbox");
    const tbCount = await anyTextbox.count().catch(() => 0);
    if (tbCount > 0) {
        const last = anyTextbox.nth(tbCount - 1);
        if (await last.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`Found message input: last of ${tbCount} textbox(es)`);
            return last;
        }
    }
    const byPlaceholder = page.getByPlaceholder(/write a message/i);
    if (await byPlaceholder.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found message input via placeholder");
        return byPlaceholder;
    }
    const contentEditable = page.locator('div[contenteditable="true"]');
    if (await contentEditable.last().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found message input via contenteditable");
        return contentEditable.last();
    }
    throw new Error("Could not find the message input box.");
}

export async function findSendButton(page: Page): Promise<Locator> {
    const byRole = page.getByRole("button", { name: /^send$/i });
    if (await byRole.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found send button via role + name");
        return byRole.first();
    }
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.last().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found send button via submit type");
        return submitBtn.last();
    }
    const byText = page.getByRole("button", { name: /send/i });
    if (await byText.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("Found send button via role + send text");
        return byText.first();
    }
    throw new Error("Could not find the send button.");
}
