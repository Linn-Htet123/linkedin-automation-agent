# Larry — LinkedIn Digital Twin

An AI-powered LinkedIn automation agent that acts as your digital twin.
Uses **OpenClaw** for reasoning and **Playwright** for browser automation.
Control LinkedIn through a local web UI or via CLI — no complex terminal
knowledge required.

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Linn-Htet123/linkedin-automation-agent.git
cd linkedin-automation-agent
```

### 2. Install All Dependencies

```bash
npm run install:all
```

### 3. Install the Playwright Browser

The agent requires a dedicated Chromium build managed by Playwright.
Run this once after cloning:

```bash
npm run setup:browser
```

> **Linux users:** If this fails, you may need system dependencies.
> Run `npx playwright install-deps chromium` and try again.

### 4. Configure the Backend

**macOS / Linux:**

```bash
cd backend
cp .env.example .env
cp data/accounts.example.json data/accounts.json
cd ..
```

**Windows (PowerShell):**

```powershell
cd backend
Copy-Item .env.example .env
Copy-Item data\accounts.example.json data\accounts.json
cd ..
```

Now open `backend/.env` in any text editor and fill in the required fields:

| Key                 | Description                                        |
| ------------------- | -------------------------------------------------- |
| `LINKEDIN_EMAIL`    | Your LinkedIn login email                          |
| `PORT`              | Backend port (default: `3001`)                     |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required for AI reasoning) |

> Your password is **never stored**. `accounts.json` can be left as-is —
> you'll add accounts through the UI in step 6.

### 5. Start the Application

**Web mode** (recommended for first-time setup):

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

**Desktop mode** (optional — wraps the app in an Electron window):

```bash
npm run electron:dev
```

### 6. Log In to LinkedIn

1. Open `http://localhost:3000` in your browser (or use the Electron window)
2. Go to **Manage Accounts** → **Add Account**
3. A browser window will open — log in manually with your LinkedIn credentials
4. Complete any 2FA or CAPTCHA prompts
5. Once your LinkedIn feed loads, the agent detects the session and shows **"Connected"**

Your session cookies are saved to `backend/sessions/` and reused on future runs.
You won't need to log in again unless LinkedIn invalidates the session.

---

## Re-authentication

If the agent reports a session error or "not logged in":

1. Open the app and go to **Manage Accounts**
2. Click **Reconnect** next to the affected account, or run:

```bash
npm run linkedin:login
```

---

## OpenClaw Skill Integration

To control the agent via OpenClaw CLI:

### 1. Install OpenClaw

```bash
npm install -g openclaw
openclaw init
```

### 2. Link the Skill

Run the command for your operating system from the **project root**.

**macOS / Linux:**

```bash
mkdir -p ~/.openclaw/workspace/skills/
ln -s "$(pwd)/skills/linkedin-digital-twin" ~/.openclaw/workspace/skills/
```

**Windows (PowerShell):**

```powershell
$skillsDir = "$env:USERPROFILE\.openclaw\workspace\skills"
New-Item -ItemType Directory -Force -Path $skillsDir
New-Item -ItemType Junction -Path "$skillsDir\linkedin-digital-twin" -Target "$(Get-Location)\skills\linkedin-digital-twin"
```

> **Why a Junction on Windows?** Windows symlinks for directories require
> administrator privileges. Junctions achieve the same result without
> elevated permissions.

### 3. Run Commands

```bash
openclaw "Search for Elon Musk on LinkedIn"
openclaw "Send a message to Jane Doe saying 'Great to connect!'"
openclaw "Read my last 5 messages from John Smith"
```

---

## Project Structure

```
linkedin-automation-agent/
├── backend/                        # Express API + agent logic
│   ├── src/
│   │   ├── agent/                  # OpenClaw integration / reasoning
│   │   ├── linkedin/actions/       # Playwright scripts (send, read, search)
│   │   └── server.ts               # API entry point
│   ├── data/
│   │   └── accounts.json           # Account registry (gitignored)
│   └── sessions/                   # Saved session cookies (gitignored)
├── frontend/                       # Next.js web UI
├── electron/                       # Desktop app wrapper
└── skills/
    └── linkedin-digital-twin/
        └── SKILL.md                # OpenClaw skill definition
```

---

## Security

| What              | Where               | Notes                                          |
| ----------------- | ------------------- | ---------------------------------------------- |
| LinkedIn email    | `backend/.env`      | Never committed (in `.gitignore`)              |
| LinkedIn password | Nowhere             | Entered once in browser; never stored          |
| Session cookies   | `backend/sessions/` | Local only; never committed                    |
| AI reasoning      | Anthropic API       | Only the command text is sent — no credentials |

---

## Troubleshooting

| Problem                                 | Fix                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `Playwright browser not found`          | Run `npm run setup:browser`                                                |
| `Playwright install-deps fails` (Linux) | Run `npx playwright install-deps chromium` then retry                      |
| `Session expired`                       | Go to Manage Accounts → Reconnect                                          |
| `CAPTCHA / 2FA required`                | Complete manually in the browser window                                    |
| `Profile not found`                     | Try a more specific name or include their company                          |
| `Rate limit warning`                    | Stop and wait 30–60 minutes before retrying                                |
| `Port 3001 already in use`              | Change `PORT` in `backend/.env`                                            |
| `Junction creation fails` (Windows)     | Run PowerShell as Administrator and retry                                  |
| `npm run install:all` fails (Windows)   | Ensure Node.js is on your system PATH; reinstall from nodejs.org if needed |

---

## License

MIT
