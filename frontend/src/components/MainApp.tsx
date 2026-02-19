import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChatMessage,
  ActionInfo,
  AgentStatus,
  SetupStatus,
  Account,
} from "../types";
import {
  initializeAgent,
  sendCommand,
  fetchAccounts,
  switchAccount,
} from "../lib/api";
import LogLoader from "./LogLoader";

interface MainAppProps {
  agentStatus: AgentStatus;
  setAgentStatus: (s: AgentStatus) => void;
  setupStatus: SetupStatus | null;
  onGoToSetup: (mode?: "add_account") => void;
}

function formatToolName(tool: string): string {
  return tool
    .replace(/_/g, " ")
    .replace(/linkedin/i, "LinkedIn")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function MainApp({
  agentStatus,
  setAgentStatus,
  setupStatus,
  onGoToSetup,
}: MainAppProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const activeAccount = accounts.find((a) => a.isActive);

  useEffect(() => {
    fetchAccounts().then((res) => setAccounts(res.accounts));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    },
    [],
  );

  const handleSwitchAccount = async (accountId: string) => {
    setShowAccountMenu(false);
    try {
      const res = await switchAccount(accountId);
      if (res.success) {
        setAgentStatus("initializing"); // Re-init needed
        // Update local state
        setAccounts((prev) =>
          prev.map((a) => ({
            ...a,
            isActive: a.id === accountId,
          })),
        );

        const initRes = await initializeAgent();
        if (
          initRes.status === "initialized" ||
          initRes.status === "already_initialized"
        ) {
          setAgentStatus("ready");
          addAgentMessage(`✅ Switched to account: ${accountId}`);
        } else {
          setAgentStatus("offline");
          addAgentMessage(
            `❌ Switched account but failed to initialize session.`,
          );
        }
      } else {
        addAgentMessage(`❌ Failed to switch account: ${res.error}`);
      }
    } catch (err) {
      addAgentMessage(`❌ Error switching account.`);
    }
  };

  const handleInit = async () => {
    setAgentStatus("initializing");
    const maxRetries = 5;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const data = await initializeAgent();
        if (
          data.status === "initialized" ||
          data.status === "already_initialized"
        ) {
          setAgentStatus("ready");
          // No initial message - show empty state with actions instead
          return;
        } else {
          // If response is good but status is not ready, maybe wait and retry or just show offline
          // For now, let's treat it as a temporary failure if it says initializing
          if (attempts === maxRetries - 1) {
            setAgentStatus("offline");
            addAgentMessage(
              "⏳ Initialization in progress. Please wait a moment and try again.",
            );
          }
        }
      } catch (err) {
        console.warn(`Connection attempt ${attempts + 1} failed.`);
      }

      attempts++;
      if (attempts < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000)); // Wait 2s
      }
    }

    setAgentStatus("offline");
    addAgentMessage(
      "❌ Could not connect to the agent server. Please check if the backend is running.",
    );
  };

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
    { label: "Send a message", cmd: "Send a message to " },
    { label: "Read messages", cmd: "Read my recent LinkedIn messages" },
    { label: "Search profile", cmd: "Search for " },
  ];

  return (
    <div className="app-container">
      <header className="app-header app-header--compact">
        <div className="header-row">
          <div className="app-logo">
            <span className="app-logo-text">LinkedIn Digital Twin</span>
          </div>
          <div className="header-actions">
            <div className="account-switcher">
              <button
                className="account-btn"
                onClick={() => setShowAccountMenu(!showAccountMenu)}
              >
                <span className="account-avatar">
                  {activeAccount?.email?.charAt(0).toUpperCase() || "?"}
                </span>
                <span className="account-name">
                  {activeAccount?.email || "No Account"}
                </span>
              </button>

              {showAccountMenu && (
                <div className="account-menu">
                  <div className="menu-header">Switch Account</div>
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      className={`menu-item ${acc.isActive ? "active" : ""}`}
                      onClick={() => handleSwitchAccount(acc.id)}
                    >
                      <span className="menu-item-icon">
                        {acc.isActive ? "(active)" : ""}
                      </span>
                      {acc.email}
                    </button>
                  ))}
                  <div className="menu-divider" />
                  <button
                    className="menu-item menu-item-add"
                    onClick={() => onGoToSetup("add_account")}
                  >
                    + Add another account
                  </button>
                </div>
              )}
            </div>

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
          </div>
        </div>
      </header>

      {agentStatus !== "ready" && agentStatus !== "checking" && (
        <section className="init-section">
          <h2 className="init-title">Connect to LinkedIn</h2>
          <p className="init-description">
            Launch the browser and connect to your LinkedIn account (
            <strong>{activeAccount?.email}</strong>).
            {!setupStatus?.steps.credentials && (
              <>
                {" "}
                <button className="link-btn" onClick={() => onGoToSetup()}>
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
                <span className="btn-spinner" /> Connecting...
              </>
            ) : (
              "Connect & Launch"
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

      {agentStatus === "ready" && (
        <>
          <div className="chat-area">
            {messages.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">
                  What would you like to do on LinkedIn as{" "}
                  <strong>{activeAccount?.email}</strong>?
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
                <div className={`chat-avatar chat-avatar--${msg.role}`}></div>
                <div className="chat-bubble">
                  <div className="chat-sender">
                    {msg.role === "user" ? "You" : "🦞 OpenClaw Agent"}
                  </div>
                  <div className="chat-content">
                    <div className="chat-text">{msg.content}</div>

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
                            {action.success ? "Success" : "Failed"}{" "}
                            {formatToolName(action.tool)}
                          </span>
                        ))}
                      </div>
                    )}

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

            {isProcessing && (
              <div className="chat-message chat-message--agent">
                <div className="chat-avatar chat-avatar--agent"></div>
                <div
                  className="log-loader-wrapper"
                  style={{ width: "100%", maxWidth: "600px" }}
                >
                  <LogLoader />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="input-dock">
            <div className="command-input-wrapper">
              <textarea
                ref={inputRef}
                className="command-input"
                placeholder={`Tell me what to do on LinkedIn as ${activeAccount?.email}...`}
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
                id="send-cmd-btn"
                aria-label="Send message"
              >
                {isProcessing ? "..." : <SendIcon />}
              </button>
            </div>
            <p className="input-hint">
              <strong>Tip:</strong> You can ask to read messages, send replies,
              or search for profiles.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  );
}
