# Deployment Guide for LinkedIn Automation Agent

This guide will help you set up the LinkedIn Automation Agent on a new computer (e.g., a VPS or another laptop).

## Prerequisites

- **Node.js**: Version 20 or higher (required for Playwright).
- **OpenClaw**: Installed and configured on the machine.
- **Git**: To clone the repository.
- **Headless Environment (Optional)**: If deploying to a VPS without a screen, ensure you install system dependencies for Chromium.

## Installation Steps

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/larry/linkedin-automation-agent.git
    cd linkedin-automation-agent
    ```

2.  **Install Dependencies**

    Install dependencies for both frontend and backend:

    ```bash
    npm install
    npm run install:all
    ```

3.  **Configure Environment**

    Create the `.env` file in the `backend` directory:

    ```bash
    cp backend/.env.example backend/.env
    ```

    Open `backend/.env` and add your **Anthropic API Key**. You can verify your LinkedIn email is correct, but **do not** add your password.

    ```bash
    ANTHROPIC_API_KEY=sk-ant-...
    LINKEDIN_EMAIL=your.email@example.com
    ```

4.  **Install Browser**

    Download the Chromium browser required for automation:

    ```bash
    npm run setup:browser
    ```

    _Note: If on Linux/VPS, you may need to install system deps:_
    `npx playwright install-deps chromium`

5.  **Initial Login (Critical Step)**

    The agent does **not** know your password. You must log in manually once to save the session.

    ```bash
    npm run linkedin:login
    ```

    - A browser window will open.
    - Enter your password and complete any 2FA/CAPTCHA challenges.
    - Wait for the "Login successful!" message in the terminal.
    - Close the browser. The session is now saved to `backend/sessions/`.

    _Note: If on a headless VPS, you may need to copy the `backend/sessions` folder from your local machine to the server via SCP/SFTP._

## Running the Agent

Start the application (Frontend + Backend):

```bash
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

## Integrating with OpenClaw

To let OpenClaw control this agent:

1.  **Link the Skill**:

    ```bash
    ln -s $(pwd)/skills/linkedin-digital-twin ~/.openclaw/workspace/skills/
    ```

2.  **Verify**:
    OpenClaw should now detect the "LinkedIn Digital Twin" skill and use the exposed CLI tools to perform actions.
