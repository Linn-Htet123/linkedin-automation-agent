---
name: linkedin
description: "LinkedIn automation via browser: send direct messages, read conversations, and search profiles. Use when: (1) user wants to send a LinkedIn message to someone, (2) user wants to read or check LinkedIn messages/conversations, (3) user wants to search for a person on LinkedIn. Requires the LinkedIn backend to be running (npm run dev in linkedin-automation-agent) and initialized."
---

# LinkedIn Skill

Automate LinkedIn actions via a local Playwright browser session.

## Prerequisites

The LinkedIn backend must be running before using these tools:

```bash
cd ~/Workspace/linkedin-automation-agent
npm run dev
```

Then initialize the session (one-time after each restart):

```bash
curl -X POST http://localhost:3001/api/init
```

## Tools

### `linkedin_send_message`

Send a direct message to a LinkedIn connection.

**When to use:** User says things like:

- "Send a message to John on LinkedIn saying I'm interested"
- "Tell Myo Hsat on LinkedIn that I've started the project"
- "Message Sarah Smith: let's catch up"

**Tip:** Expand casual instructions into professional, friendly LinkedIn messages.

### `linkedin_read_messages`

Read recent LinkedIn messages, optionally from a specific person.

**When to use:** User says things like:

- "Read my LinkedIn messages"
- "What did Myo Hsat say on LinkedIn?"
- "Check my recent LinkedIn conversations"

### `linkedin_search_profile`

Search for a person's LinkedIn profile by name.

**When to use:** User says things like:

- "Search for Jane Smith on LinkedIn"
- "Find John Doe's LinkedIn profile"
- "Look up Myo Hsat on LinkedIn"

## Error Handling

If a tool returns a backend error, check:

1. Is `npm run dev` running in the `linkedin-automation-agent` directory?
2. Has the session been initialized? (`POST http://localhost:3001/api/init`)
3. Is LinkedIn logged in? (Check the browser window that opens during init)
