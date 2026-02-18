---
name: linkedin-digital-twin
description: >
  LinkedIn Digital Twin agent for Geodo — send messages, read
  conversations, and search profiles on LinkedIn using plain English
  commands. Powered by Claude 3.5 Sonnet + Playwright browser automation.
metadata:
  {
    "openclaw":
      {
        "emoji": "💼",
        "homepage": "https://github.com/geodo/linkedin-agent",
        "requires": { "config": ["browser.enabled"] },
        "os": ["darwin", "linux"],
      },
  }
---

# LinkedIn Digital Twin Skill

You are a LinkedIn outreach assistant (Digital Twin). You can perform
the following actions on behalf of the user by executing scripts in the
skill directory.

## Available Actions

### 1. Send a LinkedIn Message

When the user asks to send a message to someone on LinkedIn, run the
send-message script:

```bash
cd {baseDir}/../../backend && npx tsx src/linkedin/actions.ts send --to "<name>" --message "<text>"
```

### 2. Read LinkedIn Messages

When the user asks to read messages or check conversations:

```bash
cd {baseDir}/../../backend && npx tsx src/linkedin/actions.ts read --from "<name>" --count <N>
```

### 3. Search LinkedIn Profiles

When the user asks to find someone on LinkedIn:

```bash
cd {baseDir}/../../backend && npx tsx src/linkedin/actions.ts search --name "<query>"
```

## How It Works

This skill uses **Playwright** for browser automation to interact with
LinkedIn's web interface. It:

1. Maintains a persistent browser session (saved cookies) so you don't
   need to log in every time.
2. Uses CSS selectors and ARIA labels to identify UI elements (message
   input box, send button, etc.).
3. Passes natural language commands to **Claude 3.5 Sonnet** which
   decides which action to take and extracts the parameters.

## Setup

1. Install dependencies: `npm run install:all` (in the project root)
2. Copy `backend/.env.example` to `backend/.env` and fill in your credentials
3. Run the login script: `npm run linkedin:login`
4. Start the server: `npm run dev`

## Security Notes

- LinkedIn credentials are stored in `backend/.env` (never committed to git)
- Browser sessions are saved locally in `backend/sessions/`
- All automation runs on your local machine
- The skill requires `browser.enabled` in OpenClaw configuration
