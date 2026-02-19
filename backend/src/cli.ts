#!/usr/bin/env node

import { sessionManager } from "./linkedin/session-manager.js";
import { sendMessage } from "./linkedin/actions/send-message.js";
import { readMessages } from "./linkedin/actions/read-messages.js";
import { searchProfile } from "./linkedin/actions/profile.js";

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.error("Usage: cli.ts <command> [options]");
        console.error("Commands:");
        console.error("  send --to <name> --message <text>");
        console.error("  read [--from <name>] [--count <number>]");
        console.error("  search --name <query>");
        process.exit(1);
    }

    try {
        console.log("Initializing session...");
        await sessionManager.initialize();

        switch (command) {
            case "send": {
                const toIndex = args.indexOf("--to");
                const msgIndex = args.indexOf("--message");

                if (toIndex === -1 || msgIndex === -1) {
                    throw new Error("Missing required arguments: --to <name> --message <text>");
                }

                const to = args[toIndex + 1];
                const message = args[msgIndex + 1];

                console.log(`Sending message to ${to}...`);
                const result = await sendMessage(to, message);
                console.log(JSON.stringify(result, null, 2));
                break;
            }

            case "read": {
                let from: string | undefined;
                let count = 5;

                const fromIndex = args.indexOf("--from");
                if (fromIndex !== -1) from = args[fromIndex + 1];

                const countIndex = args.indexOf("--count");
                if (countIndex !== -1) count = parseInt(args[countIndex + 1], 10);

                console.log(`Reading messages ${from ? `from ${from}` : ""}...`);
                const result = await readMessages(from, count);
                console.log(JSON.stringify(result, null, 2));
                break;
            }

            case "search": {
                const nameIndex = args.indexOf("--name");
                if (nameIndex === -1) {
                    throw new Error("Missing required argument: --name <query>");
                }

                const name = args[nameIndex + 1];
                console.log(`Searching for ${name}...`);
                const result = await searchProfile(name);
                console.log(JSON.stringify(result, null, 2));
                break;
            }

            default:
                console.error(`Unknown command: ${command}`);
                process.exit(1);
        }

    } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    } finally {
        await sessionManager.close();
    }
}

main();
