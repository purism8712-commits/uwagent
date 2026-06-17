"use client";

import styles from "./components.module.css";
import type { AuthSession } from "@/lib/session";

type HeroSectionProps = {
  userSession?: AuthSession | null;
  onLogout?: () => void;
};

export function HeroSection({ userSession, onLogout }: HeroSectionProps) {
  return (
    <section className={styles.heroGrid}>
      <div className={styles.heroPanel}>
        <div className={styles.heroContent}>
          <span className={styles.heroEyebrow}>Common Core Wizard</span>
          <h1 className={styles.heroTitle}>신계약 인수기준 반영 Agent</h1>
          <p className={styles.heroDescription}>
            변경된 엑셀, 표, 자연어 입력을 공통 양식 초안으로 정리하고 검토메모와
            확인 질문까지 이어서 처리하는 내부 업무용 데스크톱 에이전트입니다.
          </p>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.heroStatCard}>
            <span className={styles.heroStatLabel}>지원 입력</span>
            <span className={styles.heroStatValue}>엑셀 · 표 · 자연어</span>
          </div>
          <div className={styles.heroStatCard}>
            <span className={styles.heroStatLabel}>출력 흐름</span>
            <span className={styles.heroStatValue}>초안 생성 → 검토 질문</span>
          </div>
          <div className={styles.heroStatCard}>
            <span className={styles.heroStatLabel}>상태 기준</span>
            <span className={styles.heroStatValue}>초안 / 검토 필요</span>
          </div>
        </div>

        {userSession ? (
          <div className={styles.heroSessionCard}>
            <div className={styles.heroSessionCopy}>
              <span className={styles.heroSessionLabel}>로그인 정보</span>
              <strong className={styles.heroSessionName}>
                {userSession.name} · {userSession.department}
              </strong>
              <span className={styles.heroSessionMeta}>사번 {userSession.employeeId}</span>
            </div>
            <button className={styles.heroSessionButton} type="button" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
