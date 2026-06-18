"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./components.module.css";
import { readAuthSession } from "@/lib/session";
import type { AuthSession } from "@/lib/session";
import AgentHubPage from "@/components/agent-hub-page";

type GateState = "loading" | "authorized" | "redirecting";

export default function AgentHubGate() {
  const router = useRouter();
  const [state, setState] = useState<GateState>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const storedSession = readAuthSession();
    if (!storedSession) {
      setState("redirecting");
      router.replace("/");
      return;
    }

    setState("authorized");
    setSession(storedSession);
  }, [router]);

  if (state !== "authorized") {
    return (
      <main className={styles.pageShell}>
        <section className={styles.currentGuidelinesCard}>
          <div className={styles.currentGuidelinesCopy}>
            <span className={styles.panelLabel}>로그인 확인</span>
            <h2 className={styles.currentGuidelinesTitle}>새 로컬 Agent 화면으로 이동 중입니다</h2>
            <p className={styles.currentGuidelinesText}>
              로그인 세션을 확인한 뒤 기획·지원·심사를 한 번에 볼 수 있는 로컬 탭 화면을
              불러오고 있습니다.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return <AgentHubPage userSession={session} />;
}
