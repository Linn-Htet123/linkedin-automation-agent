import { useState, useEffect } from "react";
import { SetupStatus, SetupStep, Account } from "../types";
import { addAccount, installBrowser, fetchAccounts } from "../lib/api";

interface SetupWizardProps {
  initialStatus: SetupStatus | null;
  serverOnline: boolean;
  onComplete: () => void;
  forceStep?: SetupStep;
}

export default function SetupWizard({
  initialStatus,
  serverOnline,
  onComplete,
  forceStep,
}: SetupWizardProps) {
  const [step, setStep] = useState<SetupStep>(() => {
    if (forceStep) return forceStep;
    if (!initialStatus) return "credentials";
    if (!initialStatus.steps.credentials) return "credentials";
    if (!initialStatus.steps.browser) return "browser";
    return "complete";
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    if (serverOnline) {
      setLoadingAccounts(true);
      fetchAccounts()
        .then((res) => setAccounts(res.accounts))
        .catch(() => {})
        .finally(() => setLoadingAccounts(false));
    }
  }, [serverOnline]);

  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState("");

  const handleSaveCredentials = async () => {
    setError("");
    if (!email) {
      setError("Email is required.");
      return;
    }

    setSaving(true);
    try {
      const result = await addAccount({
        email,
      });

      if (result.success) {
        // Refresh accounts
        const accs = await fetchAccounts();
        setAccounts(accs.accounts);
        setEmail("");
        // Don't auto-advance. Let user add more or click continue.
      } else {
        setError(result.error || "Failed to save account.");
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
    { key: "credentials", label: "Accounts", icon: "" },
    { key: "browser", label: "Browser", icon: "" },
    { key: "complete", label: "Ready!", icon: "" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-text">LinkedIn Digital Twin</span>
        </div>
        <p className="app-subtitle">
          Powered by OpenClaw — no terminal needed!
        </p>
      </header>

      {!serverOnline && (
        <div className="warning-banner" id="server-warning">
          <div>
            <strong>Backend server is not running.</strong>
            <p>
              Ask your developer to start the server, then refresh this page.
            </p>
          </div>
        </div>
      )}

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
            <div className="step-circle">{i + 1}</div>
            <span className="step-label">{s.label}</span>
            {i < steps.length - 1 && <div className="step-connector" />}
          </div>
        ))}
      </div>

      <div className="setup-card">
        {step === "credentials" && (
          <div className="setup-step" id="step-credentials">
            <h2 className="setup-title">Manage LinkedIn Accounts</h2>
            <p className="setup-desc">
              Add your LinkedIn accounts. The agent can switch between them.
              Passwords are not stored; you&apos;ll log in securely via browser
              window.
            </p>

            {loadingAccounts ? (
              <p>Loading accounts...</p>
            ) : accounts.length > 0 ? (
              <div className="account-list">
                <h3 className="section-subtitle">Existing Accounts</h3>
                {accounts.map((acc) => (
                  <div key={acc.id} className="account-item">
                    <span className="account-email">{acc.email}</span>
                    {acc.isActive && (
                      <span className="badge-active">Active</span>
                    )}
                  </div>
                ))}
                <div className="divider" />
                <h3 className="section-subtitle">Add Another Account</h3>
              </div>
            ) : null}

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

            {error && <div className="form-error">{error}</div>}

            <div className="btn-row">
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
                  "Add Account & Continue →"
                )}
              </button>

              {accounts.length > 0 && (
                <button
                  className="secondary-btn"
                  onClick={() => setStep("browser")}
                >
                  Continue with Existing →
                </button>
              )}
            </div>
          </div>
        )}

        {step === "browser" && (
          <div className="setup-step" id="step-browser">
            <h2 className="setup-title">Install Browser</h2>
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
                  "Install Chromium"
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
              Launch Agent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
