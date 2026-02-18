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
  timestamp: Date;
}

interface ActionInfo {
  tool: string;
  input: Record<string, unknown>;
  success: boolean;
}

type AgentStatus = "checking" | "offline" | "ready" | "initializing";

// ============================================================
// API Client
// ============================================================

const API_BASE = "http://localhost:3001";

async function checkStatus(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/status`);
  return res.json();
}

async function initializeAgent(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/init`, { method: "POST" });
  return res.json();
}

async function sendCommand(command: string): Promise<{
  success: boolean;
  response: string;
  actions?: ActionInfo[];
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  return res.json();
}

// ============================================================
// Tool name formatting
// ============================================================

function formatToolName(tool: string): string {
  return tool
    .replace(/_/g, " ")
    .replace(/linkedin/i, "LinkedIn")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// ============================================================
// Main Page Component
// ============================================================

export default function Home() {
  const [status, setStatus] = useState<AgentStatus>("checking");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---- Auto-scroll to bottom ----
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // ---- Check agent status on mount ----
  useEffect(() => {
    const check = async () => {
      try {
        const data = await checkStatus();
        setStatus(data.status === "ready" ? "ready" : "offline");
      } catch {
        setStatus("offline");
      }
    };
    check();
  }, []);

  // ---- Auto-resize textarea ----
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    },
    [],
  );

  // ---- Initialize agent ----
  const handleInit = async () => {
    setStatus("initializing");
    try {
      const data = await initializeAgent();
      if (
        data.status === "initialized" ||
        data.status === "already_initialized"
      ) {
        setStatus("ready");
        addAgentMessage(
          "🎉 LinkedIn session initialized! I'm ready to help with your outreach.",
        );
      } else {
        setStatus("offline");
        addAgentMessage(
          "⚠️ Initialization in progress. Please wait a moment and try again.",
        );
      }
    } catch {
      setStatus("offline");
      addAgentMessage(
        "❌ Could not connect to the agent server. Make sure the backend is running on port 3001.",
      );
    }
  };

  // ---- Add messages ----
  const addUserMessage = (content: string): void => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      },
    ]);
  };

  const addAgentMessage = (content: string, actions?: ActionInfo[]): void => {
    setMessages((prev) => [
      ...prev,
      {
        id: `agent-${Date.now()}`,
        role: "agent",
        content,
        actions,
        timestamp: new Date(),
      },
    ]);
  };

  // ---- Send command ----
  const handleSend = async () => {
    const command = input.trim();
    if (!command || isProcessing) return;

    addUserMessage(command);
    setInput("");
    setIsProcessing(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const data = await sendCommand(command);
      if (data.success) {
        addAgentMessage(data.response, data.actions);
      } else {
        addAgentMessage(`❌ Error: ${data.error || "Unknown error occurred."}`);
      }
    } catch {
      addAgentMessage("❌ Could not reach the agent server. Is it running?");
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  // ---- Handle Enter key ----
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---- Quick actions ----
  const quickActions = [
    "Send a message to Nadav saying I have started the task",
    "Read my recent LinkedIn messages",
    "Search for Nadav on LinkedIn",
    "Send a follow-up to my last conversation",
  ];

  const handleQuickAction = (action: string) => {
    setInput(action);
    inputRef.current?.focus();
  };

  // ---- Render ----
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">💼</div>
          <span className="app-logo-text">LinkedIn Digital Twin</span>
        </div>
        <p className="app-subtitle">
          AI-powered LinkedIn outreach • Powered by Claude & OpenClaw
        </p>

        {/* Status Badge */}
        <div
          className={`status-badge ${
            status === "ready"
              ? "status-badge--ready"
              : status === "initializing" || status === "checking"
                ? "status-badge--loading"
                : "status-badge--offline"
          }`}
        >
          <span className="status-dot" />
          {status === "ready" && "Connected"}
          {status === "checking" && "Checking..."}
          {status === "offline" && "Not Connected"}
          {status === "initializing" && "Initializing..."}
        </div>
      </header>

      {/* Init Section (shown when not ready) */}
      {status !== "ready" && status !== "checking" && (
        <section className="init-section">
          <div className="init-icon">🔑</div>
          <h2 className="init-title">Initialize LinkedIn Session</h2>
          <p className="init-description">
            Connect your LinkedIn account to start sending and reading messages.
            Make sure you&apos;ve run the login script first (
            <code>npm run linkedin:login</code>).
          </p>
          <button
            className="init-btn"
            onClick={handleInit}
            disabled={status === "initializing"}
            id="init-button"
          >
            {status === "initializing"
              ? "Connecting..."
              : "🚀 Initialize Agent"}
          </button>
        </section>
      )}

      {/* Command Input */}
      {status === "ready" && (
        <section className="command-section">
          <div className="command-input-wrapper">
            <textarea
              ref={inputRef}
              className="command-input"
              placeholder="Type a command... e.g. 'Send a message to Nadav saying I have started the task'"
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
              {isProcessing ? "⏳" : "▶"} Send
            </button>
          </div>

          {/* Quick Actions */}
          {messages.length === 0 && (
            <div className="quick-actions">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  className="quick-action-btn"
                  onClick={() => handleQuickAction(action)}
                  id={`quick-action-${i}`}
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Chat Area */}
      <div className="chat-area">
        {messages.length === 0 && status === "ready" && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <p className="empty-state-text">No messages yet</p>
            <p className="empty-state-hint">
              Try a quick action above or type your own command
            </p>
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
                {msg.content}

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
                Agent is thinking & executing actions...
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
