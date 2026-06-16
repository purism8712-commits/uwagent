import type { ParsedProductCandidate } from "@/lib/product-candidate-parser";

export type DraftRequest = {
  fileName: string;
  rawInput: string;
  answers: Record<string, string>;
  productName?: string;
  uploadedFiles?: string[];
  masterProducts?: ParsedProductCandidate[];
};

export type LegacyDraftRequest = {
  uploadedFileName?: string;
  userInput?: string;
  questionAnswers?: string[];
  answers?: Record<string, string> | null;
  fileName?: string;
  rawInput?: string;
  productName?: string;
  uploadedFiles?: string[] | null;
  masterProducts?: unknown[] | null;
};

export type DraftSummary = {
  target: string;
  beforeValue: string;
  afterValue: string;
  appliedAnswers: string[];
  pendingNotes: string[];
};

export type DraftWorkbookData = {
  overview: Record<string, string>[];
  ruleMaster: Record<string, string | number>[];
  noteMaster: Record<string, string | number>[];
  ruleNoteMap: Record<string, string | number>[];
  changeLog: Record<string, string | number>[];
  summary: DraftSummary;
};

export function normalizeDraftRequest(payload: unknown): DraftRequest {
  const request = (payload ?? {}) as LegacyDraftRequest;
  const normalizedAnswers =
    request.answers && typeof request.answers === "object"
      ? request.answers
      : Array.isArray(request.questionAnswers)
        ? Object.fromEntries(
            request.questionAnswers.map((answer, index) => [
              `legacy-${index + 1}`,
              answer
            ])
          )
        : {};

  return {
    fileName: request.fileName ?? request.uploadedFileName ?? "",
    rawInput: request.rawInput ?? request.userInput ?? "",
    answers: normalizedAnswers,
    productName: request.productName ?? "",
    uploadedFiles: Array.isArray(request.uploadedFiles)
      ? request.uploadedFiles.filter((item): item is string => typeof item === "string")
      : [],
    masterProducts: Array.isArray(request.masterProducts)
      ? request.masterProducts.filter((item): item is ParsedProductCandidate => {
          if (!item || typeof item !== "object") {
            return false;
          }

          const candidate = item as Partial<ParsedProductCandidate>;
          return typeof candidate.productName === "string" && typeof candidate.sourceFileName === "string";
        })
      : []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function deriveProductLabel(fileName: string) {
  const baseName = stripExtension(fileName).trim();

  if (!baseName) {
    return "";
  }

  return baseName
    .replace(/\s*신계약가이드라인$/i, "")
    .replace(/\s*가이드라인$/i, "")
    .trim();
}

function uniqueFiles(fileNames: string[]) {
  return Array.from(new Set(fileNames.map((name) => name.trim()).filter(Boolean)));
}

function buildFileStandardizationRows(uploadedFiles: string[], productName: string) {
  const normalizedFiles = uniqueFiles(uploadedFiles);

  if (normalizedFiles.length === 0) {
    return [];
  }

  return normalizedFiles.map((fileName, index) => {
    const baseName = stripExtension(fileName);
    const fileProductName = deriveProductLabel(fileName) || productName;
    return {
      파일구분: `원본 ${index + 1}`,
      원본파일명: fileName,
      표준템플릿명: `${baseName}-표준템플릿`,
      표준화상태: "완료",
      머지대상: "전체 통합 마스터",
      병합순서: index + 1,
      상품명: fileProductName,
      상품코드: "",
      보험코드: "",
      판매일자: "",
      검토메모: `${baseName}를 표준 템플릿으로 변환 후 통합 대상으로 포함`
    };
  });
}

function buildUploadedProductRows(
  masterProducts: ParsedProductCandidate[],
  uploadedFiles: string[],
  fallbackProductName: string
) {
  if (masterProducts.length === 0) {
    return buildFileStandardizationRows(uploadedFiles, fallbackProductName);
  }

  return masterProducts.map((product, index) => {
    const sourceFileName = product.sourceFileName || uploadedFiles[index] || `원본 ${index + 1}`;
    const baseName = stripExtension(sourceFileName || product.productName || `원본 ${index + 1}`);
    return {
      파일구분: `원본 ${index + 1}`,
      원본파일명: sourceFileName,
      표준템플릿명: `${baseName}-표준템플릿`,
      표준화상태: "완료",
      머지대상: "전체 통합 마스터",
      병합순서: index + 1,
      상품명: product.productName || fallbackProductName,
      상품코드: product.productCode || "",
      보험코드: product.insuranceCode || "",
      판매일자: product.saleDate || "",
      검토메모: product.summary
        ? `${product.summary} / 표준 템플릿으로 변환`
        : `${baseName}를 표준 템플릿으로 변환 후 통합 대상으로 포함`
    };
  });
}

function buildMergedWorkbookRow(
  uploadedFiles: string[],
  productName: string,
  fileName: string,
  masterProducts: ParsedProductCandidate[]
) {
  const normalizedFiles = uniqueFiles(uploadedFiles);
  const firstProduct = masterProducts[0];
  const mergedSourceNames =
    masterProducts.length > 0
      ? uniqueFiles(masterProducts.map((item) => item.sourceFileName))
      : normalizedFiles;
  const joinedNames =
    mergedSourceNames.length > 0 ? mergedSourceNames.join(" + ") : fileName || "직접 입력 기반";

  return {
    파일구분: "전체 통합본",
    원본파일명: joinedNames,
    표준템플릿명: "전체 통합 마스터",
    표준화상태: mergedSourceNames.length > 0 ? "머지 완료" : "기본 생성",
    머지대상: mergedSourceNames.length > 0 ? `${mergedSourceNames.length}개 파일` : "1개 입력",
    병합순서: "ALL",
    상품명: productName,
    상품코드: firstProduct?.productCode || "MASTER",
    보험코드: firstProduct?.insuranceCode || "MASTER",
    판매일자: firstProduct?.saleDate || "",
    검토메모: normalizedFiles.length > 0
      ? "파일별 표준화 결과를 하나의 통합 마스터로 병합"
      : "단일 입력 기준으로 통합 마스터 생성"
  };
}

export function buildDraftWorkbookData(request: DraftRequest): DraftWorkbookData {
  const answerValues = Object.values(request.answers ?? {}).filter(Boolean);
  const uploadedFiles = uniqueFiles(request.uploadedFiles ?? []);
  const masterProducts = request.masterProducts ?? [];
  const hasMasterProducts = masterProducts.length > 0;
  const workbookProductName =
    request.productName?.trim() ||
    masterProducts[0]?.productName?.trim() ||
    deriveProductLabel(uploadedFiles[0] ?? "") ||
    "건강하고 튼튼하게";
  const saleDate = masterProducts[0]?.saleDate?.trim() || "2026-04-01";
  const hasUploadedFiles = uploadedFiles.length > 0 || hasMasterProducts;
  const standardizedRows = buildUploadedProductRows(masterProducts, uploadedFiles, workbookProductName);
  const mergedWorkbookRow = buildMergedWorkbookRow(
    uploadedFiles,
    workbookProductName,
    request.fileName,
    masterProducts
  );

  const summary: DraftSummary = {
    target: "소액암진단",
    beforeValue: "단일건 1000",
    afterValue: "단일건 2000",
    appliedAnswers:
      answerValues.length > 0
        ? answerValues
        : ["질문 답변 미입력 - 기본 초안으로 생성"],
    pendingNotes: ["66세 이상 예외 주석은 최종 검토 필요"]
  };

  return {
    overview: hasUploadedFiles
      ? [
          { 항목: "상품명", 값: workbookProductName },
          { 항목: "판매일자", 값: saleDate },
          { 항목: "상품 코드 수", 값: `${standardizedRows.length}개` },
          { 항목: "업로드 파일 수", 값: `${uploadedFiles.length}개` },
          { 항목: "처리 방식", 값: "파일별 표준화 후 단일 통합 마스터 병합" }
        ]
      : [
          { 항목: "상품명", 값: workbookProductName },
          { 항목: "판매일자", 값: saleDate }
        ],
    summary,
    ruleMaster: hasUploadedFiles
      ? [
          ...standardizedRows.map((row, index) => ({
            상품명: row.상품명,
            상품코드: row.상품코드,
            보험코드: row.보험코드,
            판매일자: saleDate,
            "Rule ID": `R-0${index + 1}`,
            상태: "표준화 완료",
            특약명: `파일별 템플릿 ${index + 1}`,
            "as-is 일반/건강 단일건": 1000,
            "to-be 일반/건강 단일건": 2000,
            "as-is 간편 단일건": 1000,
            "to-be 간편 단일건": 2000,
            인별합산: 3000,
            주석ID: "N-002,N-003",
            출처위치: row.원본파일명,
            검토메모: row.검토메모,
            초안상태: "초안"
          })),
          {
            상품명: workbookProductName,
            상품코드: mergedWorkbookRow.상품코드,
            보험코드: mergedWorkbookRow.보험코드,
            판매일자: saleDate,
            "Rule ID": "R-MERGED",
            상태: mergedWorkbookRow.표준화상태,
            특약명: mergedWorkbookRow.표준템플릿명,
            "as-is 일반/건강 단일건": 1000,
            "to-be 일반/건강 단일건": 2000,
            "as-is 간편 단일건": 1000,
            "to-be 간편 단일건": 2000,
            인별합산: 3000,
            주석ID: "N-002,N-003",
            출처위치: mergedWorkbookRow.원본파일명,
            검토메모: mergedWorkbookRow.검토메모,
            초안상태: "초안"
          }
        ]
      : [
      {
        상품명: workbookProductName,
        상품코드: "LI00113",
        보험코드: "LI00113",
        판매일자: saleDate,
        "Rule ID": "R-003",
        상태: "시행예정",
        특약명: "소액암진단",
        "as-is 일반/건강 단일건": 1000,
        "to-be 일반/건강 단일건": 2000,
        "as-is 간편 단일건": 1000,
        "to-be 간편 단일건": 2000,
        인별합산: 3000,
        주석ID: "N-002,N-003",
        출처위치: request.fileName || "직접 입력 기반",
        검토메모: "소액암진단 단일건 한도 상향 초안. 인별합산 및 주석 영향 검토 필요",
        초안상태: "초안"
      }
      ],
    noteMaster: hasUploadedFiles
      ? [
          ...standardizedRows.map((row, index) => ({
            상품명: row.상품명,
            상품코드: row.상품코드,
            보험코드: row.보험코드,
            "Note ID": `N-0${index + 1}`,
            주석명: `${stripExtension(uploadedFiles[index])} 표준화 메모`,
            "주석 원문": `${row.원본파일명}를 표준 템플릿으로 변환`,
            주석유형: "파일별 표준화",
            적용대상: `R-0${index + 1}`,
            우선순위: 1,
            출처위치: row.원본파일명,
            검토메모: row.검토메모
          })),
          {
            상품명: workbookProductName,
            상품코드: mergedWorkbookRow.상품코드,
            보험코드: mergedWorkbookRow.보험코드,
            "Note ID": "N-MERGED",
            주석명: "통합 머지 메모",
            "주석 원문": "파일별 표준화 결과를 하나의 통합 마스터로 병합",
            주석유형: "병합조건",
            적용대상: "R-MERGED",
            우선순위: 1,
            출처위치: mergedWorkbookRow.원본파일명,
            검토메모: mergedWorkbookRow.검토메모
          }
        ]
      : [
      {
        상품명: workbookProductName,
        상품코드: "LI00113",
        보험코드: "LI00113",
        "Note ID": "N-002",
        주석명: "암진단-소액암 연계",
        "주석 원문": "암진단 가입시 소액암 진단 가입필수",
        주석유형: "연계조건",
        적용대상: "R-003",
        우선순위: 1,
        출처위치: "Sheet1!B19",
        검토메모: "단일건 한도 상향 시 연계조건 영향 여부 확인"
      },
      {
        상품명: workbookProductName,
        상품코드: "LI00113",
        보험코드: "LI00113",
        "Note ID": "N-003",
        주석명: "소액암 인별합산 예외",
        "주석 원문": "소액암 진단 인별합산 한도 5천만원 (단, 66세 이상 3천만)",
        주석유형: "예외/상향기준",
        적용대상: "R-003",
        우선순위: 1,
        출처위치: "Sheet1!B20",
        검토메모: "66세 이상 예외 주석은 최종 검토 필요"
      }
      ],
    ruleNoteMap: hasUploadedFiles
      ? [
          ...standardizedRows.map((row, index) => ({
            상품명: row.상품명,
            상품코드: row.상품코드,
            보험코드: row.보험코드,
            "Rule ID": `R-0${index + 1}`,
            "Note ID": `N-0${index + 1}`,
            적용범위: "파일별 템플릿",
            적용방식: "표준화 후 병합",
            출처위치: row.원본파일명,
            검토필요: "N"
          })),
          {
            상품명: workbookProductName,
            상품코드: mergedWorkbookRow.상품코드,
            보험코드: mergedWorkbookRow.보험코드,
            "Rule ID": "R-MERGED",
            "Note ID": "N-MERGED",
            적용범위: "전체 통합본",
            적용방식: "머지 결과 반영",
            출처위치: mergedWorkbookRow.원본파일명,
            검토필요: "Y"
          }
        ]
      : [
      {
        상품명: workbookProductName,
        상품코드: "LI00113",
        보험코드: "LI00113",
        "Rule ID": "R-003",
        "Note ID": "N-002",
        적용범위: "단일행",
        적용방식: "연계조건 적용",
        출처위치: "Sheet1!E7 + Sheet1!B19",
        검토필요: "N"
      },
      {
        상품명: workbookProductName,
        상품코드: "LI00113",
        보험코드: "LI00113",
        "Rule ID": "R-003",
        "Note ID": "N-003",
        적용범위: "단일행",
        적용방식: "예외 적용",
        출처위치: "Sheet1!E7 + Sheet1!B20",
        검토필요: "Y"
      }
      ],
    changeLog: hasUploadedFiles
      ? [
          {
            상품명: workbookProductName,
            상품코드: mergedWorkbookRow.상품코드,
            보험코드: mergedWorkbookRow.보험코드,
            "Change ID": "C-001",
            "Rule ID": "R-MERGED",
            상태변경: "파일별 표준화 -> 통합 머지",
            현행값: uploadedFiles.join(" / "),
            변경값: mergedWorkbookRow.표준템플릿명,
            사유: request.rawInput || "업로드한 파일을 표준 템플릿으로 정리 후 전체 통합본으로 병합",
            적용일: "검토 필요",
            비고: mergedWorkbookRow.검토메모
          }
        ]
      : [
      {
        상품명: workbookProductName,
        상품코드: "LI00113",
        보험코드: "LI00113",
        "Change ID": "C-001",
        "Rule ID": "R-003",
        상태변경: "현행 -> 시행예정",
        현행값: "일반/건강 단일건 1000 / 간편 단일건 1000",
        변경값: "일반/건강 단일건 2000 / 간편 단일건 2000",
        사유: request.rawInput || "소액암진단 단일건 한도 상향",
        적용일: "검토 필요",
        비고: summary.appliedAnswers.join(" | ")
      }
      ]
  };
}
