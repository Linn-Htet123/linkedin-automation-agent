# 💼 LinkedIn Digital Twin — AI Automation Agent

> **Geodo Task**: An AI-powered LinkedIn outreach agent built on the
> **OpenClaw** framework, using **Claude 3.5 Sonnet** as the reasoning
> engine and **Playwright** for browser automation.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Next.js Frontend                   │
│          (Plain English Command Input)              │
│              http://localhost:3000                   │
└───────────────────────┬─────────────────────────────┘
                        │ REST API
                        ▼
┌─────────────────────────────────────────────────────┐
│               Express API Server                    │
│              http://localhost:3001                   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │       Claude 3.5 Sonnet (Agent Brain)        │   │
│  │  • Parses natural language commands           │   │
│  │  • Decides which LinkedIn action to take      │   │
│  │  • Extracts parameters (recipient, message)   │   │
│  │  • Returns human-readable responses           │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │ Tool calls                     │
│                     ▼                                │
│  ┌──────────────────────────────────────────────┐   │
│  │      LinkedIn Actions (Playwright)            │   │
│  │  • sendMessage(recipient, text)               │   │
│  │  • readMessages(person?, count)               │   │
│  │  • searchProfile(name)                        │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │ Browser automation             │
│                     ▼                                │
│  ┌──────────────────────────────────────────────┐   │
│  │        Session Manager (Playwright)           │   │
│  │  • Manages login / session persistence        │   │
│  │  • Saves cookies to disk for reuse            │   │
│  │  • Handles CAPTCHA / 2FA fallback             │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │    LinkedIn     │
              │   (Browser)     │
              └─────────────────┘
```

## 📁 Project Structure

```
linkedin-automation-agent/
├── backend/                    # Express API + Claude AI + Playwright
│   ├── src/
│   │   ├── config/             # Environment validation (Zod)
│   │   │   └── index.ts
│   │   ├── agent/              # Claude AI reasoning engine
│   │   │   └── index.ts        # Tool definitions + agentic loop
│   │   ├── linkedin/
│   │   │   ├── session-manager.ts  # Browser session persistence
│   │   │   ├── actions.ts          # CSS selectors + action functions
│   │   │   └── login.ts            # Standalone login script
│   │   └── server.ts           # Express API server
│   ├── sessions/               # Saved browser sessions (gitignored)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Next.js React app
│   └── src/app/
│       ├── layout.tsx
│       ├── page.tsx            # Chat UI
│       └── globals.css         # Design system
├── skills/
│   └── linkedin-digital-twin/
│       └── SKILL.md            # OpenClaw skill definition
├── .gitignore
├── package.json                # Root orchestrator (runs both)
└── README.md
```

## 🚀 Quick Start

### 1. Clone & Install

```bash
cd linkedin-automation-agent
npm install
npm run install:all
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your Anthropic API key and LinkedIn credentials
```

### 3. Install Playwright Browser

```bash
npm run setup:browser
```

### 4. Login to LinkedIn (one-time)

```bash
npm run linkedin:login
```

This opens a browser window, logs into LinkedIn, and saves the session.
If you see a CAPTCHA or 2FA prompt, complete it in the browser.

### 5. Start the Agent

```bash
npm run dev
```

This starts both the Express server (port 3001) and Next.js frontend
(port 3000). Open http://localhost:3000 to start sending commands.

## 💬 Example Commands

| Command                                                  | What it does                              |
| -------------------------------------------------------- | ----------------------------------------- |
| `Send a message to Nadav saying I have started the task` | Composes and sends a professional message |
| `Read my recent messages from Nadav`                     | Extracts messages from the conversation   |
| `Search for John Smith on LinkedIn`                      | Finds LinkedIn profiles                   |
| `Tell Sarah I'll be 10 minutes late for our call`        | Expands shorthand into a polished message |

## 🔌 OpenClaw Integration

### How This Fits Into OpenClaw

OpenClaw uses a **Skills** system — each skill is a folder with a
`SKILL.md` file that tells the AI agent what it can do.

Our skill lives at:

```
skills/linkedin-digital-twin/SKILL.md
```

**Entry points for adding a new OpenClaw skill/provider:**

1. **Skill Definition** (`SKILL.md`): YAML frontmatter with `name`,
   `description`, and `metadata` (including requirements like
   `browser.enabled`). The markdown body contains instructions for the
   agent.

2. **Skill Location**: Place in `~/.openclaw/workspace/skills/` (per-agent)
   or `~/.openclaw/skills/` (shared across agents).

3. **Configuration** (`~/.openclaw/openclaw.json`): Enable the skill and
   inject any needed environment variables:

   ```json
   {
     "skills": {
       "entries": {
         "linkedin-digital-twin": {
           "enabled": true,
           "env": {
             "ANTHROPIC_API_KEY": "sk-ant-...",
             "LINKEDIN_EMAIL": "...",
             "LINKEDIN_PASSWORD": "..."
           }
         }
       }
     }
   }
   ```

4. **Browser Tool**: OpenClaw has built-in browser control via CDP. Our
   skill can leverage `openclaw browser` commands or use Playwright
   directly.

### Installing as an OpenClaw Skill

```bash
# Copy the skill to your OpenClaw workspace
cp -r skills/linkedin-digital-twin ~/.openclaw/workspace/skills/

# Or link it
ln -s $(pwd)/skills/linkedin-digital-twin ~/.openclaw/workspace/skills/
```

## 🔒 Security Notes

- **Credentials**: Never commit `.env` to git. LinkedIn credentials are
  used only for the initial login.
- **Sessions**: Saved browser sessions (cookies) are stored locally in
  `backend/sessions/` and are gitignored.
- **Browser Fingerprint**: We set a realistic User-Agent and viewport to
  minimize detection.
- **Rate Limiting**: Add delays between actions to avoid triggering
  LinkedIn's anti-automation measures.

## 🛠️ Technical Details

### CSS Selectors Strategy

LinkedIn updates its DOM frequently. All selectors are centralized in
`backend/src/linkedin/actions.ts` in the `SELECTORS` constant object, with
multiple fallback selectors for each element. When LinkedIn updates,
you only need to update this one file.

### Claude Tool Use (Function Calling)

The agent uses Claude's tool-use feature with three defined tools:

- `send_linkedin_message` — recipient + message text
- `read_linkedin_messages` — optional person filter + count
- `search_linkedin_profile` — name query

Claude decides which tool to call based on the user's natural language
input, creating an **agentic loop** that continues until all actions
are complete.

## 📝 License

MIT
