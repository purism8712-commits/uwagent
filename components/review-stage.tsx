import { useEffect, useMemo, useState } from "react";
import styles from "./components.module.css";
import type { SampleProductOption } from "@/lib/sample-data";
import type { DraftSummary } from "@/lib/draft-builder";
import type { ParsedProductCandidate } from "@/lib/product-candidate-parser";
import type { TargetCandidate } from "@/lib/target-resolution";
import { summarizeTargetCandidate } from "@/lib/target-resolution";
import { buildReviewMemos, buildReviewQuestionGroups } from "@/lib/review-content";

type ReviewStageProps = {
  masterFileNames: string[];
  changeFileNames: string[];
  rawInput: string;
  answers: Record<string, string>;
  isActionDisabled: boolean;
  isSubmitting: boolean;
  isMasterCreated: boolean;
  finalSummary: DraftSummary | null;
  submitError: string;
  productName: string;
  productOptions: SampleProductOption[];
  masterProducts: ParsedProductCandidate[];
  targetCandidates: TargetCandidate[];
  selectedTargetCandidateId: string;
  isDownloadingMaster: boolean;
  isDownloadingProduct: boolean;
  finalUploadStatus: string;
  supportAgentUrl: string;
  reviewAgentUrl: string;
  onOpenSupportAgent?: () => void;
  onOpenReviewAgent?: () => void;
  onAnswerChange: (id: string, value: string) => void;
  onProductNameChange: (value: string) => void;
  onProductSelect: (value: string) => void;
  onTargetCandidateSelect: (id: string) => void;
  onConfirmDraft: () => void;
  onDownloadMaster: () => void;
  onDownloadProduct: () => void;
  onFinalizeUpload: () => void;
};

export function ReviewStage({
  masterFileNames,
  changeFileNames,
  rawInput,
  answers,
  isActionDisabled,
  isSubmitting,
  isMasterCreated,
  finalSummary,
  submitError,
  productName,
  productOptions,
  masterProducts,
  targetCandidates,
  selectedTargetCandidateId,
  isDownloadingMaster,
  isDownloadingProduct,
  finalUploadStatus,
  supportAgentUrl,
  reviewAgentUrl,
  onOpenSupportAgent,
  onOpenReviewAgent,
  onAnswerChange,
  onProductNameChange,
  onProductSelect,
  onTargetCandidateSelect,
  onConfirmDraft,
  onDownloadMaster,
  onDownloadProduct,
  onFinalizeUpload
}: ReviewStageProps) {
  const [isCoreQuestionWindowOpen, setIsCoreQuestionWindowOpen] = useState(false);
  const [isTargetSelectionWindowOpen, setIsTargetSelectionWindowOpen] = useState(false);
  const normalizedKeyword = productName.trim().toLowerCase();
  const matchedProducts = normalizedKeyword
    ? productOptions.filter((product) =>
        [
          product.productName,
          product.productCode ?? "",
          product.saleDate
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword)
      )
    : [];
  const reviewMemos = buildReviewMemos({
    masterFileNames,
    changeFileNames,
    rawInput,
    productName
  });
  const selectedTargetCandidate = useMemo(
    () => targetCandidates.find((candidate) => candidate.id === selectedTargetCandidateId) ?? null,
    [selectedTargetCandidateId, targetCandidates]
  );
  const { coreQuestions, detailQuestions } = useMemo(
    () =>
      buildReviewQuestionGroups(
        {
          masterFileNames,
          changeFileNames,
          rawInput,
          productName,
          masterProducts,
          selectedTargetCandidate
        },
        reviewMemos
      ),
    [
      changeFileNames,
      masterFileNames,
      masterProducts,
      rawInput,
      productName,
      reviewMemos,
      selectedTargetCandidate
    ]
  );
  const coreQuestionSignature = useMemo(
    () => coreQuestions.map((question) => question.id).join("|"),
    [coreQuestions]
  );
  const hasUnansweredCoreQuestion = coreQuestions.some(
    (question) => !(answers[question.id] ?? "").trim()
  );
  const hasUnansweredDetailQuestion = detailQuestions.some(
    (question) => !(answers[question.id] ?? "").trim()
  );
  useEffect(() => {
    if (targetCandidates.length === 1 && !selectedTargetCandidate && !finalSummary) {
      onTargetCandidateSelect(targetCandidates[0].id);
    }
  }, [finalSummary, onTargetCandidateSelect, selectedTargetCandidate, targetCandidates]);
  useEffect(() => {
    const shouldLockScroll = isCoreQuestionWindowOpen || isTargetSelectionWindowOpen;

    if (!shouldLockScroll || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCoreQuestionWindowOpen, isTargetSelectionWindowOpen]);
  useEffect(() => {
    setIsTargetSelectionWindowOpen(targetCandidates.length > 1 && !selectedTargetCandidate && !finalSummary);
    setIsCoreQuestionWindowOpen(coreQuestions.length > 0 && !finalSummary);
  }, [
    coreQuestionSignature,
    finalSummary,
    changeFileNames,
    masterFileNames,
    masterProducts,
    productName,
    rawInput,
    selectedTargetCandidate,
    targetCandidates
  ]);
  const reviewQuestions = detailQuestions;
  const canCloseCoreQuestionWindow = !hasUnansweredCoreQuestion;
  const isQuestionFlowLocked = isCoreQuestionWindowOpen || isTargetSelectionWindowOpen;
  const targetCandidateSummary = selectedTargetCandidate
    ? summarizeTargetCandidate(selectedTargetCandidate)
    : "";
  const beforeValueLabel = finalSummary?.beforeValue.replace(/^단일건\s*/, "") ?? "";
  const afterValueLabel = finalSummary?.afterValue.replace(/^단일건\s*/, "") ?? "";
  const finalSummaryBrief = finalSummary
    ? finalSummary.afterValue === "변경 없음" || beforeValueLabel === afterValueLabel
      ? `답변 ${finalSummary.appliedAnswers.length}개를 반영했지만 ${finalSummary.target} 단일건의 현재 기준값과 변경값이 같아 변경 없음으로 확인했고, 남은 검토 항목은 ${finalSummary.pendingNotes.length}건입니다.`
      : `답변 ${finalSummary.appliedAnswers.length}개를 반영해 ${finalSummary.target} 단일건 한도를 ${beforeValueLabel}에서 ${afterValueLabel}으로 정리했고, 남은 검토 항목은 ${finalSummary.pendingNotes.length}건입니다.`
      : "";

  function handleSupportAgentOpen() {
    if (onOpenSupportAgent) {
      onOpenSupportAgent();
      return;
    }

    window.open(supportAgentUrl, "_blank", "noopener,noreferrer");
  }

  function handleReviewAgentOpen() {
    if (onOpenReviewAgent) {
      onOpenReviewAgent();
      return;
    }

    window.open(reviewAgentUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section className={styles.stepFlowStack}>
      {isTargetSelectionWindowOpen ? (
        <div
          className={styles.coreQuestionOverlay}
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="변경 대상 선택"
        >
          <article className={styles.coreQuestionWindow}>
            <div className={styles.coreQuestionWindowHeader}>
              <div>
                <span className={styles.panelLabel}>변경 대상 확인 창</span>
                <h3 className={styles.panelTitle}>가장 가까운 특약 후보를 먼저 골라 주세요</h3>
              </div>
              <span className={styles.statusPill}>후보 선택 필요</span>
            </div>
            <p className={styles.panelText}>
              자연어 입력에서 여러 특약이 겹쳐 보입니다. 아래 후보 중 실제로 바꿀
              특약과 보험코드를 먼저 선택하면, 그 다음 핵심 질문이 이어집니다.
            </p>

            <div className={styles.targetSelectionList}>
              {targetCandidates.slice(0, 3).map((candidate, index) => (
                <button
                  key={candidate.id}
                  className={styles.targetCandidateCard}
                  type="button"
                  onClick={() => {
                    onTargetCandidateSelect(candidate.id);
                    setIsTargetSelectionWindowOpen(false);
                  }}
                >
                  <span className={styles.targetCandidateRank}>{`후보 ${index + 1}`}</span>
                  <strong className={styles.targetCandidateTitle}>
                    {candidate.specialName || candidate.productName}
                  </strong>
                  <span className={styles.targetCandidateMeta}>
                    {candidate.insuranceCode ? `보험코드 ${candidate.insuranceCode}` : "보험코드 미기재"}
                    {candidate.productCode ? ` · 상품코드 ${candidate.productCode}` : ""}
                  </span>
                  <span className={styles.targetCandidateMeta}>
                    {candidate.productName}
                    {candidate.saleDate ? ` · 판매일자 ${candidate.saleDate}` : ""}
                  </span>
                  <span className={styles.targetCandidateReason}>{candidate.matchReason}</span>
                </button>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {isCoreQuestionWindowOpen ? (
        <div
          className={styles.coreQuestionOverlay}
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="핵심 확인 질문"
        >
          <article className={styles.coreQuestionWindow}>
            <div className={styles.coreQuestionWindowHeader}>
              <div>
                <span className={styles.panelLabel}>서브 확인 창</span>
                <h3 className={styles.coreQuestionTitle}>가장 중요한 변경 확인 질문</h3>
              </div>
              <span className={styles.statusPill}>핵심 확인 필요</span>
            </div>
            <p className={styles.coreQuestionText}>
              변경 대상을 먼저 정확히 맞춘 뒤, 보험코드와 주석 기준의 상세 질문으로
              넘어갑니다.
            </p>
            {targetCandidateSummary ? (
              <p className={styles.coreQuestionFooterCopy}>
                현재 선택된 대상: {targetCandidateSummary}
              </p>
            ) : null}

            <div className={styles.coreQuestionList}>
              {coreQuestions.map((question, index) => (
                <div className={styles.questionRow} key={question.id}>
                  <div className={styles.questionHeader}>
                    <span className={styles.questionLabel}>{question.label}</span>
                    <span className={styles.questionIndex}>{`C${index + 1}`}</span>
                  </div>
                  <p className={styles.questionPrompt}>{question.prompt}</p>
                  <p className={styles.questionHint}>{question.hint}</p>
                  <input
                    className={styles.answerInput}
                    type="text"
                    value={answers[question.id] ?? ""}
                    onChange={(event) => onAnswerChange(question.id, event.target.value)}
                    placeholder="답변을 입력해 주세요."
                  />
                </div>
              ))}
            </div>

            <div className={styles.coreQuestionFooter}>
              <p className={styles.coreQuestionFooterCopy}>
                핵심 질문이 모두 채워지면 아래 상세 질문과 검토 메모가 이어서 열립니다.
              </p>
              <button
                className={`${styles.primaryButton} ${styles.coreQuestionActionButton}`}
                type="button"
                onClick={() => setIsCoreQuestionWindowOpen(false)}
                disabled={!canCloseCoreQuestionWindow}
              >
                핵심 확인 완료
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <article className={`${styles.reviewFlowPanel} ${styles.reviewStageCard}`}>
        <div className={styles.reviewSummaryTop}>
          <div>
            <span className={styles.panelLabel}>STEP 3</span>
            <h2 className={styles.panelTitle}>검토 메모 및 확인질문</h2>
          </div>
          <span className={styles.statusPill}>
            {isCoreQuestionWindowOpen ? "핵심 확인 대기" : "검토 필요 항목 있음"}
          </span>
        </div>

        <p className={styles.panelText}>
          입력한 변경안을 바탕으로 추가 확인이 필요한 질문만 이어서 받습니다.
          질문은 카드 안에서 스크롤되며, 모든 답변이 채워지면 초안을 만들 수 있습니다.
        </p>

        <div className={styles.summaryMeta}>
          <div className={styles.summaryMetaCard}>
            <span className={styles.summaryMetaLabel}>기준 파일</span>
            <span className={styles.summaryMetaValue}>
              {masterFileNames.length > 0
                ? `${masterFileNames.length}개 기준 파일 저장됨`
                : "아직 기준 파일이 없습니다"}
            </span>
          </div>
          <div className={styles.summaryMetaCard}>
            <span className={styles.summaryMetaLabel}>변경 파일</span>
            <span className={styles.summaryMetaValue}>
              {changeFileNames.length > 0
                ? `${changeFileNames.length}개 변경 파일 입력됨`
                : "직접 입력 기반 검토"}
            </span>
          </div>
          <div className={styles.summaryMetaCard}>
            <span className={styles.summaryMetaLabel}>직접 입력 요약</span>
            <span className={styles.summaryMetaValue}>
              {rawInput
                ? `${rawInput.slice(0, 56)}${rawInput.length > 56 ? "..." : ""}`
                : "입력 없음"}
            </span>
          </div>
        </div>

        <div className={styles.reviewQuestionBlock}>
          <div className={styles.reviewQuestionHeader}>
            <h3 className={styles.panelHeading}>추가 확인 질문</h3>
            <p className={styles.questionIntro}>
              핵심 확인 질문을 먼저 마친 뒤, 보험코드와 주석 기준의 상세 질문을
              이어서 확인합니다.
            </p>
          </div>
          {submitError ? <p className={styles.errorBanner}>{submitError}</p> : null}

          <section className={styles.memoBoard} aria-label="검토 메모">
            <div className={styles.memoBoardHeader}>
              <span className={styles.memoBoardTitle}>검토 메모</span>
              <span className={styles.memoBoardCount}>{reviewMemos.length}개</span>
            </div>
            <div className={styles.memoBoardBody}>
              {reviewMemos.map((memo) => (
                <article className={styles.memoRow} key={memo.id}>
                  <div className={styles.memoRowContent}>
                    <h4 className={styles.memoTitle}>{memo.title}</h4>
                    <p className={styles.memoDescription}>{memo.description}</p>
                  </div>
                  <span
                    className={`${styles.memoStatus} ${
                      memo.status === "참고" ? styles.memoStatusInfo : ""
                    }`}
                  >
                    {memo.status}
                  </span>
                </article>
              ))}
            </div>
          </section>

          {!isQuestionFlowLocked ? (
            <>
              <div className={styles.questionSpacer} aria-hidden="true" />

              <div className={styles.questionList}>
                {reviewQuestions.map((question, index) => (
                  <div className={styles.questionRow} key={question.id}>
                    <div className={styles.questionHeader}>
                      <span className={styles.questionLabel}>{question.label}</span>
                      <span className={styles.questionIndex}>{`Q${index + 1}`}</span>
                    </div>
                    <p className={styles.questionPrompt}>{question.prompt}</p>
                    <p className={styles.questionHint}>{question.hint}</p>
                    <input
                      className={styles.answerInput}
                      type="text"
                      value={answers[question.id] ?? ""}
                      onChange={(event) => onAnswerChange(question.id, event.target.value)}
                      placeholder="답변을 입력해 주세요."
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.detailQuestionsLocked}>
              <p className={styles.currentGuidelinesFootnote}>
                대상 특약을 먼저 확정한 뒤 핵심 질문을 마치면, 아래 상세 질문이
                이어서 열립니다.
              </p>
            </div>
          )}

          <div className={styles.ctaRow}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={onConfirmDraft}
              disabled={
                isActionDisabled ||
                hasUnansweredCoreQuestion ||
                hasUnansweredDetailQuestion ||
                isSubmitting ||
                !isMasterCreated ||
                isQuestionFlowLocked
              }
            >
              {isSubmitting ? "초안 생성 중..." : "초안생성"}
            </button>
            {!isMasterCreated ? (
              <p className={styles.currentGuidelinesFootnote}>
                STEP 1에서 통합 마스터를 먼저 만들어야 초안을 생성할 수 있습니다.
              </p>
            ) : null}
          </div>
        </div>
      </article>

      {finalSummary ? (
        <>
          <article className={`${styles.reviewFlowPanel} ${styles.reviewResultCard}`}>
            <div className={styles.finalSummaryTop}>
              <div>
                <span className={styles.panelLabel}>STEP 4</span>
                <h3 className={styles.panelTitle}>초안 생성 결과</h3>
              </div>
              <span className={styles.statusPill}>초안 생성 완료</span>
            </div>

            <div className={styles.finalSummaryGrid}>
              <div className={styles.finalSummaryItem}>
                <span className={styles.summaryMetaLabel}>변경 대상</span>
                <strong className={styles.summaryMetaValue}>{finalSummary.target}</strong>
              </div>
              <div className={styles.finalSummaryItem}>
                <span className={styles.summaryMetaLabel}>변경 전</span>
                <strong className={styles.summaryMetaValue}>{finalSummary.beforeValue}</strong>
              </div>
              <div className={styles.finalSummaryItem}>
                <span className={styles.summaryMetaLabel}>변경 후</span>
                <strong className={styles.summaryMetaValue}>{finalSummary.afterValue}</strong>
              </div>
            </div>

            <div className={styles.finalSummaryBriefCard}>
              <h4 className={styles.finalSummaryHeading}>반영 요약</h4>
              <p className={styles.finalSummaryBrief}>{finalSummaryBrief}</p>
            </div>

            <div className={styles.finalSummaryBlock}>
              <h4 className={styles.finalSummaryHeading}>남은 검토 필요 항목</h4>
              <ul className={styles.finalSummaryList}>
                {finalSummary.pendingNotes.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </article>

          <article className={`${styles.reviewFlowPanel} ${styles.downloadFlowCard}`}>
            <div className={styles.finalSummaryTop}>
              <div>
                <span className={styles.panelLabel}>STEP 5</span>
                <h3 className={styles.panelTitle}>통합 마스터와 상품 추출 다운로드</h3>
              </div>
            </div>

            <div className={styles.downloadOptionCard}>
              <div className={styles.downloadOptionTop}>
                <div>
                  <span className={styles.downloadOptionLabel}>옵션 1</span>
                  <h4 className={styles.downloadOptionTitle}>변경 반영 통합 마스터 다운로드</h4>
                </div>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={onDownloadMaster}
                  disabled={isActionDisabled || isDownloadingMaster}
                >
                  {isDownloadingMaster ? "다운로드 준비 중..." : "통합 마스터 다운로드"}
                </button>
              </div>
              <p className={styles.downloadOptionText}>
                업로드한 여러 상품 가이드라인을 표준 템플릿으로 합친 뒤, 현재
                변경사항을 반영한 단일 통합 마스터 미리보기입니다.
              </p>
              <p className={styles.downloadHintText}>
                다운로드가 시작되면 브라우저의 파일 열기/저장 안내를 확인해 주세요.
              </p>
            </div>

            <div className={styles.downloadOptionCard}>
              <div className={styles.downloadOptionTop}>
                <div>
                  <span className={styles.downloadOptionLabel}>옵션 2</span>
                  <h4 className={styles.downloadOptionTitle}>상품명 기준 추출 다운로드</h4>
                </div>
              </div>
              <p className={styles.downloadOptionText}>
                통합 마스터에서 상품명을 기준으로 필요한 내용만 즉시 추출해 별도
                엑셀로 내려받는 흐름 미리보기입니다.
              </p>
              <div className={styles.productExtractRow}>
                <div className={styles.productSearchStack}>
                  <input
                    className={styles.answerInput}
                    type="text"
                    value={productName}
                    onChange={(event) => onProductNameChange(event.target.value)}
                    placeholder="예: 건강플러스암보험"
                  />
                  {normalizedKeyword ? (
                    <div className={styles.productSearchResult}>
                      <div className={styles.productSearchResultTop}>
                        <span className={styles.productSearchResultLabel}>
                          통합 마스터 검색 결과
                        </span>
                        <span className={styles.productSearchResultCount}>
                          {matchedProducts.length}건
                        </span>
                      </div>
                      {matchedProducts.length > 0 ? (
                        <ul className={styles.productCandidateList}>
                          {matchedProducts.map((product) => (
                            <li key={product.id}>
                              <button
                                aria-label={`${product.productName} 선택`}
                                className={styles.productCandidateButton}
                                type="button"
                                onClick={() => onProductSelect(product.productName)}
                                disabled={isActionDisabled}
                              >
                                <span className={styles.productCandidateName}>
                                  {product.productName}
                                </span>
                                <span className={styles.productCandidateMeta}>
                                  {product.productCode ? `상품코드 ${product.productCode} · ` : ""}
                                  판매일자 {product.saleDate}
                                </span>
                                <span className={styles.productCandidateSummary}>
                                  {product.summary}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.productEmptyText}>
                          검색어가 포함된 상품이 아직 없습니다. 다른 키워드로 다시
                          찾아주세요.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={isActionDisabled || !productName.trim() || isDownloadingProduct}
                  onClick={onDownloadProduct}
                >
                  {isDownloadingProduct ? "추출 준비 중..." : "상품 추출 다운로드"}
                </button>
              </div>
              <p className={styles.downloadHintText}>
                다운로드가 시작되면 브라우저의 파일 열기/저장 안내를 확인해 주세요.
              </p>
            </div>

            <div className={styles.finalUploadCard}>
              <div>
                <h4 className={styles.finalSummaryHeading}>최종 반영 및 연결</h4>
                <p className={styles.finalUploadText}>
                  변경된 통합 마스터를 다시 저장하고, 지원/심사 에이전트로 바로 이동합니다.
                </p>
              </div>
              <div className={styles.finalUploadActions}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={onFinalizeUpload}
                  disabled={isActionDisabled || isSubmitting || !isMasterCreated}
                >
                  최종 업로드
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={handleSupportAgentOpen}
                >
                  지원AGENT 연결
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={handleReviewAgentOpen}
                >
                  심사AGENT 연결
                </button>
              </div>
              {finalUploadStatus ? (
                <p className={styles.finalUploadStatus}>{finalUploadStatus}</p>
              ) : null}
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}
