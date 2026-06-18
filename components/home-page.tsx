"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroSection } from "@/components/hero-section";
import { InputStage } from "@/components/input-stage";
import { ReviewStage } from "@/components/review-stage";
import { StepProgressBar } from "@/components/step-progress-bar";
import styles from "@/components/components.module.css";
import { canUseAgentScope, clearAuthSession } from "@/lib/session";
import type { DraftSummary, DraftWorkbookData } from "@/lib/draft-builder";
import { buildDraftWorkbookData } from "@/lib/draft-builder";
import {
  buildFallbackProductCandidates,
  extractProductCandidatesFromFiles
} from "@/lib/product-candidate-parser";
import { buildTargetCandidates, findSelectedTargetCandidate } from "@/lib/target-resolution";
import { sampleProductOptions } from "@/lib/sample-data";
import type { SampleProductOption } from "@/lib/sample-data";
import type { AuthSession } from "@/lib/session";
import type { ParsedProductCandidate } from "@/lib/product-candidate-parser";

type Step = "input" | "review";

const SUPPORT_AGENT_URL = "https://uw-guide.vercel.app/support-agent-app.html";
const REVIEW_AGENT_URL = "https://review-agent-lovat.vercel.app/";
const MASTER_WORKBOOK_STORAGE_KEY = "uwagent.master-workbook-state";

type StoredMasterWorkbookState = {
  uploadedFiles: string[];
  masterProducts: ParsedProductCandidate[];
  savedAt: string;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStoredMasterWorkbookState(): StoredMasterWorkbookState | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MASTER_WORKBOOK_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredMasterWorkbookState>;
    const uploadedFiles = Array.isArray(parsed.uploadedFiles)
      ? parsed.uploadedFiles.filter((value): value is string => typeof value === "string")
      : [];
    const masterProducts = Array.isArray(parsed.masterProducts)
      ? parsed.masterProducts.filter((value): value is ParsedProductCandidate => {
          if (!value || typeof value !== "object") {
            return false;
          }

          const candidate = value as Partial<ParsedProductCandidate>;
          return typeof candidate.productName === "string" && typeof candidate.sourceFileName === "string";
        })
      : [];

    if (uploadedFiles.length === 0) {
      return null;
    }

    return {
      uploadedFiles,
      masterProducts,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : ""
    };
  } catch {
    return null;
  }
}

function writeStoredMasterWorkbookState(state: StoredMasterWorkbookState) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(MASTER_WORKBOOK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore browser storage failures and keep the server-backed flow working.
  }
}

function clearStoredMasterWorkbookState() {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(MASTER_WORKBOOK_STORAGE_KEY);
  } catch {
    // Ignore browser storage failures and keep the server-backed flow working.
  }
}

type HomePageProps = {
  userSession?: AuthSession | null;
};

export function HomePageContent({ userSession }: HomePageProps) {
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
  const [finalUploadStatus, setFinalUploadStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [parsedMasterProductOptions, setParsedMasterProductOptions] = useState<ParsedProductCandidate[]>([]);
  const [hasRestoredStoredMaster, setHasRestoredStoredMaster] = useState(false);
  const [selectedTargetCandidateId, setSelectedTargetCandidateId] = useState("");
  const department = userSession?.department ?? "";
  const canUseCommonCore = canUseAgentScope(department, "common-core");
  const masterPrimaryFileName = masterFileNames[0] ?? "";
  const changePrimaryFileName = changeFileNames[0] ?? "";
  const primaryFileName = changePrimaryFileName || masterPrimaryFileName;
  const targetCandidates = useMemo(
    () => buildTargetCandidates(rawInput, parsedMasterProductOptions),
    [parsedMasterProductOptions, rawInput]
  );
  const selectedTargetCandidate = useMemo(
    () => findSelectedTargetCandidate(targetCandidates, selectedTargetCandidateId),
    [selectedTargetCandidateId, targetCandidates]
  );
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
    buildFallbackProductCandidates(masterFileNames).forEach((option) => upsert(option, true));
    parsedMasterProductOptions.forEach((option) => upsert(option, true));

    return Array.from(merged.values());
  }, [masterFileNames, parsedMasterProductOptions]);

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

  useEffect(() => {
    let cancelled = false;

    if (hasRestoredStoredMaster) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const response = await fetch("/api/master-workbook");
        if (!response.ok) {
          const storedState = readStoredMasterWorkbookState();

          if (!cancelled && storedState) {
            const restoredProducts =
              storedState.masterProducts.length > 0
                ? storedState.masterProducts
                : buildFallbackProductCandidates(storedState.uploadedFiles);

            setMasterFileNames(storedState.uploadedFiles);
            setParsedMasterProductOptions(restoredProducts);
            setMasterPreview(
              buildDraftWorkbookData(
                {
                  fileName: storedState.uploadedFiles[0] ?? "",
                  rawInput: "",
                  answers: {},
                  uploadedFiles: storedState.uploadedFiles,
                  masterProducts: restoredProducts,
                  selectedTargetCandidate: null
                },
                { mode: "master" }
              )
            );
            setIsMasterCreated(true);
          }

          if (!cancelled) {
            setHasRestoredStoredMaster(true);
          }
          return;
        }

        const data = (await response.json()) as {
          snapshot?: {
            uploadedFiles?: string[];
            request?: {
              masterProducts?: ParsedProductCandidate[];
            };
          };
        };

        if (cancelled) {
          return;
        }

        const snapshotFileNames = Array.isArray(data.snapshot?.uploadedFiles)
          ? data.snapshot.uploadedFiles
          : [];
        const snapshotProducts = Array.isArray(data.snapshot?.request?.masterProducts)
          ? data.snapshot.request.masterProducts
          : [];

        if (snapshotFileNames.length > 0) {
          setMasterFileNames(snapshotFileNames);
          setIsMasterCreated(true);
          setParsedMasterProductOptions(
            snapshotProducts.length > 0
              ? snapshotProducts
              : buildFallbackProductCandidates(snapshotFileNames)
          );
          writeStoredMasterWorkbookState({
            uploadedFiles: snapshotFileNames,
            masterProducts:
              snapshotProducts.length > 0
                ? snapshotProducts
                : buildFallbackProductCandidates(snapshotFileNames),
            savedAt: new Date().toISOString()
          });
        }
      } catch {
        // Ignore restore failures and let the page continue with empty local state.
      } finally {
        if (!cancelled) {
          setHasRestoredStoredMaster(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasRestoredStoredMaster]);

  useEffect(() => {
    if (selectedTargetCandidateId && !selectedTargetCandidate) {
      setSelectedTargetCandidateId("");
      return;
    }

    if (!selectedTargetCandidateId && targetCandidates.length === 1) {
      setSelectedTargetCandidateId(targetCandidates[0].id);
    }
  }, [selectedTargetCandidate, selectedTargetCandidateId, targetCandidates]);

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

      writeStoredMasterWorkbookState({
        uploadedFiles: masterFileNames,
        masterProducts: parsedProducts,
        savedAt: new Date().toISOString()
      });

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

      setIsMasterCreated(true);
      if (!response.ok) {
        setPreviewError("");
      }
      setPreviewError("");
    } catch {
      if (masterFileNames.length > 0) {
        setIsMasterCreated(true);
        setPreviewError("");
      } else {
        setSubmitError("통합 마스터 파일 만들기에 실패했습니다. 다시 시도해 주세요.");
      }
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
        const storedState = readStoredMasterWorkbookState();

        if (storedState) {
          const restoredProducts =
            storedState.masterProducts.length > 0
              ? storedState.masterProducts
              : buildFallbackProductCandidates(storedState.uploadedFiles);

          setMasterFileNames(storedState.uploadedFiles);
          setParsedMasterProductOptions(restoredProducts);
          setIsMasterCreated(true);
          setMasterPreview(
            buildDraftWorkbookData(
              {
                fileName: storedState.uploadedFiles[0] ?? "",
                rawInput,
                answers,
                uploadedFiles: storedState.uploadedFiles,
                masterProducts: restoredProducts,
                selectedTargetCandidate: null
              },
              { mode: "master" }
            )
          );
          setPreviewError("");
          return;
        }

        setPreviewError("저장된 통합 마스터 파일을 아직 찾지 못했습니다.");
        return;
      }

      const data = (await response.json()) as {
        preview?: DraftWorkbookData;
        snapshot?: {
          uploadedFiles?: string[];
          request?: {
            masterProducts?: ParsedProductCandidate[];
          };
        };
      };
      if (data.preview) {
        setMasterPreview(data.preview);
        writeStoredMasterWorkbookState({
          uploadedFiles:
            Array.isArray(data.snapshot?.uploadedFiles) && data.snapshot.uploadedFiles.length > 0
              ? data.snapshot.uploadedFiles
              : masterFileNames,
          masterProducts:
            Array.isArray(data.snapshot?.request?.masterProducts) &&
            data.snapshot.request.masterProducts.length > 0
              ? data.snapshot.request.masterProducts
              : parsedMasterProductOptions,
          savedAt: new Date().toISOString()
        });
        const snapshotFileNames = Array.isArray(data.snapshot?.uploadedFiles)
          ? data.snapshot.uploadedFiles
          : [];
        const snapshotProducts = Array.isArray(data.snapshot?.request?.masterProducts)
          ? data.snapshot.request.masterProducts
          : [];

        if (snapshotFileNames.length > 0) {
          setMasterFileNames(snapshotFileNames);
        }

        setParsedMasterProductOptions(
          snapshotProducts.length > 0
            ? snapshotProducts
            : buildFallbackProductCandidates(snapshotFileNames)
        );
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
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    link.rel = "noopener";
    link.target = "_self";
    document.body.append(link);
    link.click();
    link.remove();
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
      selectedTargetCandidate: JSON.stringify(selectedTargetCandidate ?? null),
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
      selectedTargetCandidate: JSON.stringify(selectedTargetCandidate ?? null),
      uploadedFiles: JSON.stringify(changeFileNames),
      masterFiles: JSON.stringify(masterFileNames)
    }).toString()}`;

    startDirectDownload(downloadUrl, downloadName);
    window.setTimeout(() => setIsDownloadingProduct(false), 1000);
  }

  async function handleFinalizeUpload() {
    setSubmitError("");
    setFinalUploadStatus("");

    if (masterFileNames.length === 0) {
      setFinalUploadStatus("최종 업로드를 하려면 먼저 통합 마스터 파일을 만들어 주세요.");
      return;
    }

    try {
      const response = await fetch("/api/master-workbook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uploadedFiles: masterFileNames,
          fileName: masterPrimaryFileName,
          masterProducts: parsedMasterProductOptions
        })
      });

      if (!response.ok) {
        setFinalUploadStatus("최종 업로드에 실패했습니다. 다시 시도해 주세요.");
        return;
      }

      setFinalUploadStatus("최종 업로드가 완료되었습니다.");
    } catch {
      setFinalUploadStatus("최종 업로드에 실패했습니다. 다시 시도해 주세요.");
    }
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
          answers,
          masterProducts: parsedMasterProductOptions,
          selectedTargetCandidate
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
    <>
      <HeroSection
        userSession={userSession}
        onLogout={() => {
          clearAuthSession();
          window.location.assign("/");
        }}
      />
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
          onRawInputChange={(value) => {
            setRawInput(value);
            setAnswers({});
            setFinalSummary(null);
            setFinalUploadStatus("");
            setSelectedTargetCandidateId("");
            setStep("input");
          }}
          onMasterFileChange={(files) => {
            setMasterFiles(files);
            setMasterFileNames(files.map((file) => file.name));
            setChangeFileNames([]);
            setAnswers({});
            setFinalSummary(null);
            setMasterPreview(null);
            setSelectedTargetCandidateId("");
            setStep("input");
            setIsMasterCreated(false);
            setSubmitError("");
            setPreviewError("");
            setFinalUploadStatus("");
            clearStoredMasterWorkbookState();
          }}
          onResetMasterFiles={() => {
            setMasterFiles([]);
            setMasterFileNames([]);
            setAnswers({});
            setFinalSummary(null);
            setMasterPreview(null);
            setSelectedTargetCandidateId("");
            setStep("input");
            setIsMasterCreated(false);
            setSubmitError("");
            setPreviewError("");
            setFinalUploadStatus("");
            clearStoredMasterWorkbookState();
          }}
          onChangeFileChange={(files) => {
            setChangeFileNames(files.map((file) => file.name));
            setFinalSummary(null);
            setFinalUploadStatus("");
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
            masterProducts={parsedMasterProductOptions}
            targetCandidates={targetCandidates}
            selectedTargetCandidateId={selectedTargetCandidateId}
            isDownloadingMaster={isDownloadingMaster}
            isDownloadingProduct={isDownloadingProduct}
            onAnswerChange={(id, value) =>
              setAnswers((current) => ({ ...current, [id]: value }))
            }
            onProductNameChange={setProductName}
            onProductSelect={setProductName}
            onTargetCandidateSelect={setSelectedTargetCandidateId}
            onConfirmDraft={handleConfirmDraft}
            onDownloadMaster={handleDownloadMaster}
            onDownloadProduct={handleDownloadProduct}
            onFinalizeUpload={handleFinalizeUpload}
            finalUploadStatus={finalUploadStatus}
            supportAgentUrl={SUPPORT_AGENT_URL}
            reviewAgentUrl={REVIEW_AGENT_URL}
          />
        ) : null}
      </div>
    </>
  );
}

export default function HomePage({ userSession }: HomePageProps) {
  return (
    <main className={styles.pageShell}>
      <HomePageContent userSession={userSession} />
    </main>
  );
}
