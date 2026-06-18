"use client";

import { useMemo, useState, type ReactNode } from "react";
import { HomePageContent } from "@/components/home-page";
import styles from "./components.module.css";
import { canUseAgentScope } from "@/lib/session";
import type { AuthSession } from "@/lib/session";

type AgentTab = "기획" | "지원" | "심사";

type AgentHubPageProps = {
  userSession?: AuthSession | null;
};

function AgentPreviewCard({
  title,
  description,
  badge,
  children
}: {
  title: string;
  description: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.agentHubPanel}>
      <div className={styles.agentPreviewHeader}>
        <div className={styles.agentPreviewTitleBlock}>
          <span className={styles.agentPreviewIcon}>◎</span>
          <div className={styles.currentGuidelinesCopy}>
            <span className={styles.panelLabel}>연결 화면</span>
            <h2 className={styles.currentGuidelinesTitle}>{title}</h2>
            <p className={styles.currentGuidelinesText}>{description}</p>
          </div>
        </div>
        <span className={styles.agentPreviewBadge}>{badge}</span>
      </div>

      <div className={styles.agentPreviewSurface}>{children}</div>
    </section>
  );
}

function SupportAgentPreview() {
  return (
    <div className={styles.agentPreviewApp}>
      <div className={styles.agentPreviewAppSection}>
        <div className={styles.agentPreviewCardHeader}>
          <h3 className={styles.agentPreviewSectionTitle}>시스템 반영</h3>
          <span className={styles.agentPreviewStatusPill}>지원 Agent</span>
        </div>

        <div className={styles.agentPreviewUploadRow}>
          <div className={styles.agentPreviewUploadInfo}>
            <strong className={styles.agentPreviewUploadFile}>통합 마스터 파일 1건</strong>
            <p className={styles.agentPreviewUploadText}>지원 시스템 반영용 입력 초안으로 정리합니다.</p>
          </div>
          <button className={styles.agentPreviewDisabledButton} type="button">
            엑셀 업로드
          </button>
        </div>

        <p className={styles.agentPreviewHint}>변경 반영 후 시스템 입력 항목을 아래 초안으로 연결합니다.</p>
        <button className={styles.agentPreviewPrimaryButton} type="button">
          시스템 반영 초안 생성
        </button>
      </div>

      <div className={styles.agentPreviewAppSection}>
        <div className={styles.agentPreviewCardHeader}>
          <h3 className={styles.agentPreviewSectionTitle}>반영 결과</h3>
          <span className={styles.agentPreviewEditPill}>검토 가능</span>
        </div>

        <div className={styles.agentPreviewSummaryCard}>
          <span className={styles.agentPreviewFieldLabel}>반영 대상</span>
          <p className={styles.agentPreviewSummaryText}>
            보험코드 기준으로 변경 항목을 시스템 반영용 항목으로 정리합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReviewAgentPreview() {
  return (
    <div className={styles.agentPreviewApp}>
      <div className={styles.agentPreviewAppSection}>
        <div className={styles.agentPreviewCardHeader}>
          <h3 className={styles.agentPreviewSectionTitle}>심사 Agent</h3>
          <span className={styles.agentPreviewStatusPill}>현장공지자료</span>
        </div>

        <div className={styles.agentPreviewUploadRow}>
          <div className={styles.agentPreviewUploadInfo}>
            <strong className={styles.agentPreviewUploadFile}>integrated-master-preview (44).xlsx</strong>
            <p className={styles.agentPreviewUploadText}>로컬 PC에서 선택한 파일이 업로드되었습니다.</p>
          </div>
          <button className={styles.agentPreviewDisabledButton} type="button">
            엑셀 업로드
          </button>
        </div>

        <p className={styles.agentPreviewHint}>시트 6개 인식 / 필수 시트 확인 완료 / 초안 생성 가능</p>
        <button className={styles.agentPreviewPrimaryButton} type="button">
          초안 생성
        </button>
      </div>

      <div className={styles.agentPreviewAppSection}>
        <div className={styles.agentPreviewCardHeader}>
          <h3 className={styles.agentPreviewSectionTitle}>공지 본문</h3>
          <span className={styles.agentPreviewEditPill}>수정 가능</span>
        </div>

        <label className={styles.agentPreviewFieldLabel}>
          제목
          <input
            className={styles.agentPreviewInput}
            value="이번 변경은 워크북에 등록된 변경 이력과 주석을 바탕으로 정리"
            readOnly
          />
        </label>

        <div className={styles.agentPreviewSummaryCard}>
          <span className={styles.agentPreviewFieldLabel}>한줄 요약</span>
          <p className={styles.agentPreviewSummaryText}>
            해당 상품 인수기준 변경안을 안내드립니다. 하단 참고 바랍니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AgentHubPage({ userSession }: AgentHubPageProps) {
  const [activeTab, setActiveTab] = useState<AgentTab>("기획");

  const department = userSession?.department ?? "";
  const canUsePlanning = canUseAgentScope(department, "common-core");
  const canUseSupport = canUseAgentScope(department, "support-agent");
  const canUseReview = canUseAgentScope(department, "review-agent");

  const tabs = useMemo(
    () =>
      [
        { label: "기획", description: "공통 코어 입력/초안", scope: "common-core" as const },
        { label: "지원", description: "지원 Agent 연결", scope: "support-agent" as const },
        { label: "심사", description: "심사 Agent 연결", scope: "review-agent" as const }
      ] satisfies Array<{
        label: AgentTab;
        description: string;
        scope: "common-core" | "support-agent" | "review-agent";
      }>,
    []
  );

  return (
    <main className={styles.pageShell}>
      <section className={styles.agentHubShell}>
        <div className={styles.heroPanel}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>신계약 인수기준 반영 Agent</h1>
            <p className={styles.heroDescription}>
              기획, 지원, 심사를 하나의 로컬 URL에서 확인하고 전환할 수 있는 공통 작업
              화면입니다. 현재 부서에 따라 활성화 범위만 달라집니다.
            </p>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStatCard}>
              <span className={styles.heroStatLabel}>기획 입력</span>
              <span className={styles.heroStatValue}>공통 코어 입력/초안</span>
            </div>
            <div className={styles.heroStatCard}>
              <span className={styles.heroStatLabel}>지원 이동</span>
              <span className={styles.heroStatValue}>지원 Agent 화면</span>
            </div>
            <div className={styles.heroStatCard}>
              <span className={styles.heroStatLabel}>심사 이동</span>
              <span className={styles.heroStatValue}>심사 Agent 화면</span>
            </div>
          </div>
        </div>

        <div className={styles.agentHubTabsWrap}>
          <div className={styles.agentHubTabs} role="tablist" aria-label="에이전트 탭">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.label;
              return (
                <button
                  key={tab.label}
                  className={`${styles.agentHubTabButton} ${isActive ? styles.agentHubTabButtonActive : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.label)}
                >
                  <span className={styles.currentGuidelinesPreviewTabLabel}>{tab.label}</span>
                  <span className={styles.currentGuidelinesPreviewTabMeta}>{tab.description}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.agentHubTabBody}>
            {activeTab === "기획" ? (
              <div className={styles.agentHubTabSection}>
                <div className={styles.agentHubTabIntro}>
                  <span className={styles.panelLabel}>기획 Agent</span>
                  <p className={styles.currentGuidelinesText}>
                    현재 공통 코어 화면입니다. 기준 파일 업로드, 통합 마스터 생성, 검토
                    질문 확인, 초안 생성까지 한 흐름으로 이어집니다.
                  </p>
                </div>
                <HomePageContent userSession={userSession} />
              </div>
            ) : null}

            {activeTab === "지원" ? (
              <AgentPreviewCard
                title="지원 Agent"
                description="지원 파트는 시스템 반영 화면을 미리 보여주는 단계입니다. 실제 연결된 화면의 구조를 이 탭 안에서 먼저 확인할 수 있습니다."
                badge={canUseSupport ? "신계약지원P 활성" : "미리보기"}
              >
                <SupportAgentPreview />
              </AgentPreviewCard>
            ) : null}

            {activeTab === "심사" ? (
              <AgentPreviewCard
                title="심사 Agent"
                description="심사 파트는 현장공지자료 화면만 보이도록 구성했습니다. 요청하신 심사 Agent 부분만 이 영역에 표시됩니다."
                badge={canUseReview ? "신계약심사P 활성" : "미리보기"}
              >
                <ReviewAgentPreview />
              </AgentPreviewCard>
            ) : null}
          </div>

          <div className={styles.agentHubStatusRow}>
            <span className={styles.agentHubStatusPill}>
              현재 허용: {canUsePlanning ? "기획" : canUseSupport ? "지원" : canUseReview ? "심사" : "제한"}
            </span>
            <p className={styles.agentHubStatusText}>
              탭과 설명은 모두 보이도록 유지하고, 버튼 활성화는 부서 기준으로 제어합니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
