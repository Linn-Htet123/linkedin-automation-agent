"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================
// Types
// ============================================================

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  actions?: ActionInfo[];
  step?: string;
  debugAvailable?: boolean;
  timestamp: Date;
}

interface ActionInfo {
  tool: string;
  input: Record<string, unknown>;
  success: boolean;
  step?: string;
  debugAvailable?: boolean;
}

interface SetupStatus {
  steps: {
    credentials: boolean;
    browser: boolean;
    session: boolean;
  };
  email: string;
  allComplete: boolean;
}

type AppScreen = "loading" | "setup" | "main";
type AgentStatus = "checking" | "offline" | "ready" | "initializing";
type SetupStep = "credentials" | "browser" | "complete";

// ============================================================
// API Client
// ============================================================

const API_BASE = "http://localhost:3001";

async function fetchSetupStatus(): Promise<SetupStatus> {
  const res = await fetch(`${API_BASE}/api/setup/status`);
  return res.json();
}

async function saveCredentials(data: {
  linkedinEmail: string;
  linkedinPassword: string;
  anthropicApiKey: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  const res = await fetch(`${API_BASE}/api/setup/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function installBrowser(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/api/setup/browser`, {
    method: "POST",
  });
  return res.json();
}

async function checkAgentStatus(): Promise<{
  status: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/status`);
  return res.json();
}

async function initializeAgent(): Promise<{
  status: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/init`, { method: "POST" });
  return res.json();
}

async function sendCommand(command: string): Promise<{
  success: boolean;
  response: string;
  actions?: ActionInfo[];
  error?: string;
  step?: string;
  debugAvailable?: boolean;
}> {
  const res = await fetch(`${API_BASE}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  return res.json();
}

// ============================================================
// Utility
// ============================================================

function formatToolName(tool: string): string {
  return tool
    .replace(/_/g, " ")
    .replace(/linkedin/i, "LinkedIn")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// ============================================================
// Main App Component
// ============================================================

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>("loading");
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("checking");
  const [serverOnline, setServerOnline] = useState(false);

  // On mount: check if server is online and what state we're in
  useEffect(() => {
    const check = async () => {
      try {
        const [setup, agent] = await Promise.all([
          fetchSetupStatus(),
          checkAgentStatus(),
        ]);
        setServerOnline(true);
        setSetupStatus(setup);

        if (agent.status === "ready") {
          setAgentStatus("ready");
          setScreen("main");
        } else if (setup.allComplete) {
          setAgentStatus("offline");
          setScreen("main");
        } else {
          setScreen("setup");
        }
      } catch {
        // Server not running — show setup anyway
        setServerOnline(false);
        setScreen("setup");
      }
    };
    check();
  }, []);

  if (screen === "loading") {
    return <LoadingScreen />;
  }

  if (screen === "setup") {
    return (
      <SetupWizard
        initialStatus={setupStatus}
        serverOnline={serverOnline}
        onComplete={() => {
          setScreen("main");
          setAgentStatus("offline");
        }}
      />
    );
  }

  return (
    <MainApp
      agentStatus={agentStatus}
      setAgentStatus={setAgentStatus}
      setupStatus={setupStatus}
      onGoToSetup={() => setScreen("setup")}
    />
  );
}

// ============================================================
// Loading Screen
// ============================================================

function LoadingScreen() {
  return (
    <div className="app-container loading-screen">
      <div className="loading-spinner">
        <div className="spinner-ring" />
      </div>
      <p className="loading-text">Connecting to agent server...</p>
    </div>
  );
}

// ============================================================
// Setup Wizard
// ============================================================

function SetupWizard({
  initialStatus,
  serverOnline,
  onComplete,
}: {
  initialStatus: SetupStatus | null;
  serverOnline: boolean;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<SetupStep>(() => {
    if (!initialStatus) return "credentials";
    if (!initialStatus.steps.credentials) return "credentials";
    if (!initialStatus.steps.browser) return "browser";
    return "complete";
  });

  // Credentials form state
  const [email, setEmail] = useState(initialStatus?.email || "");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Browser install state
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState("");

  const handleSaveCredentials = async () => {
    setError("");
    if (!email || !password || !apiKey) {
      setError("All fields are required.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveCredentials({
        linkedinEmail: email,
        linkedinPassword: password,
        anthropicApiKey: apiKey,
      });

      if (result.success) {
        setStep("browser");
      } else {
        setError(result.error || "Failed to save credentials.");
      }
    } catch {
      setError(
        "Could not connect to the server. Make sure the backend is running.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleInstallBrowser = async () => {
    setInstalling(true);
    setInstallMessage("");
    setError("");
    try {
      const result = await installBrowser();
      if (result.success) {
        setInstallMessage("✅ " + result.message);
        setTimeout(() => {
          setStep("complete");
        }, 1500);
      } else {
        setError(result.error || "Installation failed.");
      }
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setInstalling(false);
    }
  };

  const handleSkipBrowser = () => {
    setStep("complete");
  };

  const steps = [
    { key: "credentials", label: "Credentials", icon: "🔑" },
    { key: "browser", label: "Browser", icon: "🌐" },
    { key: "complete", label: "Ready!", icon: "🚀" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">💼</div>
          <span className="app-logo-text">LinkedIn Digital Twin</span>
        </div>
        <p className="app-subtitle">
          Let&apos;s get you set up — no terminal needed!
        </p>
      </header>

      {/* Server Status Warning */}
      {!serverOnline && (
        <div className="warning-banner" id="server-warning">
          <span className="warning-icon">⚠️</span>
          <div>
            <strong>Backend server is not running.</strong>
            <p>
              Ask your developer to start the server, then refresh this page.
            </p>
          </div>
        </div>
      )}

      {/* Step Progress */}
      <div className="step-progress">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className={`step-item ${
              i < currentIndex
                ? "step-done"
                : i === currentIndex
                  ? "step-active"
                  : "step-pending"
            }`}
          >
            <div className="step-circle">{i < currentIndex ? "✓" : s.icon}</div>
            <span className="step-label">{s.label}</span>
            {i < steps.length - 1 && <div className="step-connector" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="setup-card">
        {step === "credentials" && (
          <div className="setup-step" id="step-credentials">
            <h2 className="setup-title">🔑 Enter Your Credentials</h2>
            <p className="setup-desc">
              We need your LinkedIn login and Claude API key to power the
              automation. These are saved locally on your machine — never sent
              to any third party.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="input-email">
                LinkedIn Email
              </label>
              <input
                id="input-email"
                type="email"
                className="form-input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="input-password">
                LinkedIn Password
              </label>
              <div className="form-input-wrapper">
                <input
                  id="input-password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Your LinkedIn password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  id="toggle-password"
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="input-api-key">
                Claude API Key
              </label>
              <div className="form-input-wrapper">
                <input
                  id="input-api-key"
                  type={showApiKey ? "text" : "password"}
                  className="form-input"
                  placeholder="sk-ant-api03-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowApiKey(!showApiKey)}
                  id="toggle-api-key"
                >
                  {showApiKey ? "🙈" : "👁️"}
                </button>
              </div>
              <p className="form-hint">
                Get your API key from{" "}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button
              className="primary-btn"
              onClick={handleSaveCredentials}
              disabled={saving || !serverOnline}
              id="save-credentials-btn"
            >
              {saving ? (
                <>
                  <span className="btn-spinner" /> Saving...
                </>
              ) : (
                "Save & Continue →"
              )}
            </button>
          </div>
        )}

        {step === "browser" && (
          <div className="setup-step" id="step-browser">
            <h2 className="setup-title">🌐 Install Browser</h2>
            <p className="setup-desc">
              We need to install a Chromium browser that the agent uses to
              interact with LinkedIn. This is a one-time download (~150MB).
            </p>

            {installMessage && (
              <div className="success-banner">{installMessage}</div>
            )}

            {error && <div className="form-error">{error}</div>}

            <div className="btn-row">
              <button
                className="primary-btn"
                onClick={handleInstallBrowser}
                disabled={installing}
                id="install-browser-btn"
              >
                {installing ? (
                  <>
                    <span className="btn-spinner" /> Installing... (may take a
                    minute)
                  </>
                ) : (
                  "📦 Install Chromium"
                )}
              </button>

              <button
                className="secondary-btn"
                onClick={handleSkipBrowser}
                disabled={installing}
                id="skip-browser-btn"
              >
                Skip (already installed)
              </button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="setup-step setup-step--complete" id="step-complete">
            <div className="complete-icon">🎉</div>
            <h2 className="setup-title">You&apos;re All Set!</h2>
            <p className="setup-desc">
              Everything is configured. Click below to launch the agent and
              start automating your LinkedIn outreach.
            </p>

            <button
              className="primary-btn primary-btn--large"
              onClick={onComplete}
              id="launch-agent-btn"
            >
              🚀 Launch Agent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main App (Init + Chat)
// ============================================================

function MainApp({
  agentStatus,
  setAgentStatus,
  setupStatus,
  onGoToSetup,
}: {
  agentStatus: AgentStatus;
  setAgentStatus: (s: AgentStatus) => void;
  setupStatus: SetupStatus | null;
  onGoToSetup: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Auto-resize textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    },
    [],
  );

  // Initialize
  const handleInit = async () => {
    setAgentStatus("initializing");
    try {
      const data = await initializeAgent();
      if (
        data.status === "initialized" ||
        data.status === "already_initialized"
      ) {
        setAgentStatus("ready");
        addAgentMessage(
          '🎉 LinkedIn session connected! I\'m ready to help with your outreach. Try something like:\n\n• "Send a message to John saying I\'d love to connect"\n• "Read my recent messages"\n• "Search for Jane Smith on LinkedIn"',
        );
      } else {
        setAgentStatus("offline");
        addAgentMessage(
          "⏳ Initialization in progress. Please wait a moment and try again.",
        );
      }
    } catch {
      setAgentStatus("offline");
      addAgentMessage(
        "❌ Could not connect to the agent server. Please check if the backend is running.",
      );
    }
  };

  // Messages
  const addAgentMessage = (
    content: string,
    actions?: ActionInfo[],
    step?: string,
    debugAvailable?: boolean,
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `agent-${Date.now()}`,
        role: "agent",
        content,
        actions,
        step,
        debugAvailable,
        timestamp: new Date(),
      },
    ]);
  };

  // Send command
  const handleSend = async () => {
    const command = input.trim();
    if (!command || isProcessing) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: command,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    setIsProcessing(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const data = await sendCommand(command);
      if (data.success) {
        addAgentMessage(data.response, data.actions);
      } else {
        addAgentMessage(
          `❌ ${data.error || "Unknown error occurred."}`,
          data.actions,
          data.step,
          data.debugAvailable,
        );
      }
    } catch {
      addAgentMessage("❌ Could not reach the agent server. Is it running?");
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: "💬 Send a message", cmd: "Send a message to " },
    { label: "📖 Read messages", cmd: "Read my recent LinkedIn messages" },
    { label: "🔍 Search profile", cmd: "Search for " },
  ];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header app-header--compact">
        <div className="header-row">
          <div className="app-logo">
            <div className="app-logo-icon">💼</div>
            <span className="app-logo-text">LinkedIn Digital Twin</span>
          </div>
          <div className="header-actions">
            <div
              className={`status-badge ${
                agentStatus === "ready"
                  ? "status-badge--ready"
                  : agentStatus === "initializing" || agentStatus === "checking"
                    ? "status-badge--loading"
                    : "status-badge--offline"
              }`}
            >
              <span className="status-dot" />
              {agentStatus === "ready" && "Connected"}
              {agentStatus === "checking" && "Checking..."}
              {agentStatus === "offline" && "Disconnected"}
              {agentStatus === "initializing" && "Connecting..."}
            </div>
            <button
              className="icon-btn"
              onClick={onGoToSetup}
              title="Settings"
              id="settings-btn"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* Init Section (shown when agent is not ready) */}
      {agentStatus !== "ready" && agentStatus !== "checking" && (
        <section className="init-section">
          <div className="init-icon">🔗</div>
          <h2 className="init-title">Connect to LinkedIn</h2>
          <p className="init-description">
            Launch the browser and connect to your LinkedIn account.
            {!setupStatus?.steps.credentials && (
              <>
                {" "}
                <button className="link-btn" onClick={onGoToSetup}>
                  Set up credentials first →
                </button>
              </>
            )}
          </p>
          <button
            className="primary-btn primary-btn--large"
            onClick={handleInit}
            disabled={agentStatus === "initializing"}
            id="init-button"
          >
            {agentStatus === "initializing" ? (
              <>
                <span className="btn-spinner" /> Connecting to LinkedIn...
              </>
            ) : (
              "🚀 Connect & Launch"
            )}
          </button>
          {agentStatus === "initializing" && (
            <p className="init-hint">
              A browser window will open. You may need to complete a CAPTCHA or
              2FA challenge.
            </p>
          )}
        </section>
      )}

      {/* Chat Area */}
      {agentStatus === "ready" && (
        <>
          <div className="chat-area">
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">💬</div>
                <p className="empty-state-text">
                  What would you like to do on LinkedIn?
                </p>
                <div className="quick-actions-grid">
                  {quickActions.map((qa, i) => (
                    <button
                      key={i}
                      className="quick-action-card"
                      onClick={() => {
                        setInput(qa.cmd);
                        inputRef.current?.focus();
                      }}
                      id={`quick-action-${i}`}
                    >
                      <span className="qa-label">{qa.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message chat-message--${msg.role}`}
              >
                <div className={`chat-avatar chat-avatar--${msg.role}`}>
                  {msg.role === "user" ? "👤" : "🤖"}
                </div>
                <div className="chat-bubble">
                  <div className="chat-sender">
                    {msg.role === "user" ? "You" : "LinkedIn Agent"}
                  </div>
                  <div className="chat-content">
                    <div className="chat-text">{msg.content}</div>

                    {/* Action badges */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="action-badges">
                        {msg.actions.map((action, i) => (
                          <span
                            key={i}
                            className={`action-badge ${
                              action.success
                                ? "action-badge--success"
                                : "action-badge--error"
                            }`}
                          >
                            {action.success ? "✓" : "✗"}{" "}
                            {formatToolName(action.tool)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Step info for failures */}
                    {msg.step && (
                      <div className="step-info">
                        Failed at step: <code>{msg.step}</code>
                        {msg.debugAvailable && (
                          <span className="debug-badge">
                            Debug dumps available
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {isProcessing && (
              <div className="chat-message chat-message--agent">
                <div className="chat-avatar chat-avatar--agent">🤖</div>
                <div className="chat-bubble">
                  <div className="thinking-indicator">
                    <div className="thinking-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    Thinking & executing actions...
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="input-dock">
            <div className="command-input-wrapper">
              <textarea
                ref={inputRef}
                className="command-input"
                placeholder="Tell me what to do on LinkedIn..."
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                rows={1}
                id="command-input"
              />
              <button
                className="command-submit-btn"
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                id="send-button"
              >
                {isProcessing ? "⏳" : "➤"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
