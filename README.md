# Larry - LinkedIn Digital Twin

This app is an AI-powered LinkedIn automation agent that acts as your digital twin. It uses **OpenClaw** for reasoning and **Playwright** for browser automation, allowing you to manage LinkedIn interactions via a simple local web interface without mastering complex terminal commands.

## Features

- **Natural Language Commands**: "Check my messages", "Send a connection request to...", etc.
- **Account Management**: Support for multiple LinkedIn accounts with easy switching.
- **Auto-Reconnect**: Automatically recovers lost browser sessions.
- **Secure**: Runs locally on your machine. Passwords are never stored; session cookies are used instead.

## Installation

### Prerequisites

- Node.js (v18 or higher)
- [OpenClaw CLI](https://github.com/StartOpenClaw/openclaw) installed and configured with an AI provider (e.g., Anthropic, OpenAI).

### Step-by-Step Setup

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/Linn-Htet123/linkedin-automation-agent.git
    cd linkedin-automation-agent
    ```

2.  **Install Dependencies**

    ```bash
    npm run install:all
    ```

3.  **Setup Backend Environment**
    Create a `.env` file in the `backend` directory:

    ```bash
    cd backend
    cp .env.example .env
    # Edit .env to add any specific configurations if needed (defaults usually work)

    # Initialize accounts file
    cp data/accounts.example.json data/accounts.json
    cd ..
    ```

4.  **Start the Application**
    This command starts both the backend API and the frontend UI:

    ```bash
    npm run dev
    ```

    - The frontend will be available at `http://localhost:3000`.
    - The backend runs on `http://localhost:3001`.

5.  **Desktop App (Optional)**
    To run as a standalone desktop application:
    ```bash
    npm run electron:dev
    ```

## Usage

1.  Open the app.
2.  Go to **Manage Accounts** and add your LinkedIn account.
3.  Log in via the browser window that appears.
4.  Once setup is complete, start typing commands like "Read my unread messages"!

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
    mkdir -p ~/.openclaw/workspace/skills/
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
