"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroSection } from "@/components/hero-section";
import { InputStage } from "@/components/input-stage";
import { ReviewStage } from "@/components/review-stage";
import { StepProgressBar } from "@/components/step-progress-bar";
import styles from "@/components/components.module.css";
import { canUseAgentScope, clearAuthSession } from "@/lib/session";
import type { DraftSummary, DraftWorkbookData } from "@/lib/draft-builder";
import { extractProductCandidatesFromFiles } from "@/lib/product-candidate-parser";
import { sampleProductOptions } from "@/lib/sample-data";
import type { SampleProductOption } from "@/lib/sample-data";
import type { AuthSession } from "@/lib/session";
import type { ParsedProductCandidate } from "@/lib/product-candidate-parser";

type Step = "input" | "review";

type HomePageProps = {
  userSession?: AuthSession | null;
};

export default function HomePage({ userSession }: HomePageProps) {
  const [step, setStep] = useState<Step>("input");
  const [rawInput, setRawInput] = useState("");
  const [masterFiles, setMasterFiles] = useState<File[]>([]);
  const [masterFileNames, setMasterFileNames] = useState<string[]>([]);
  const [changeFileNames, setChangeFileNames] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingMaster, setIsCreatingMaster] = useState(false);
  const [isMasterCreated, setIsMasterCreated] = useState(false);
  const [finalSummary, setFinalSummary] = useState<DraftSummary | null>(null);
  const [masterPreview, setMasterPreview] = useState<DraftWorkbookData | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [productName, setProductName] = useState("");
  const [isDownloadingMaster, setIsDownloadingMaster] = useState(false);
  const [isDownloadingProduct, setIsDownloadingProduct] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [parsedMasterProductOptions, setParsedMasterProductOptions] = useState<ParsedProductCandidate[]>([]);
  const department = userSession?.department ?? "";
  const canUseCommonCore = canUseAgentScope(department, "common-core");
  const masterPrimaryFileName = masterFileNames[0] ?? "";
  const changePrimaryFileName = changeFileNames[0] ?? "";
  const primaryFileName = changePrimaryFileName || masterPrimaryFileName;
  const productOptions = useMemo(() => {
    const merged = new Map<string, SampleProductOption>();

    const upsert = (option: SampleProductOption, force = false) => {
      const key = (option.productName || option.productCode || "").trim().toLowerCase();
      if (!key) {
        return;
      }

      const existing = merged.get(key);
      if (!existing || force) {
        merged.set(key, option);
      }
    };

    sampleProductOptions.forEach((option) => upsert(option));
    parsedMasterProductOptions.forEach((option) => upsert(option, true));

    return Array.from(merged.values());
  }, [parsedMasterProductOptions]);

  useEffect(() => {
    let cancelled = false;

    if (masterFiles.length === 0) {
      setParsedMasterProductOptions([]);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const parsed = await extractProductCandidatesFromFiles(masterFiles);
        if (!cancelled) {
          setParsedMasterProductOptions(parsed);
        }
      } catch {
        if (!cancelled) {
          setParsedMasterProductOptions([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [masterFiles]);

  async function handleCreateMasterWorkbook() {
    if (masterFileNames.length === 0) {
      setSubmitError("STEP 0에서 가이드라인 엑셀을 먼저 업로드해 주세요.");
      return;
    }

    setIsCreatingMaster(true);
    setSubmitError("");

    try {
      const parsedProducts = await extractProductCandidatesFromFiles(masterFiles);
      setParsedMasterProductOptions(parsedProducts);

      const response = await fetch("/api/master-workbook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uploadedFiles: masterFileNames,
          fileName: masterPrimaryFileName,
          masterProducts: parsedProducts
        })
      });

      if (!response.ok) {
        setSubmitError("통합 마스터 파일 만들기에 실패했습니다. 다시 시도해 주세요.");
        return;
      }

      setIsMasterCreated(true);
      setPreviewError("");
    } catch {
      setSubmitError("통합 마스터 파일 만들기에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setIsCreatingMaster(false);
    }
  }

  async function handlePreviewMasterWorkbook() {
    if (masterFileNames.length === 0) {
      setPreviewError("미리보기를 보려면 먼저 가이드라인 엑셀을 업로드해 주세요.");
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError("");

    try {
      const response = await fetch("/api/master-workbook");

      if (!response.ok) {
        setPreviewError("저장된 통합 마스터 파일을 아직 찾지 못했습니다.");
        return;
      }

      const data = (await response.json()) as { preview?: DraftWorkbookData };
      if (data.preview) {
        setMasterPreview(data.preview);
      } else {
        setPreviewError("미리보기 데이터를 불러오지 못했습니다.");
      }
    } catch {
      setPreviewError("미리보기 데이터를 불러오지 못했습니다.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  function startDirectDownload(downloadUrl: string, fileName: string) {
    const isJsdom = navigator.userAgent.toLowerCase().includes("jsdom");

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    link.rel = "noopener";
    link.target = "_self";
    document.body.append(link);
    link.click();
    link.remove();

    if (!isJsdom) {
      window.setTimeout(() => {
        // 직접 링크 방식이 막힌 환경에서는 서버 첨부 응답으로 한 번 더 시도한다.
        window.location.assign(downloadUrl);
      }, 0);
    }
  }

  async function handleDownloadMaster() {
    setIsDownloadingMaster(true);
    const downloadName = "integrated-master-preview.xlsx";
    const downloadUrl = `/api/draft-export?${new URLSearchParams({
      fileName: primaryFileName,
      rawInput,
      answers: JSON.stringify(answers),
      exportMode: "master",
      masterProducts: JSON.stringify(parsedMasterProductOptions),
      uploadedFiles: JSON.stringify(changeFileNames),
      masterFiles: JSON.stringify(masterFileNames)
    }).toString()}`;

    startDirectDownload(downloadUrl, downloadName);
    window.setTimeout(() => setIsDownloadingMaster(false), 1000);
  }

  async function handleDownloadProduct() {
    if (!productName.trim()) {
      return;
    }

    setIsDownloadingProduct(true);
    const downloadName = `${productName.trim()}-extract-preview.xlsx`;
    const downloadUrl = `/api/draft-export?${new URLSearchParams({
      fileName: primaryFileName,
      rawInput,
      answers: JSON.stringify(answers),
      exportMode: "product",
      productName: productName.trim(),
      masterProducts: JSON.stringify(parsedMasterProductOptions),
      uploadedFiles: JSON.stringify(changeFileNames),
      masterFiles: JSON.stringify(masterFileNames)
    }).toString()}`;

    startDirectDownload(downloadUrl, downloadName);
    window.setTimeout(() => setIsDownloadingProduct(false), 1000);
  }

  async function handleConfirmDraft() {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/draft-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: primaryFileName,
          rawInput,
          answers
        })
      });

      if (!response.ok) {
        setSubmitError("초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const data = (await response.json()) as { summary: DraftSummary };
      setFinalSummary(data.summary);
    } catch {
      setSubmitError("초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.pageShell}>
      <HeroSection />
      {userSession ? (
        <section className={styles.sessionBar}>
          <div className={styles.sessionCopy}>
            <span className={styles.sessionLabel}>로그인 정보</span>
            <strong className={styles.sessionName}>
              {userSession.name} · {userSession.department}
            </strong>
            <span className={styles.sessionMeta}>사번 {userSession.employeeId}</span>
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              clearAuthSession();
              window.location.assign("/");
            }}
          >
            로그아웃
          </button>
        </section>
      ) : null}
      <StepProgressBar step={step} isDraftReady={Boolean(finalSummary)} />
      <div className={styles.stepFlowStack}>
        <InputStage
          rawInput={rawInput}
          masterFileNames={masterFileNames}
          changeFileNames={changeFileNames}
          masterPreview={masterPreview}
          isActionDisabled={!canUseCommonCore}
          isMasterCreated={isMasterCreated}
          isCreatingMaster={isCreatingMaster}
          isPreviewLoading={isPreviewLoading}
          previewError={previewError}
          onRawInputChange={setRawInput}
          onMasterFileChange={(files) => {
            setMasterFiles(files);
            setMasterFileNames(files.map((file) => file.name));
            setChangeFileNames([]);
            setAnswers({});
            setFinalSummary(null);
            setMasterPreview(null);
            setStep("input");
            setIsMasterCreated(false);
            setSubmitError("");
            setPreviewError("");
          }}
          onChangeFileChange={(files) => {
            setChangeFileNames(files.map((file) => file.name));
            setFinalSummary(null);
          }}
          onCreateMasterWorkbook={handleCreateMasterWorkbook}
          onPreviewMasterWorkbook={handlePreviewMasterWorkbook}
          onComplete={() => setStep("review")}
        />
        {step === "review" ? (
          <ReviewStage
            masterFileNames={masterFileNames}
            changeFileNames={changeFileNames}
            rawInput={rawInput}
            answers={answers}
            isActionDisabled={!canUseCommonCore}
            isSubmitting={isSubmitting}
            finalSummary={finalSummary}
            submitError={submitError}
            isMasterCreated={isMasterCreated}
            productName={productName}
            productOptions={productOptions}
            isDownloadingMaster={isDownloadingMaster}
            isDownloadingProduct={isDownloadingProduct}
            onAnswerChange={(id, value) =>
              setAnswers((current) => ({ ...current, [id]: value }))
            }
            onProductNameChange={setProductName}
            onProductSelect={setProductName}
            onConfirmDraft={handleConfirmDraft}
            onDownloadMaster={handleDownloadMaster}
            onDownloadProduct={handleDownloadProduct}
          />
        ) : null}
      </div>
    </main>
  );
}
