import styles from "./components.module.css";
import {
  sampleReviewMemos,
  sampleReviewQuestions,
  type SampleProductOption
} from "@/lib/sample-data";
import type { DraftSummary } from "@/lib/draft-builder";

type ReviewStageProps = {
  masterFileNames: string[];
  changeFileNames: string[];
  rawInput: string;
  answers: Record<string, string>;
  isSubmitting: boolean;
  isMasterCreated: boolean;
  finalSummary: DraftSummary | null;
  submitError: string;
  productName: string;
  productOptions: SampleProductOption[];
  isDownloadingMaster: boolean;
  isDownloadingProduct: boolean;
  onAnswerChange: (id: string, value: string) => void;
  onProductNameChange: (value: string) => void;
  onProductSelect: (value: string) => void;
  onConfirmDraft: () => void;
  onDownloadMaster: () => void;
  onDownloadProduct: () => void;
};

export function ReviewStage({
  masterFileNames,
  changeFileNames,
  rawInput,
  answers,
  isSubmitting,
  isMasterCreated,
  finalSummary,
  submitError,
  productName,
  productOptions,
  isDownloadingMaster,
  isDownloadingProduct,
  onAnswerChange,
  onProductNameChange,
  onProductSelect,
  onConfirmDraft,
  onDownloadMaster,
  onDownloadProduct
}: ReviewStageProps) {
  const hasUnansweredQuestion = sampleReviewQuestions.some(
    (question) => !(answers[question.id] ?? "").trim()
  );
  const normalizedKeyword = productName.trim().toLowerCase();
  const matchedProducts = normalizedKeyword
    ? productOptions.filter((product) =>
        product.productName.toLowerCase().includes(normalizedKeyword)
      )
    : [];

  return (
    <section className={styles.inputLayout}>
      <div className={`${styles.inputPanel} ${styles.reviewFlowPanel}`}>
        <div className={styles.reviewSummaryTop}>
          <div>
            <span className={styles.panelLabel}>STEP 2</span>
            <h2 className={styles.panelTitle}>입력 초안 검토</h2>
          </div>
          <span className={styles.statusPill}>검토 필요 항목 있음</span>
        </div>

        <p className={styles.panelText}>
          첫 화면 구조는 유지한 채, 입력한 변경안을 바탕으로 추가 확인이 필요한
          질문만 이어서 받습니다. 모든 답변이 채워지면 최종 요약과 엑셀 초안을
          생성할 수 있습니다.
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
          <h3 className={styles.panelHeading}>확인 질문</h3>
          <p className={styles.questionIntro}>
            초안을 확정하기 전에 추가 확인이 필요한 항목을 한 번에 모았습니다. 아래
            질문에 모두 답해주시면 최종 요약과 엑셀 초안을 함께 만들 수 있습니다.
          </p>
          {submitError ? <p className={styles.errorBanner}>{submitError}</p> : null}
          <div className={styles.questionList}>
            {sampleReviewQuestions.map((question) => (
              <div className={styles.questionRow} key={question.id}>
                <div className={styles.questionHeader}>
                  <span className={styles.questionLabel}>{question.label}</span>
                  <span className={styles.questionIndex}>
                    {question.id.replace("question-", "Q")}
                  </span>
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

          <div className={styles.ctaRow}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={onConfirmDraft}
              disabled={hasUnansweredQuestion || isSubmitting || !isMasterCreated}
            >
              {isSubmitting ? "초안 생성 중..." : "초안 확정"}
            </button>
            {!isMasterCreated ? (
              <p className={styles.currentGuidelinesFootnote}>
                STEP 0에서 통합 마스터를 먼저 만들어야 초안을 확정할 수 있습니다.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <aside className={styles.inputAside}>
        <div className={styles.guideCard}>
          <span className={styles.guideStepLabel}>STEP 2</span>
          <h3 className={styles.guideTitle}>검토메모</h3>
          <div className={styles.memoList}>
            {sampleReviewMemos.map((memo) => (
              <article className={styles.memoCard} key={memo.id}>
                <div className={styles.memoCardTop}>
                  <h4 className={styles.memoTitle}>{memo.title}</h4>
                  <span
                    className={`${styles.memoStatus} ${
                      memo.status === "참고" ? styles.memoStatusInfo : ""
                    }`}
                  >
                    {memo.status}
                  </span>
                </div>
                <p className={styles.memoDescription}>{memo.description}</p>
              </article>
            ))}
          </div>
        </div>

        {finalSummary ? (
          <div
            className={`${styles.guideCard} ${styles.guideCardAlt} ${styles.reviewResultCard}`}
          >
            <div className={styles.finalSummaryTop}>
              <div>
                <span className={styles.guideStepLabel}>STEP 3</span>
                <h3 className={styles.guideTitle}>최종 파일 미리보기</h3>
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
                  disabled={isDownloadingMaster}
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
                              >
                                <span className={styles.productCandidateName}>
                                  {product.productName}
                                </span>
                                <span className={styles.productCandidateMeta}>
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
                  disabled={!productName.trim() || isDownloadingProduct}
                  onClick={onDownloadProduct}
                >
                  {isDownloadingProduct ? "추출 준비 중..." : "상품 추출 다운로드"}
                </button>
              </div>
              <p className={styles.downloadHintText}>
                다운로드가 시작되면 브라우저의 파일 열기/저장 안내를 확인해 주세요.
              </p>
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
            <div className={styles.finalSummaryBlock}>
              <h4 className={styles.finalSummaryHeading}>반영된 답변</h4>
              <ul className={styles.finalSummaryList}>
                {finalSummary.appliedAnswers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.finalSummaryBlock}>
              <h4 className={styles.finalSummaryHeading}>남은 검토 필요 항목</h4>
              <ul className={styles.finalSummaryList}>
                {finalSummary.pendingNotes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className={`${styles.guideCard} ${styles.guideCardAlt}`}>
            <span className={styles.guideStepLabel}>STEP 3</span>
            <h3 className={styles.guideTitle}>통합 마스터와 상품 추출 다운로드</h3>
            <p className={styles.guideText}>
              질문 답변을 반영하면 하나의 통합 마스터 파일을 만들고, 이후 상품명을
              입력해 해당 상품만 즉시 추출 다운로드하는 흐름으로 이어집니다.
            </p>
          </div>
        )}
      </aside>
    </section>
  );
}
