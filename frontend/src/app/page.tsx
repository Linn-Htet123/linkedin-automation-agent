"use client";

import { useState, useEffect } from "react";
import { SetupStatus, AppScreen, AgentStatus } from "../types";
import { fetchSetupStatus, checkAgentStatus } from "../lib/api";
import LoadingScreen from "../components/LoadingScreen";
import SetupWizard from "../components/SetupWizard";
import MainApp from "../components/MainApp";

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>("loading");
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("checking");
  const [serverOnline, setServerOnline] = useState(false);
  // Track why we entered setup: 'initial' (default) or 'add_account' (explicit)
  const [setupMode, setSetupMode] = useState<"initial" | "add_account">(
    "initial",
  );

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
        forceStep={setupMode === "add_account" ? "credentials" : undefined}
        onComplete={() => {
          setScreen("main");
          setAgentStatus("offline");
          setSetupMode("initial"); // Reset mode
        }}
      />
    );
  }

  return (
    <MainApp
      agentStatus={agentStatus}
      setAgentStatus={setAgentStatus}
      setupStatus={setupStatus}
      onGoToSetup={(mode) => {
        if (mode === "add_account") setSetupMode("add_account");
        else setSetupMode("initial");
        setScreen("setup");
      }}
    />
  );
}
