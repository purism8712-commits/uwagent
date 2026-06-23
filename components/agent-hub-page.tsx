"use client";

import { Fragment, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { HomePageContent } from "@/components/home-page";
import { HeroSection } from "@/components/hero-section";
import styles from "./components.module.css";
import { clearAuthSession } from "@/lib/session";
import { canUseAgentScope } from "@/lib/session";
import type { AuthSession } from "@/lib/session";
import type { InquiryEvidence } from "@/lib/pre-inquiry";
import { buildReviewDraftFromFile, type ReviewDraftFaq, type ReviewWorkbookDraft } from "@/lib/review-agent-draft";
import { extractProductCandidatesFromFiles, type ParsedProductCandidate } from "@/lib/product-candidate-parser";
import { buildSupportWorkbookBuffer } from "@/lib/support-agent-export";
import { SupportAgentFrame } from "@/components/support-agent-frame";
import { ReviewAgentFrame } from "@/components/review-agent-frame";

type AgentTab = "기획" | "지원" | "심사" | "사전문의";

type AgentHubPageProps = {
  userSession?: AuthSession | null;
};

function AgentPreviewCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.agentHubPanel}>
      <div className={styles.agentPreviewHeader}>
        <div className={styles.agentPreviewTitleBlock}>
          <span className={styles.agentPreviewIcon}>◎</span>
          <div className={styles.agentPreviewCopy}>
            <h2 className={styles.agentPreviewHeading}>{title}</h2>
            <p className={styles.agentPreviewDescription}>{description}</p>
          </div>
        </div>
      </div>

      <div className={styles.agentPreviewSurface}>{children}</div>
    </section>
  );
}

function AgentFlowBar({
  labels,
  activeIndex
}: {
  labels: string[];
  activeIndex: number;
}) {
  return (
    <section className={styles.stepCard} aria-label="단계 진행 상태">
      {labels.map((label, index) => {
        const isActive = index <= activeIndex;
        return (
          <Fragment key={label}>
            <div className={`${styles.stepItem} ${isActive ? styles.stepActive : ""}`}>
              <span className={styles.stepBullet}>{index + 1}</span>
              <span>{label}</span>
            </div>
            {index < labels.length - 1 ? <div className={styles.stepDivider} /> : null}
          </Fragment>
        );
      })}
    </section>
  );
}

function ReviewStepBar({
  activeIndex
}: {
  activeIndex: number;
}) {
  return <AgentFlowBar labels={["변경내용 입력", "검토메모 및 질문 확인"]} activeIndex={activeIndex} />;
}

function SupportAgentPreview() {
  const [guidelineFiles, setGuidelineFiles] = useState<File[]>([]);
  const [rdFiles, setRdFiles] = useState<File[]>([]);
  const [parsedCandidates, setParsedCandidates] = useState<ParsedProductCandidate[]>([]);
  const [productFilter, setProductFilter] = useState<"미착수" | "진행중" | "보류" | "완료">("미착수");
  const [selectedProduct, setSelectedProduct] = useState("등록된 상품 없음");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [transformStatus, setTransformStatus] = useState("가이드라인과 RD 원본파일을 먼저 업로드해 주세요.");
  const [isTransforming, setIsTransforming] = useState(false);
  const [generatedWorkbook, setGeneratedWorkbook] = useState<{ fileName: string; url: string } | null>(null);
  const nowLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date()),
    []
  );

  useEffect(
    () => () => {
      if (generatedWorkbook?.url) {
        URL.revokeObjectURL(generatedWorkbook.url);
      }
    },
    [generatedWorkbook]
  );

  const allUploadedFiles = useMemo(
    () => [
      ...guidelineFiles.map((file) => ({ fileName: file.name, type: "가이드라인", status: "업로드 완료" })),
      ...rdFiles.map((file) => ({ fileName: file.name, type: "RD 원본파일", status: "업로드 완료" }))
    ],
    [guidelineFiles, rdFiles]
  );

  const supportProductRows = useMemo(
    () =>
      parsedCandidates.map((candidate, index) => {
        const statusCycle = ["미착수", "진행중", "보류", "완료"] as const;
        const status = statusCycle[index % statusCycle.length];

        return {
          ...candidate,
          status
        };
      }),
    [parsedCandidates]
  );

  const filteredProductRows = useMemo(
    () => supportProductRows.filter((row) => row.status === productFilter),
    [productFilter, supportProductRows]
  );

  const counts = useMemo(
    () => ({
      totalFiles: allUploadedFiles.length,
      productCount: supportProductRows.length,
      doneCount: supportProductRows.filter((row) => row.status === "완료").length,
      holdCount: supportProductRows.filter((row) => row.status === "보류").length
    }),
    [allUploadedFiles.length, supportProductRows]
  );

  const canAskQuestion =
    supportProductRows.length > 0 && selectedProduct !== "등록된 상품 없음" && question.trim().length > 0;
  const supportFlowIndex = !guidelineFiles.length
    ? 0
    : !rdFiles.length
      ? 1
      : !parsedCandidates.length
        ? 2
        : !question.trim()
          ? 3
          : !answer
            ? 3
            : 4;

  useEffect(() => {
    if (supportProductRows.length === 0) {
      if (selectedProduct !== "등록된 상품 없음") {
        setSelectedProduct("등록된 상품 없음");
      }
      return;
    }

    if (!supportProductRows.some((row) => row.productName === selectedProduct)) {
      setSelectedProduct(supportProductRows[0]?.productName ?? "등록된 상품 없음");
    }
  }, [selectedProduct, supportProductRows]);

  const clearGeneratedWorkbook = () => {
    setGeneratedWorkbook((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  };

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>, setter: (value: File[]) => void) => {
    const nextFiles = Array.from(event.target.files ?? []);
    setter(nextFiles);
    clearGeneratedWorkbook();
    setParsedCandidates([]);
    setSelectedProduct("등록된 상품 없음");
    setQuestion("");
    setAnswer("");
    setTransformStatus(
      nextFiles.length > 0 ? "업로드 완료. 변환하기를 눌러 지원 Agent 초안을 정리해 주세요." : "가이드라인과 RD 원본파일을 먼저 업로드해 주세요."
    );
  };

  const toArrayBuffer = (value: ArrayBuffer | SharedArrayBuffer | ArrayBufferView): ArrayBuffer => {
    if (value instanceof ArrayBuffer) {
      return value;
    }

    if (ArrayBuffer.isView(value)) {
      return Uint8Array.from(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      ).buffer;
    }

    return Uint8Array.from(new Uint8Array(value)).buffer;
  };

  const handleTransform = async () => {
    if (guidelineFiles.length === 0 || rdFiles.length === 0) {
      setTransformStatus("가이드라인과 RD 원본파일을 먼저 업로드해 주세요.");
      return;
    }

    setIsTransforming(true);
    clearGeneratedWorkbook();
    setAnswer("");

    try {
      const uploadedFiles = [...guidelineFiles, ...rdFiles];
      const candidates = await extractProductCandidatesFromFiles(uploadedFiles);
      setParsedCandidates(candidates);

      if (candidates.length === 0) {
        setTransformStatus("업로드된 파일에서 지원 Agent용 상품 후보를 찾지 못했습니다.");
        return;
      }

      const { buffer, fileName } = await buildSupportWorkbookBuffer({
        guidelineFileNames: guidelineFiles.map((file) => file.name),
        rdFileNames: rdFiles.map((file) => file.name),
        candidates
      });

      const downloadBuffer = toArrayBuffer(buffer);
      const url = URL.createObjectURL(
        new Blob([downloadBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        })
      );

      setGeneratedWorkbook({ fileName, url });
      setSelectedProduct(candidates[0]?.productName ?? "등록된 상품 없음");
      setTransformStatus(`${fileName} 생성 완료 · ${candidates.length}개 후보를 정리했습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setTransformStatus(`변환 중 오류가 발생했습니다. ${message}`);
      setGeneratedWorkbook(null);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleDownloadGeneratedWorkbook = () => {
    if (!generatedWorkbook) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = generatedWorkbook.url;
    anchor.download = generatedWorkbook.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleQuestion = () => {
    if (!canAskQuestion) {
      setAnswer("대상 상품과 질문을 먼저 입력해 주세요.");
      return;
    }

    const matched = supportProductRows.find((row) => row.productName === selectedProduct);
    const insuranceCodes = matched?.insuranceCodeMapping || matched?.insuranceCode || "보험코드 미기재";

    setAnswer(
      `${selectedProduct} 기준 응답: ${question.trim()}에 대해 ${matched?.status ?? "미착수"} 상태로 검토가 필요합니다. 지원 Agent에서는 업로드된 가이드라인과 RD 원본파일을 같이 확인해 시스템 반영용 초안을 만듭니다. 연결된 보험코드: ${insuranceCodes}.`
    );
  };

  const handleReset = () => {
    clearGeneratedWorkbook();
    setGuidelineFiles([]);
    setRdFiles([]);
    setParsedCandidates([]);
    setProductFilter("미착수");
    setSelectedProduct("등록된 상품 없음");
    setQuestion("");
    setAnswer("");
    setTransformStatus("가이드라인과 RD 원본파일을 먼저 업로드해 주세요.");
  };

  return (
    <div className={styles.supportAgentApp}>
      <AgentFlowBar
        labels={["가이드라인 업로드", "RD 원본 업로드", "변환하기", "상품 목록 확인", "질의 / 답변"]}
        activeIndex={supportFlowIndex}
      />

      <section className={styles.supportAgentHeader}>
        <div className={styles.supportAgentHeadingBlock}>
          <h3 className={styles.supportAgentHeading}>지원 Agent 진행 요약</h3>
          <p className={styles.supportAgentIntro}>업로드 파일 수와 상품별 진행 상태를 먼저 확인한 뒤 상세 작업으로 이어집니다.</p>
        </div>

        <div className={styles.supportAgentStats}>
          <article className={styles.supportAgentStatCard}>
            <span className={styles.supportAgentStatLabel}>전체 파일 수</span>
            <strong className={styles.supportAgentStatValue}>{counts.totalFiles}</strong>
          </article>
          <article className={styles.supportAgentStatCard}>
            <span className={styles.supportAgentStatLabel}>상품 수</span>
            <strong className={styles.supportAgentStatValue}>{counts.productCount}</strong>
          </article>
          <article className={styles.supportAgentStatCard}>
            <span className={styles.supportAgentStatLabel}>완료 건수</span>
            <strong className={styles.supportAgentStatValue}>{counts.doneCount}</strong>
          </article>
          <article className={styles.supportAgentStatCard}>
            <span className={styles.supportAgentStatLabel}>보류 건수</span>
            <strong className={styles.supportAgentStatValue}>{counts.holdCount}</strong>
          </article>
        </div>
      </section>

      <div className={styles.supportAgentToolbar}>
        <p className={styles.supportAgentToolbarText}>{transformStatus}</p>
        <button className={styles.supportAgentRefreshButton} type="button" onClick={handleReset}>
          전체새로고침
        </button>
      </div>

      <section className={styles.supportAgentSection}>
        <div className={styles.supportAgentSectionTop}>
          <div>
            <span className={styles.supportAgentSectionLabel}>파일 업로드</span>
            <h4 className={styles.supportAgentSectionTitle}>가이드라인과 RD 원본파일을 업로드</h4>
            <p className={styles.supportAgentSectionIntro}>
              지원 가능한 형식: xlsx · xls · csv · docx · pdf. docx/pdf는 메타데이터만 보관하고, xlsx/xls/csv는
              상품별 반영 초안 생성에 사용합니다.
            </p>
          </div>
          <span className={styles.supportAgentStatusPill}>업로드 준비</span>
        </div>

        <div className={styles.supportAgentUploadGrid}>
          <article className={styles.supportAgentUploadCard}>
            <div className={styles.supportAgentUploadCardTop}>
              <h5 className={styles.supportAgentUploadTitle}>상품 가이드라인</h5>
              <span className={styles.supportAgentUploadChip}>가이드라인</span>
            </div>
            <p className={styles.supportAgentUploadText}>가이드라인 파일을 업로드해 시스템 반영 초안의 기준으로 사용합니다.</p>
            <input
              className={styles.supportAgentHiddenInput}
              id="support-guideline-upload"
              type="file"
              accept=".xlsx,.xls,.csv,.docx,.pdf"
              multiple
              onChange={(event) => handleFilesChange(event, setGuidelineFiles)}
            />
            <label className={styles.supportAgentUploadButton} htmlFor="support-guideline-upload">
              가이드라인
            </label>
            <div className={styles.supportAgentSelectedFiles}>
              {guidelineFiles.length > 0 ? (
                <ul className={styles.supportAgentSelectedList}>
                  {guidelineFiles.map((file) => (
                    <li key={file.name}>{file.name}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.supportAgentEmptyText}>아직 업로드된 파일이 없습니다.</p>
              )}
            </div>
          </article>

          <article className={styles.supportAgentUploadCard}>
            <div className={styles.supportAgentUploadCardTop}>
              <h5 className={styles.supportAgentUploadTitle}>RD 원본파일</h5>
              <span className={styles.supportAgentUploadChipAlt}>RD판</span>
            </div>
            <p className={styles.supportAgentUploadText}>RD 원본파일을 함께 올리면 상품별 시스템 반영 여부를 같이 확인할 수 있습니다.</p>
            <input
              className={styles.supportAgentHiddenInput}
              id="support-rd-upload"
              type="file"
              accept=".xlsx,.xls,.csv,.docx,.pdf"
              multiple
              onChange={(event) => handleFilesChange(event, setRdFiles)}
            />
            <label className={styles.supportAgentUploadButton} htmlFor="support-rd-upload">
              RD판
            </label>
            <div className={styles.supportAgentSelectedFiles}>
              {rdFiles.length > 0 ? (
                <ul className={styles.supportAgentSelectedList}>
                  {rdFiles.map((file) => (
                    <li key={file.name}>{file.name}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.supportAgentEmptyText}>아직 업로드된 파일이 없습니다.</p>
              )}
            </div>
          </article>
        </div>

        <div className={styles.supportAgentActionRow}>
          <button className={styles.supportAgentActionButton} type="button" onClick={handleTransform} disabled={isTransforming}>
            {isTransforming ? "변환 중..." : "변환하기"}
          </button>
          <button className={styles.supportAgentSecondaryButton} type="button" onClick={handleReset}>
            파일 새로고침
          </button>
          {generatedWorkbook ? (
            <button className={styles.supportAgentSecondaryButton} type="button" onClick={handleDownloadGeneratedWorkbook}>
              {generatedWorkbook.fileName} 다운로드
            </button>
          ) : null}
          <span className={styles.supportAgentActionHint}>
            {allUploadedFiles.length > 0
              ? `${allUploadedFiles.length}개 파일이 준비되었습니다.`
              : "가이드라인과 RD 원본파일을 먼저 업로드해 주세요."}
          </span>
        </div>

        <div className={styles.supportAgentMetaTableWrap}>
          <table className={styles.supportAgentMetaTable}>
            <thead>
              <tr>
                <th>파일명</th>
                <th>유형</th>
                <th>업로드일시</th>
                <th>업로더</th>
                <th>상태</th>
                <th>삭제</th>
              </tr>
            </thead>
            <tbody>
              {allUploadedFiles.length > 0 ? (
                allUploadedFiles.map((file) => (
                  <tr key={`${file.type}-${file.fileName}`}>
                    <td>{file.fileName}</td>
                    <td>{file.type}</td>
                    <td>{nowLabel}</td>
                    <td>로컬 사용자</td>
                    <td>
                      <span className={styles.supportAgentRowStatus}>{file.status}</span>
                    </td>
                    <td>
                      <button
                        className={styles.supportAgentDeleteButton}
                        type="button"
                        onClick={() => {
                          if (file.type === "가이드라인") {
                            setGuidelineFiles((current) => current.filter((item) => item.name !== file.fileName));
                          } else {
                            setRdFiles((current) => current.filter((item) => item.name !== file.fileName));
                          }
                          setParsedCandidates([]);
                          clearGeneratedWorkbook();
                          setAnswer("");
                          setTransformStatus("가이드라인과 RD 원본파일을 먼저 업로드해 주세요.");
                        }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <p className={styles.supportAgentEmptyText}>업로드된 파일이 없습니다.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.supportAgentSection}>
        <div className={styles.supportAgentSectionTop}>
          <div>
            <span className={styles.supportAgentSectionLabel}>상품 목록</span>
            <h4 className={styles.supportAgentSectionTitle}>상품별 시스템 반영 진행사항</h4>
            <p className={styles.supportAgentSectionIntro}>
              변환된 상품은 상품명 기준으로 한 줄씩 표시되고, 상태별 진행 현황을 확인할 수 있습니다.
            </p>
          </div>
          <div className={styles.supportAgentStatusGroup}>
            {(["미착수", "진행중", "보류", "완료"] as const).map((status) => (
              <button
                key={status}
                className={`${styles.supportAgentStatusTab} ${
                  productFilter === status ? styles.supportAgentStatusTabActive : ""
                }`}
                type="button"
                onClick={() => setProductFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {filteredProductRows.length > 0 ? (
          <div className={styles.supportAgentProductGrid}>
            {filteredProductRows.map((row) => (
              <article key={`${row.sourceFileName}-${row.productName}-${row.productCode ?? ""}`} className={styles.supportAgentProductCard}>
                <div className={styles.supportAgentProductCardTop}>
                  <div>
                    <h5 className={styles.supportAgentProductCardTitle}>{row.productName}</h5>
                    <p className={styles.supportAgentProductCardMeta}>
                      {row.productCode ? `상품코드 ${row.productCode}` : "상품코드 미기재"}
                      {row.insuranceCode ? ` · 보험코드 ${row.insuranceCode}` : ""}
                      {row.saleDate ? ` · 판매일자 ${row.saleDate}` : ""}
                    </p>
                  </div>
                  <span className={styles.supportAgentProductStatus}>{row.status}</span>
                </div>
                <p className={styles.supportAgentProductCardSummary}>{row.summary}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.supportAgentEmptyPanel}>
            <h5 className={styles.supportAgentEmptyTitle}>아직 등록된 상품이 없습니다</h5>
            <p className={styles.supportAgentEmptyText}>
              가이드라인과 RD 원본파일을 업로드한 뒤 변환하기를 누르면 상품 목록이 나타납니다.
            </p>
          </div>
        )}
      </section>

      <section className={styles.supportAgentSection}>
        <div className={styles.supportAgentSectionTop}>
          <div>
            <span className={styles.supportAgentSectionLabel}>비교 질의 / OpenAI</span>
            <h4 className={styles.supportAgentSectionTitle}>선택한 상품으로 질문하기</h4>
            <p className={styles.supportAgentSectionIntro}>
              저장된 상품을 선택한 뒤, 질문을 입력하면 지원 Agent용 답변 초안을 확인할 수 있습니다.
            </p>
          </div>
          <span className={styles.supportAgentStatusPill}>질의 가능</span>
        </div>

        <div className={styles.supportAgentQueryPanel}>
          <label className={styles.supportAgentFieldLabel}>
            대상 상품
            <select
              className={styles.supportAgentSelect}
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              disabled={supportProductRows.length === 0}
            >
              {supportProductRows.length === 0 ? (
                <option value="등록된 상품 없음">등록된 상품 없음</option>
              ) : (
                supportProductRows.map((row) => (
                  <option key={row.id} value={row.productName}>
                    {row.productName}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className={styles.supportAgentFieldLabel}>
            질문
            <textarea
              className={styles.supportAgentTextarea}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="예: 암진단특약의 일반/간편 한도가 같은데 자동반영 가능한가요?"
              rows={4}
            />
          </label>

          <div className={styles.supportAgentActionRow}>
            <button className={styles.supportAgentActionButton} type="button" disabled={!canAskQuestion} onClick={handleQuestion}>
              질문하기
            </button>
            <button
              className={styles.supportAgentSecondaryButton}
              type="button"
              onClick={() => {
                setQuestion("");
                setAnswer("");
              }}
            >
              질문 초기화
            </button>
          </div>
        </div>

        <div className={styles.supportAgentAnswerPanel}>
          <span className={styles.supportAgentSectionLabel}>답변</span>
          {answer ? (
            <p className={styles.supportAgentAnswerText}>{answer}</p>
          ) : (
            <p className={styles.supportAgentEmptyText}>
              질문을 입력하면 지원 Agent의 답변 초안이 이 영역에 표시됩니다.
            </p>
          )}
        </div>
      </section>

      <p className={styles.supportAgentFooterNote}>
        지원 Agent는 업로드된 가이드라인과 RD 원본파일을 기준으로 시스템 반영용 입력 초안을 만드는 로컬 미리보기입니다.
      </p>
    </div>
  );
}

function ReviewAgentPreview() {
  const [uploadedWorkbookFile, setUploadedWorkbookFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedWorkbookDraft, setUploadedWorkbookDraft] = useState<ReviewWorkbookDraft | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState("필수 시트 상태를 아직 확인하지 않았습니다.");
  const [draftCreated, setDraftCreated] = useState(false);
  const [pptGenerated, setPptGenerated] = useState(false);
  const [approved, setApproved] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [oneLineSummary, setOneLineSummary] = useState("");
  const [majorChanges, setMajorChanges] = useState("");
  const [cautions, setCautions] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [owner, setOwner] = useState("");
  const [faqs, setFaqs] = useState<ReviewDraftFaq[]>([
    { id: "faq-1", question: "", answer: "" },
    { id: "faq-2", question: "", answer: "" },
    { id: "faq-3", question: "", answer: "" }
  ]);

  const hasUploadedFile = uploadedFileName.length > 0;
  const hasEditableDraft = noticeTitle.trim() || oneLineSummary.trim() || majorChanges.trim() || cautions.trim();
  const reviewFlowIndex = draftCreated ? 1 : hasUploadedFile ? 0 : 0;

  const handleReviewUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const fileName = file?.name ?? "";
    setUploadedWorkbookFile(file ?? null);
    setUploadedFileName(fileName);
    setDraftCreated(false);
    setPptGenerated(false);
    setApproved(false);
    setUploadedWorkbookDraft(null);

    if (!file) {
      setUploadStatusText("필수 시트 상태를 아직 확인하지 않았습니다.");
      return;
    }

    try {
      const nextDraft = await buildReviewDraftFromFile(file);
      setUploadedWorkbookDraft(nextDraft);
      setUploadStatusText(nextDraft.uploadStatusText);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setUploadStatusText(`엑셀을 읽는 중 오류가 발생했습니다. ${message}`);
    }
  };

  const handleCreateReviewDraft = () => {
    if (!hasUploadedFile || !uploadedWorkbookFile) {
      return;
    }

    const applyDraft = (nextDraft: ReviewWorkbookDraft) => {
      setUploadedWorkbookDraft(nextDraft);
      setUploadStatusText(nextDraft.uploadStatusText);
      setNoticeTitle(nextDraft.noticeTitle);
      setOneLineSummary(nextDraft.oneLineSummary);
      setMajorChanges(nextDraft.majorChanges);
      setCautions(nextDraft.cautions);
      setEffectiveDate(nextDraft.effectiveDate);
      setOwner(nextDraft.owner);
      setFaqs(nextDraft.faqs);
      setDraftCreated(true);
      setPptGenerated(false);
      setApproved(false);
    };

    if (uploadedWorkbookDraft?.hasRequiredSheets) {
      applyDraft(uploadedWorkbookDraft);
      return;
    }

    buildReviewDraftFromFile(uploadedWorkbookFile)
      .then((nextDraft) => {
        if (!nextDraft.hasRequiredSheets) {
          setUploadStatusText(nextDraft.uploadStatusText);
          return;
        }

        applyDraft(nextDraft);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        setUploadStatusText(`엑셀을 읽는 중 오류가 발생했습니다. ${message}`);
      });
  };

  const handleFaqChange = (id: string, field: "question" | "answer", value: string) => {
    setFaqs((currentFaqs) => currentFaqs.map((faq) => (faq.id === id ? { ...faq, [field]: value } : faq)));
  };

  const handleAddFaq = () => {
    setFaqs((currentFaqs) => [...currentFaqs, { id: `faq-${Date.now()}`, question: "", answer: "" }]);
  };

  const handleRemoveFaq = (id: string) => {
    setFaqs((currentFaqs) => currentFaqs.filter((faq) => faq.id !== id));
  };

  const handleGeneratePptDraft = () => {
    if (!draftCreated || !hasEditableDraft) {
      return;
    }

    const faqText = faqs
      .filter((faq) => faq.question.trim() || faq.answer.trim())
      .map((faq, index) => `FAQ ${index + 1}\nQ. ${faq.question || "미입력"}\nA. ${faq.answer || "미입력"}`)
      .join("\n\n");

    const html = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>심사 Agent PPT 초안</title></head>
<body>
<h1>${noticeTitle}</h1>
<p>${oneLineSummary}</p>
<h2>주요 변경사항</h2>
<pre>${majorChanges}</pre>
<h2>유의사항</h2>
<pre>${cautions}</pre>
<h2>적용시점 / 담당자</h2>
<p>${effectiveDate || "검토 필요"} / ${owner || "검토 필요"}</p>
<h2>FAQ</h2>
<pre>${faqText || "작성된 FAQ가 없습니다."}</pre>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "review-agent-notice-draft.html";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setPptGenerated(true);
  };

  return (
    <div className={styles.reviewAgentWorkspace}>
      <section className={styles.reviewAgentHero}>
        <div className={styles.reviewAgentHeroCopy}>
          <h1 className={styles.reviewAgentHeroTitle}>신계약 공통 에이전트</h1>
          <p className={styles.reviewAgentHeroDescription}>
            변경된 엑셀, 표, 자연어 입력을 공통 양식 초안으로 정리하고 검토메모와 확인 질문까지 이어서 처리하는 내부 업무용
            데스크톱 에이전트입니다.
          </p>
        </div>
        <div className={styles.reviewAgentMetrics}>
          <div className={styles.reviewAgentMetricCard}>
            <span className={styles.reviewAgentMetricLabel}>지원 입력</span>
            <span className={styles.reviewAgentMetricValue}>엑셀 · 표 · 자연어</span>
          </div>
          <div className={styles.reviewAgentMetricCard}>
            <span className={styles.reviewAgentMetricLabel}>출력 흐름</span>
            <span className={styles.reviewAgentMetricValue}>초안 생성 → 검토 질문</span>
          </div>
          <div className={styles.reviewAgentMetricCard}>
            <span className={styles.reviewAgentMetricLabel}>상태 기준</span>
            <span className={styles.reviewAgentMetricValue}>초안 / 검토 필요</span>
          </div>
        </div>
      </section>

      <ReviewStepBar activeIndex={reviewFlowIndex} />

      <div className={styles.reviewAgentApp}>
      <section className={styles.reviewAgentPanel}>
        <div className={styles.reviewAgentPanelHeader}>
          <div className={styles.reviewAgentPanelHeadingBlock}>
            <span className={styles.reviewAgentPanelIcon} aria-hidden="true">
              📣
            </span>
            <h3 className={styles.agentPreviewSectionTitle}>심사 Agent</h3>
          </div>
          <div className={styles.reviewAgentChipRow}>
            <span className={styles.reviewAgentInfoPill}>현장공지자료</span>
            <span className={hasUploadedFile ? styles.reviewAgentSuccessPill : styles.agentPreviewStatusPill}>
              {hasUploadedFile ? "업로드 완료" : "업로드 대기"}
            </span>
          </div>
        </div>

        <div className={styles.agentPreviewUploadRow}>
            <div className={styles.agentPreviewUploadInfo}>
              <strong className={styles.agentPreviewUploadFile}>{uploadedFileName || "업로드된 파일이 없습니다."}</strong>
              <p className={styles.agentPreviewUploadText}>
                {hasUploadedFile
                  ? "로컬 PC에서 선택한 파일이 업로드되었습니다."
                  : "수동 업로드 버튼으로 로컬 PC의 .xlsx 파일을 올리면 현장공지자료 초안을 생성하는 흐름입니다."}
              </p>
            </div>
            <input
              className={styles.supportAgentHiddenInput}
              id="review-master-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleReviewUpload}
            />
            <label className={styles.agentPreviewDisabledButton} htmlFor="review-master-upload">
              엑셀 업로드
            </label>
          </div>

          <p className={styles.agentPreviewHint}>
            {hasUploadedFile ? uploadStatusText : "필수 시트 상태를 아직 확인하지 않았습니다."}
          </p>
          <button
            className={styles.reviewAgentPrimaryButton}
          type="button"
          disabled={!hasUploadedFile}
          onClick={handleCreateReviewDraft}
        >
          초안 생성
        </button>
      </section>

      <section className={styles.reviewAgentPanel}>
        <div className={styles.agentPreviewCardHeader}>
          <h3 className={styles.agentPreviewSectionTitle}>공지 본문</h3>
          <span className={styles.agentPreviewEditPill}>수정 가능</span>
        </div>

        <label className={styles.agentPreviewFieldLabel}>
          <span className={styles.reviewAgentFieldTop}>
            제목 <span>{noticeTitle.length} / 28자</span>
          </span>
          <input
            className={styles.agentPreviewInput}
            value={noticeTitle}
            placeholder="초안 생성 후 제목이 여기에 채워집니다."
            onChange={(event) => setNoticeTitle(event.target.value)}
          />
        </label>

        <label className={styles.agentPreviewFieldLabel}>
          <span className={styles.reviewAgentFieldTop}>
            한줄 요약 <span>{oneLineSummary.length} / 64자</span>
          </span>
          <input
            className={styles.agentPreviewInput}
            value={oneLineSummary}
            placeholder="예: ○○ 상품 인수기준 변경안을 안내드립니다. 하단 참고 바랍니다."
            onChange={(event) => setOneLineSummary(event.target.value)}
          />
        </label>

        <label className={styles.agentPreviewFieldLabel}>
          <span className={styles.reviewAgentFieldTop}>
            주요 변경사항 <span>{majorChanges.length} / 180자</span>
          </span>
          <textarea
            className={styles.reviewAgentTextarea}
            value={majorChanges}
            placeholder="한 줄에 하나씩 주요 변경사항을 입력합니다."
            onChange={(event) => setMajorChanges(event.target.value)}
          />
        </label>

        <label className={styles.agentPreviewFieldLabel}>
          <span className={styles.reviewAgentFieldTop}>
            유의사항 <span>{cautions.length} / 140자</span>
          </span>
          <textarea
            className={styles.reviewAgentTextarea}
            value={cautions}
            placeholder="한 줄에 하나씩 유의사항을 입력합니다."
            onChange={(event) => setCautions(event.target.value)}
          />
        </label>

        <div className={styles.reviewAgentTwoColumn}>
          <label className={styles.agentPreviewFieldLabel}>
            <span className={styles.reviewAgentFieldTop}>
              적용시점 {!effectiveDate.trim() ? <span className={styles.reviewAgentNeedPill}>검토 필요</span> : null}
            </span>
            <input
              className={styles.agentPreviewInput}
              value={effectiveDate}
              placeholder="예: 2026-10-01"
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </label>
          <label className={styles.agentPreviewFieldLabel}>
            <span className={styles.reviewAgentFieldTop}>
              담당자(문의) {!owner.trim() ? <span className={styles.reviewAgentNeedPill}>검토 필요</span> : null}
            </span>
            <input
              className={styles.agentPreviewInput}
              value={owner}
              placeholder="예: 상품운영팀"
              onChange={(event) => setOwner(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className={styles.reviewAgentPanel}>
        <div className={styles.agentPreviewCardHeader}>
          <div>
            <h3 className={styles.agentPreviewSectionTitle}>FAQ</h3>
            <p className={styles.agentPreviewUploadText}>빈 카드나 전부 비어 있는 항목은 PPT 생성 시 자동 제외됩니다.</p>
          </div>
          <button className={styles.supportAgentSecondaryButton} type="button" onClick={handleAddFaq}>
            FAQ 추가
          </button>
        </div>

        <div className={styles.reviewAgentFaqGrid}>
          {faqs.map((faq, index) => {
            const isComplete = faq.question.trim().length > 0 && faq.answer.trim().length > 0;
            const hasAnyContent = faq.question.trim().length > 0 || faq.answer.trim().length > 0;
            return (
              <article className={styles.reviewAgentFaqCard} key={faq.id}>
                <div className={styles.reviewAgentFaqHeader}>
                  <strong>FAQ {index + 1}</strong>
                  <div className={styles.reviewAgentChipRow}>
                    <span className={isComplete ? styles.reviewAgentSuccessPill : styles.reviewAgentNeedPill}>
                      {isComplete ? "작성 완료" : "검토 필요"}
                    </span>
                    <button className={styles.supportAgentDeleteButton} type="button" onClick={() => handleRemoveFaq(faq.id)}>
                      제거
                    </button>
                  </div>
                </div>
                <input
                  className={styles.agentPreviewInput}
                  value={faq.question}
                  placeholder="예: 핵심 변경은 무엇인가요?"
                  onChange={(event) => handleFaqChange(faq.id, "question", event.target.value)}
                />
                <textarea
                  className={styles.reviewAgentTextarea}
                  value={faq.answer}
                  placeholder="근거 중심 답변을 입력합니다."
                  onChange={(event) => handleFaqChange(faq.id, "answer", event.target.value)}
                />
                {!isComplete && hasAnyContent ? (
                  <p className={styles.agentPreviewHint}>한쪽이 비어 있어 검토 필요로 표시됩니다.</p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.reviewAgentPanel}>
        <div className={styles.agentPreviewCardHeader}>
          <div>
            <h3 className={styles.agentPreviewSectionTitle}>PPT 생성</h3>
            <p className={styles.agentPreviewUploadText}>
              구조화된 공지 본문과 FAQ를 확인한 뒤 현장공지 초안 파일을 생성합니다.
            </p>
          </div>
          <span className={approved ? styles.reviewAgentSuccessPill : styles.agentPreviewStatusPill}>
            {approved ? "승인 완료" : "내부 검토용 초안"}
          </span>
        </div>

        <div className={styles.supportAgentActionRow}>
          <button
            className={styles.reviewAgentPrimaryButton}
            type="button"
            disabled={!draftCreated || !hasEditableDraft}
            onClick={handleGeneratePptDraft}
          >
            PPT 생성
          </button>
          <button className={styles.supportAgentSecondaryButton} type="button" onClick={() => setApproved(true)}>
            검토 및 승인하기
          </button>
          <span className={styles.supportAgentActionHint}>
            {pptGenerated ? "PPT 초안용 HTML 파일이 다운로드되었습니다." : "최종 편집본 기준으로 생성됩니다."}
          </span>
        </div>
      </section>

      <section className={styles.reviewAgentApprovalPanel}>
        <div className={styles.agentPreviewCardHeader}>
          <div>
            <h3 className={styles.agentPreviewSectionTitle}>공통 승인</h3>
            <p className={styles.agentPreviewUploadText}>
              지원 Agent 결과는 시스템 반영 정보 검토가 필요하고, 심사 Agent 결과는 현장공지 배포 전 승인이 필요합니다.
            </p>
          </div>
        </div>

        <div className={styles.reviewAgentApprovalCard}>
          <div className={styles.reviewAgentApprovalTextBlock}>
            <strong className={styles.reviewAgentApprovalTitle}>검토 및 승인 대상</strong>
            <p className={styles.reviewAgentApprovalDesc}>
              현재 편집본과 생성된 PPT 초안을 확인한 뒤 승인 상태를 최종 기록합니다.
            </p>
          </div>
          <button className={styles.reviewAgentApprovalButton} type="button" onClick={() => setApproved(true)}>
            검토 및 승인하기
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}

function PreInquiryAgentPreview() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState<InquiryEvidence[]>([]);
  const [source, setSource] = useState<"bizrouter" | "local">("local");
  const [status, setStatus] = useState("원본 업로드 파일 기준으로 자연어 질문을 입력해 주세요.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false);
  const [adoptedMessage, setAdoptedMessage] = useState("");

  const canSubmit = question.trim().length > 0 && !isSubmitting;
  const canAdopt = answer.trim().length > 0 && evidence.length > 0 && !isAdopting;
  const preInquiryFlowIndex = !question.trim()
    ? 0
    : !answer.trim()
      ? 1
      : !adoptedMessage
        ? 2
        : 3;

  async function handleAsk() {
    if (!question.trim()) {
      setStatus("질문을 먼저 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setAdoptedMessage("");
    setStatus("원본 업로드 파일에서 관련 근거를 찾고 답변을 생성하고 있습니다.");

    try {
      const response = await fetch("/api/pre-inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ question })
      });

      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        result?: {
          answer: string;
          source: "bizrouter" | "local";
          evidence: InquiryEvidence[];
        };
      };

      if (!response.ok || !data.ok || !data.result) {
        setStatus(data.message ?? "사전문의 답변 생성에 실패했습니다.");
        setAnswer("");
        setEvidence([]);
        return;
      }

      setAnswer(data.result.answer);
      setEvidence(data.result.evidence);
      setSource(data.result.source);
      setStatus(
        data.result.source === "bizrouter"
          ? "BizRouter 답변이 생성되었습니다."
          : "로컬 근거 요약 기반 답변이 생성되었습니다."
      );
    } catch {
      setStatus("사전문의 답변 생성에 실패했습니다.");
      setAnswer("");
      setEvidence([]);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAdopt() {
    if (!canAdopt) {
      return;
    }

    setIsAdopting(true);
    setAdoptedMessage("");

    try {
      const response = await fetch("/api/pre-inquiry", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          answer,
          source,
          evidence
        })
      });

      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setAdoptedMessage(data.message ?? "채택 저장에 실패했습니다.");
        return;
      }

      setAdoptedMessage("채택한 답변이 로컬 히스토리에 저장되었습니다.");
    } catch {
      setAdoptedMessage("채택 저장에 실패했습니다.");
    } finally {
      setIsAdopting(false);
    }
  }

  return (
    <div className={styles.preInquiryAgentApp}>
      <AgentFlowBar
        labels={["질문 입력", "원본 파일 검색", "답변 확인", "채택 저장"]}
        activeIndex={preInquiryFlowIndex}
      />

      <section className={styles.preInquiryPanel}>
        <div className={styles.preInquiryHeader}>
          <div>
            <h3 className={styles.agentPreviewSectionTitle}>사전문의 Agent</h3>
            <p className={styles.preInquiryIntro}>
              기획 단계에서 통합마스터를 만들 때 사용한 원본 업로드 파일을 기준으로 질문을 읽고, 관련 Rule/Note/Map 근거를 찾아 자연어 답변 초안을 제공합니다.
            </p>
          </div>
          <div className={styles.reviewAgentChipRow}>
            <span className={styles.preInquiryInfoPill}>원본 파일 기반</span>
            <span className={source === "bizrouter" ? styles.reviewAgentSuccessPill : styles.agentPreviewStatusPill}>
              {source === "bizrouter" ? "BizRouter 답변" : "로컬 근거 답변"}
            </span>
          </div>
        </div>

        <label className={styles.agentPreviewFieldLabel}>
          <span className={styles.reviewAgentFieldTop}>질문 입력</span>
          <textarea
            className={styles.preInquiryTextarea}
            value={question}
            placeholder="예: 뇌혈관진단 한도는 얼마야? / 소액암진단과 연결된 주석은 뭐야?"
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>

        <div className={styles.supportAgentActionRow}>
          <button className={styles.reviewAgentPrimaryButton} type="button" disabled={!canSubmit} onClick={handleAsk}>
            {isSubmitting ? "답변 생성 중..." : "질문하기"}
          </button>
          <button
            className={styles.supportAgentSecondaryButton}
            type="button"
            onClick={() => {
              setQuestion("");
              setAnswer("");
              setEvidence([]);
              setAdoptedMessage("");
              setStatus("원본 업로드 파일 기준으로 자연어 질문을 입력해 주세요.");
            }}
          >
            초기화
          </button>
          <span className={styles.supportAgentActionHint}>{status}</span>
        </div>
      </section>

      <section className={styles.preInquiryPanel}>
        <div className={styles.agentPreviewCardHeader}>
          <h3 className={styles.agentPreviewSectionTitle}>근거로 사용한 원본 파일 항목</h3>
        </div>

        {evidence.length > 0 ? (
          <div className={styles.preInquiryEvidenceList}>
            {evidence.map((item) => (
              <article className={styles.preInquiryEvidenceCard} key={`${item.section}-${item.id}`}>
                <div className={styles.preInquiryEvidenceTop}>
                  <span className={styles.preInquiryEvidenceSection}>{item.section}</span>
                  <span className={styles.preInquiryEvidenceScore}>{`score ${item.score}`}</span>
                </div>
                <strong className={styles.preInquiryEvidenceTitle}>{item.title}</strong>
                <p className={styles.preInquiryEvidenceSummary}>{item.summary}</p>
                {(item.sourceFileName || item.sheetName || item.sourceLocation) ? (
                  <dl className={styles.preInquiryEvidenceMeta}>
                    {item.sourceFileName ? (
                      <>
                        <dt>원본 파일</dt>
                        <dd>{item.sourceFileName}</dd>
                      </>
                    ) : null}
                    {item.sheetName ? (
                      <>
                        <dt>시트명</dt>
                        <dd>{item.sheetName}</dd>
                      </>
                    ) : null}
                    {item.sourceLocation ? (
                      <>
                        <dt>출처위치</dt>
                        <dd>{item.sourceLocation}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.supportAgentEmptyPanel}>
            <h5 className={styles.supportAgentEmptyTitle}>근거 항목이 아직 없습니다</h5>
            <p className={styles.supportAgentEmptyText}>질문을 입력하면 관련 Rule Master, Note Master, Rule-Note Map, Change Log를 찾아 보여줍니다.</p>
          </div>
        )}
      </section>

      <section className={styles.preInquiryPanel}>
        <div className={styles.agentPreviewCardHeader}>
          <h3 className={styles.agentPreviewSectionTitle}>답변 초안</h3>
          <span className={styles.preInquiryInfoPill}>채택 가능</span>
        </div>

        <div className={styles.preInquiryAnswerPanel}>
          {answer ? (
            <pre className={styles.preInquiryAnswerText}>{answer}</pre>
          ) : (
            <p className={styles.supportAgentEmptyText}>답변이 생성되면 이 영역에 표시됩니다.</p>
          )}
        </div>

        <div className={styles.supportAgentActionRow}>
          <button className={styles.reviewAgentPrimaryButton} type="button" disabled={!canAdopt} onClick={handleAdopt}>
            {isAdopting ? "채택 저장 중..." : "채택하기"}
          </button>
          {adoptedMessage ? <span className={styles.supportAgentActionHint}>{adoptedMessage}</span> : null}
        </div>
      </section>
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
        { label: "심사", description: "심사 Agent 연결", scope: "review-agent" as const },
        { label: "사전문의", description: "원본파일 질의응답", scope: "common-core" as const }
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
        <HeroSection
          userSession={userSession}
          onLogout={() => {
            clearAuthSession();
            window.location.assign("/");
          }}
        />

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
              <AgentPreviewCard
                title="기획 Agent"
                description="기획 파트는 공통 코어 입력과 초안 작성 화면을 미리 보여주는 단계입니다. 기준 파일 업로드부터 통합 마스터 생성, 검토 질문, 초안 생성까지 한 흐름으로 이어집니다."
              >
                <HomePageContent
                  userSession={userSession}
                  showHero={false}
                  onOpenSupportAgent={() => setActiveTab("지원")}
                  onOpenReviewAgent={() => setActiveTab("심사")}
                />
              </AgentPreviewCard>
            ) : null}

            {activeTab === "지원" ? (
              <SupportAgentFrame />
            ) : null}

            {activeTab === "심사" ? <ReviewAgentFrame src="/review-agent/index.html" height={3600} /> : null}

            {activeTab === "사전문의" ? (
              <AgentPreviewCard
                title="사전문의 Agent"
                description="사전문의 파트는 원본 업로드 파일 기준 자연어 질의응답 화면입니다. 관련 근거를 먼저 보여주고, 답변을 채택하면 로컬 히스토리에 저장합니다."
              >
                <PreInquiryAgentPreview />
              </AgentPreviewCard>
            ) : null}
          </div>

          <div className={styles.agentHubStatusRow}>
            <span className={styles.agentHubStatusPill}>
              현재 허용: {activeTab}
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
