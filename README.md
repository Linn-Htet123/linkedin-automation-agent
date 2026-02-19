# 💼 LinkedIn Digital Twin — AI Automation Agent

> **Larry Task**: An AI-powered LinkedIn outreach agent built on the **OpenClaw** framework, using **Claude 3.5 Sonnet** as the reasoning engine and **Playwright** for browser automation.

## � Setup for Developers

This guide explains how to set up the project locally for development.

### prerequisites

- **Node.js**: v18+
- **npm**: v9+
- **OpenClaw CLI**: (Optional, for advanced features) `npm i -g openclaw`

### 1. Clone & Install

```bash
git clone https://github.com/Linn-Htet123/linkedin-automation-agent.git
cd linkedin-automation-agent

# Install dependencies for root, backend, and frontend
npm install
npm run install:all
```

### 2. Configure Environment

Copy the example environment file in `backend`:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your preferred settings (default values usually work fine).

### 3. Install Browsers

The agent relies on a specialized Chromium build.

```bash
npm run setup:browser
```

### 4. Run the App

Launch the full stack (Electron + Backend + Frontend):

```bash
npm run electron:dev
```

### 5. Login to LinkedIn

1.  Click **"Connect & Launch"** in the app.
2.  A browser window will open. **Log in manually** with your LinkedIn credentials.
3.  Once the "Feed" loads, the agent will detect the session and say "Connected".

---

## 🔌 Integrating with OpenClaw

To use this agent as an **OpenClaw Skill** (allowing control via CLI or voice):

1.  **Install OpenClaw**:

    ```bash
    npm install -g openclaw
    openclaw init
    ```

2.  **Link the Skill**:

    ```bash
    ln -s $(pwd)/skills/linkedin-digital-twin ~/.openclaw/workspace/skills/
    ```

3.  **Run Commands**:
    ```bash
    openclaw "Search for Elon Musk on LinkedIn"
    ```

## 📁 Project Structure

```
linkedin-automation-agent/
├── backend/                    # Express API + Agent Logic
│   ├── src/
│   │   ├── agent/              # OpenClaw wrapping logic
│   │   ├── linkedin/actions/   # Playwright scripts (profile.ts, etc.)
│   │   └── server.ts           # API Entry point
│   └── sessions/               # Saved cookies (gitignored)
├── frontend/                   # Next.js React UI
├── skills/
│   └── linkedin-digital-twin/
│       └── SKILL.md            # OpenClaw configuration file
└── electron/                   # Desktop app wrapper
```

## 🔒 Security

- **Credentials**: Stored only in `.env` (local). Never committed.
- **Session Data**: Cookies saved to `backend/sessions/` (local). Never committed.
- **Browser**: Runs locally on your machine. No data sent to third-party servers (except Anthropic/OpenClaw for reasoning).

## 📝 License

MIT
