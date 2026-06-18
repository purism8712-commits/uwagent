"use client";

import { useEffect, useState } from "react";
import AgentHubPage from "@/components/agent-hub-page";
import { readAuthSession, type AuthSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const LOCAL_PREVIEW_SESSION: AuthSession = {
  employeeId: "28172",
  department: "신계약기획P",
  name: "홍수향",
  loggedInAt: new Date("2026-06-18T09:00:00+09:00").toISOString()
};

export default function AgentTabsPage() {
  const [session, setSession] = useState<AuthSession>(LOCAL_PREVIEW_SESSION);

  useEffect(() => {
    const storedSession = readAuthSession();
    if (storedSession) {
      setSession(storedSession);
    }
  }, []);

  return <AgentHubPage userSession={session} />;
}
