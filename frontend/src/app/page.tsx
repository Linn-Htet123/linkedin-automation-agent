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
