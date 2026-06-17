import type {
  ParsedProductCandidate,
  SpecialItemMapping
} from "@/lib/product-candidate-parser";
import {
  extractRequestedLimitValue,
  isNoopLimitChange,
  matchesDelimitedTerm,
  normalizeSearchText
} from "@/lib/change-intent";

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

type DraftRenderMode = "master" | "change";

type DraftWorkbookOptions = {
  mode?: DraftRenderMode;
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

function buildInsuranceDisplay(
  product?: Pick<ParsedProductCandidate, "insuranceCode" | "insuranceCodeMapping"> | null
) {
  return product?.insuranceCodeMapping?.trim() || product?.insuranceCode?.trim() || "";
}

function matchesRequestedChangeTarget(
  rawInput: string,
  specialName: string,
  insuranceCode: string
) {
  const normalizedInput = normalizeNoteTextValue(rawInput);
  if (!normalizeSearchText(normalizedInput)) {
    return false;
  }

  const candidateTerms = [specialName, insuranceCode]
    .map((value) => normalizeNoteTextValue(value))
    .filter(Boolean);

  return candidateTerms.some((term) => matchesDelimitedTerm(normalizedInput, term));
}

function buildExpandedInsuranceItems(product: ParsedProductCandidate, fallbackName: string) {
  const specialItems =
    Array.isArray(product.specialItems) && product.specialItems.length > 0
      ? product.specialItems
          .map((item): SpecialItemMapping => ({
            specialName: item.specialName?.trim() || fallbackName,
            insuranceCode: item.insuranceCode?.trim() || "",
            limitValue: item.limitValue?.trim() || undefined,
            noteText: item.noteText?.trim() || undefined
          }))
          .filter((item) => item.insuranceCode)
      : [];

  if (specialItems.length > 0) {
    return specialItems;
  }

  const insuranceCode = buildInsuranceDisplay(product);
  if (!insuranceCode) {
    return [];
  }

  return [
    {
      specialName: fallbackName,
      insuranceCode
    }
  ];
}

function resolveBaseLimitValue(masterProducts: ParsedProductCandidate[]) {
  for (const product of masterProducts) {
    for (const item of product.specialItems ?? []) {
      const limitValue = item.limitValue?.trim();
      if (limitValue) {
        return limitValue;
      }
    }
  }

  return "1000";
}

function resolveRenderMode(request: DraftRequest, requestedMode?: DraftRenderMode): DraftRenderMode {
  if (requestedMode) {
    return requestedMode;
  }

  const hasRawInput = Boolean(request.rawInput?.trim());
  const hasAnswers = Object.values(request.answers ?? {}).some((value) => Boolean(String(value).trim()));
  const uploadedFiles = uniqueFiles(request.uploadedFiles ?? []);
  const masterProducts = request.masterProducts ?? [];
  const hasAdditionalChangeFiles =
    masterProducts.length > 0 && uploadedFiles.length > masterProducts.length;

  return hasRawInput || hasAnswers || hasAdditionalChangeFiles ? "change" : "master";
}

function buildRuleMeasureFields(
  mode: DraftRenderMode,
  currentLimitValue: string,
  requestedLimitValue: string | null,
  shouldApplyRequestedLimit: boolean
) {
  const limitValue = currentLimitValue || requestedLimitValue || "1000";
  const nextLimitValue = shouldApplyRequestedLimit ? requestedLimitValue ?? limitValue : limitValue;
  const fields =
    mode === "change"
      ? {
          "as-is 일반/건강 단일건": limitValue,
          "to-be 일반/건강 단일건": nextLimitValue,
          "as-is 간편 단일건": limitValue,
          "to-be 간편 단일건": nextLimitValue
        }
      : {
          "as-is 일반/건강 단일건": limitValue,
          "as-is 간편 단일건": limitValue
        };

  return fields;
}

function buildRuleMeasureSummary(
  mode: DraftRenderMode,
  baseLimitValue: string,
  rawInput: string
) {
  const limitValue = baseLimitValue || "1000";
  const requestedLimitValue = extractRequestedLimitValue(rawInput);
  const noOpChange = Boolean(requestedLimitValue) && isNoopLimitChange(limitValue, rawInput);

  if (mode === "change") {
    return {
      beforeValue: `단일건 ${limitValue}`,
      afterValue: noOpChange ? "변경 없음" : `단일건 ${requestedLimitValue ?? "2000"}`,
      isNoOpChange: noOpChange
    };
  }

  return {
    beforeValue: `단일건 ${limitValue}`,
    afterValue: "대기 중",
    isNoOpChange: false
  };
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
      특약명: fileProductName,
      상품코드: "",
      보험코드: "",
      판매일자: "",
      검토메모: `${baseName}를 표준 템플릿으로 변환 후 통합 대상으로 포함`
    };
  });
}

function collectProductNames(rows: Record<string, string | number>[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => String(row.상품명 ?? "").trim())
        .filter(Boolean)
    )
  );
}

function buildUploadedProductRows(
  masterProducts: ParsedProductCandidate[],
  uploadedFiles: string[],
  fallbackProductName: string
) {
  if (masterProducts.length === 0) {
    return buildFileStandardizationRows(uploadedFiles, fallbackProductName);
  }

  return masterProducts.flatMap((product, index) => {
    const sourceFileName = product.sourceFileName || uploadedFiles[index] || `원본 ${index + 1}`;
    const baseName = stripExtension(sourceFileName || product.productName || `원본 ${index + 1}`);
    const rowProductName = product.productName || fallbackProductName;
    const insuranceItems = buildExpandedInsuranceItems(product, rowProductName);

    return insuranceItems.map((item, itemIndex) => {
      const rowLabel = item.specialName || rowProductName;
      const noteText = item.noteText || "";
      const limitValue = item.limitValue || "";
      const memoParts = [product.summary, noteText].filter(Boolean);
      return {
        파일구분: `원본 ${index + 1}`,
        원본파일명: sourceFileName,
        표준템플릿명: `${baseName}-표준템플릿`,
        표준화상태: "완료",
        머지대상: "전체 통합 마스터",
        병합순서: `${index + 1}-${itemIndex + 1}`,
        상품명: rowProductName,
        특약명: rowLabel,
        상품코드: product.productCode || "",
        보험코드: item.insuranceCode,
        가입한도: limitValue,
        비고: noteText,
        판매일자: product.saleDate || "",
        검토메모: memoParts.length > 0
          ? `${memoParts.join(" / ")} / ${rowLabel} 행으로 분리해 표준 템플릿으로 변환`
          : `${baseName}를 표준 템플릿으로 변환 후 통합 대상으로 포함`
      };
    });
  });
}

type NoteSourceKind = "본문주석" | "비고";

type NoteOccurrence = {
  sourceKind: NoteSourceKind;
  noteType: string;
  noteLabel: string;
  noteText: string;
  productName: string;
  specialName: string;
  productCode: string;
  insuranceCode: string;
  limitValue: string;
  sourceFileName: string;
  sourceLocation: string;
  ruleId: string;
};

type NoteRegistryState = {
  noteId: string;
  canonicalText: string;
  title: string;
  noteLabels: Set<string>;
  noteTypes: Set<string>;
  sourceKinds: Set<string>;
  productNames: Set<string>;
  specialNames: Set<string>;
  productCodes: Set<string>;
  insuranceCodes: Set<string>;
  ruleIds: Set<string>;
  sourceFiles: Set<string>;
  sourceLocations: Set<string>;
  occurrenceCount: number;
};

type NoteBuildResult = {
  noteMaster: Record<string, string | number>[];
  ruleNoteMap: Record<string, string | number>[];
  noteIdsByRuleIndex: Map<number, string[]>;
};

function normalizeNoteTextValue(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNoteKey(value: string) {
  return normalizeNoteTextValue(value).toLowerCase();
}

function joinUniqueText(values: Iterable<string>) {
  return Array.from(new Set(Array.from(values).map((value) => normalizeNoteTextValue(value)).filter(Boolean))).join(" / ");
}

function buildNoteTitle(occurrence: NoteOccurrence) {
  if (occurrence.sourceKind === "본문주석") {
    return `${occurrence.noteLabel || occurrence.specialName || occurrence.productName} / 본문주석`;
  }

  if (occurrence.specialName && occurrence.insuranceCode) {
    return `${occurrence.specialName} / ${occurrence.insuranceCode} 비고`;
  }

  return `${occurrence.noteLabel || occurrence.specialName || occurrence.productName} / 비고`;
}

function classifyNoteType(text: string) {
  const normalized = normalizeNoteTextValue(text);

  if (!normalized) {
    return "기타";
  }

  if (normalized.includes("예외") || normalized.includes("유의")) {
    return "예외";
  }

  if (/[<>×x*]/.test(normalized) || normalized.includes("배") || normalized.includes("합산")) {
    return "계산식";
  }

  return "본문주석";
}

type ExpandedNoteSegment = {
  noteLabel: string;
  noteText: string;
  noteType: NoteOccurrence["sourceKind"] extends never ? never : string;
};

function splitNoteFragments(rawNoteText: string) {
  return normalizeNoteTextValue(rawNoteText)
    .split(/\s*\/\s*|\n+/)
    .map((fragment) => normalizeNoteTextValue(fragment))
    .filter(Boolean);
}

function parseFootnoteReferences(rawNoteText: string) {
  const normalized = normalizeNoteTextValue(rawNoteText);
  const match = normalized.match(/^주\s*((?:\d+(?:\s*[,/]\s*\d+)*))(?:\s+(.*))?$/);

  if (!match) {
    return null;
  }

  const labels = match[1]
    .split(/[,/]/)
    .map((label) => `주${label.trim()}`)
    .filter(Boolean);
  const remainder = normalizeNoteTextValue(match[2] ?? "");

  return {
    labels,
    remainder
  };
}

function expandNoteSegments(
  rawNoteText: string,
  footnoteByLabel: Map<string, ParsedNoteEntry>
) {
  const segments: ExpandedNoteSegment[] = [];
  for (const fragment of splitNoteFragments(rawNoteText)) {
    const parsed = parseFootnoteReferences(fragment);
    if (!parsed) {
      segments.push({
        noteLabel: fragment,
        noteText: fragment,
        noteType: classifyNoteType(fragment)
      });
      continue;
    }

    parsed.labels.forEach((label) => {
      const footnote = footnoteByLabel.get(label);
      if (!footnote?.noteText) {
        return;
      }

      segments.push({
        noteLabel: label,
        noteText: normalizeNoteTextValue(footnote.noteText),
        noteType: footnote.noteType
      });
    });

    if (parsed.remainder) {
      segments.push({
        noteLabel: fragment,
        noteText: parsed.remainder,
        noteType: classifyNoteType(parsed.remainder)
      });
    }
  }

  if (segments.length === 0) {
    const normalized = normalizeNoteTextValue(rawNoteText);
    if (!normalized) {
      return [];
    }

    return [
      {
        noteLabel: normalized,
        noteText: normalized,
        noteType: classifyNoteType(normalized)
      }
    ];
  }

  return segments;
}

function buildNoteRows(
  standardizedRows: Record<string, string | number>[],
  masterProducts: ParsedProductCandidate[],
  fallbackProductName: string
) : NoteBuildResult {
  const footnoteMapsByFile = new Map<string, Map<string, ParsedNoteEntry>>();
  const noteRegistry = new Map<string, NoteRegistryState>();
  const noteIdsByRuleIndex = new Map<number, string[]>();
  const ruleNoteMapRows: Record<string, string | number>[] = [];

  function getFootnoteMapForFile(sourceFileName: string) {
    const normalizedFileName = normalizeNoteTextValue(sourceFileName);
    const cachedMap = footnoteMapsByFile.get(normalizedFileName);

    if (cachedMap) {
      return cachedMap;
    }

    const product = masterProducts.find(
      (item) => normalizeNoteTextValue(item.sourceFileName) === normalizedFileName
    );
    const footnoteMap = new Map<string, ParsedNoteEntry>();

    for (const note of product?.noteEntries ?? []) {
      const noteLabel = String(note.noteLabel ?? "").trim();
      const noteText = String(note.noteText ?? "").trim();

      if (!noteLabel || !noteText) {
        continue;
      }

      footnoteMap.set(noteLabel, {
        ...note,
        noteLabel,
        noteText
      });
    }

    footnoteMapsByFile.set(normalizedFileName, footnoteMap);
    return footnoteMap;
  }

  function addNoteOccurrence(occurrence: NoteOccurrence) {
    const canonicalText = normalizeNoteTextValue(occurrence.noteText);
    if (!canonicalText) {
      return "";
    }

    const registryKey = normalizeNoteKey(canonicalText);
    let entry = noteRegistry.get(registryKey);

    if (!entry) {
      const noteId = `N-${String(noteRegistry.size + 1).padStart(3, "0")}`;
      entry = {
        noteId,
        canonicalText,
        title: buildNoteTitle(occurrence),
        noteLabels: new Set(),
        noteTypes: new Set(),
        sourceKinds: new Set(),
        productNames: new Set(),
        specialNames: new Set(),
        productCodes: new Set(),
        insuranceCodes: new Set(),
        ruleIds: new Set(),
        sourceFiles: new Set(),
        sourceLocations: new Set(),
        occurrenceCount: 0
      };
      noteRegistry.set(registryKey, entry);
    }

    entry.noteLabels.add(normalizeNoteTextValue(occurrence.noteLabel));
    entry.noteTypes.add(normalizeNoteTextValue(occurrence.noteType));
    entry.sourceKinds.add(occurrence.sourceKind);
    entry.productNames.add(normalizeNoteTextValue(occurrence.productName));
    entry.specialNames.add(normalizeNoteTextValue(occurrence.specialName));
    entry.productCodes.add(normalizeNoteTextValue(occurrence.productCode));
    entry.insuranceCodes.add(normalizeNoteTextValue(occurrence.insuranceCode));
    entry.ruleIds.add(normalizeNoteTextValue(occurrence.ruleId));
    entry.sourceFiles.add(normalizeNoteTextValue(occurrence.sourceFileName));
    entry.sourceLocations.add(normalizeNoteTextValue(occurrence.sourceLocation));
    entry.occurrenceCount += 1;

    return entry.noteId;
  }

  function addRuleNoteMapRow(
    row: Record<string, string | number>,
    index: number,
    noteId: string,
    noteText: string,
    noteTitle: string
  ) {
    const ruleId = `R-0${index + 1}`;
    noteIdsByRuleIndex.set(index, noteId ? [noteId] : []);

    ruleNoteMapRows.push({
      상품명: row.상품명,
      특약명: row.특약명,
      상품코드: row.상품코드,
      보험코드: row.보험코드,
      가입한도: row.가입한도 || "",
      비고: noteText,
      "Rule ID": ruleId,
      "Note ID": noteId,
      주석명: noteTitle,
      적용범위: "파일별 템플릿",
      적용방식: noteText ? "주석 기준으로 표준화" : "주석 없음",
      출처위치: row.원본파일명,
      검토필요: "N"
    });
  }

  standardizedRows.forEach((row, index) => {
    const noteText = String(row.비고 ?? "").trim();
    const ruleId = `R-0${index + 1}`;
    const noteTitle = `${String(row.특약명 ?? "")} / ${String(row.보험코드 ?? "")} 비고`;
    const footnoteByLabel = getFootnoteMapForFile(String(row.원본파일명 ?? ""));
    const segments = expandNoteSegments(noteText, footnoteByLabel);
    const noteIds: string[] = [];

    if (segments.length === 0) {
      addRuleNoteMapRow(row, index, "", "", noteTitle);
      noteIdsByRuleIndex.set(index, []);
      return;
    }

    segments.forEach((segment) => {
      const noteId = addNoteOccurrence({
        sourceKind: "비고",
        noteType: segment.noteType,
        noteLabel: segment.noteLabel,
        noteText: segment.noteText,
        productName: String(row.상품명 ?? "") || fallbackProductName,
        specialName: String(row.특약명 ?? "") || fallbackProductName,
        productCode: String(row.상품코드 ?? ""),
        insuranceCode: String(row.보험코드 ?? ""),
        limitValue: String(row.가입한도 ?? ""),
        sourceFileName: String(row.원본파일명 ?? ""),
        sourceLocation: `${String(row.원본파일명 ?? "")} / ${String(row.특약명 ?? "")}`,
        ruleId
      });

      if (noteId) {
        noteIds.push(noteId);
        addRuleNoteMapRow(row, index, noteId, segment.noteText, noteTitle);
      }
    });

    noteIdsByRuleIndex.set(index, noteIds);
  });

  const noteMaster = Array.from(noteRegistry.values()).map((entry) => ({
    "Note ID": entry.noteId,
    주석명: entry.title,
    "주석 원문": entry.canonicalText,
    주석유형: joinUniqueText([...entry.sourceKinds, ...entry.noteTypes]),
    상품명: joinUniqueText(entry.productNames) || "",
    특약명: joinUniqueText(entry.specialNames) || "",
    상품코드: joinUniqueText(entry.productCodes) || "",
    보험코드: joinUniqueText(entry.insuranceCodes) || "",
    적용대상: joinUniqueText(entry.ruleIds) || joinUniqueText(entry.specialNames),
    출처위치: joinUniqueText(entry.sourceLocations) || "",
    출처파일: joinUniqueText(entry.sourceFiles) || "",
    참조횟수: entry.occurrenceCount,
    검토메모:
      entry.occurrenceCount > 1
        ? "공통 주석으로 통합"
        : "단일 주석으로 유지"
  }));

  return {
    noteMaster,
    ruleNoteMap: ruleNoteMapRows,
    noteIdsByRuleIndex
  };
}

export function buildDraftWorkbookData(
  request: DraftRequest,
  options?: DraftWorkbookOptions
): DraftWorkbookData {
  const answerValues = Object.values(request.answers ?? {}).filter(Boolean);
  const uploadedFiles = uniqueFiles(request.uploadedFiles ?? []);
  const masterProducts = request.masterProducts ?? [];
  const hasMasterProducts = masterProducts.length > 0;
  const renderMode = resolveRenderMode(request, options?.mode);
  const workbookProductName =
    request.productName?.trim() ||
    masterProducts[0]?.productName?.trim() ||
    deriveProductLabel(uploadedFiles[0] ?? "") ||
    "건강하고 튼튼하게";
  const saleDate = masterProducts[0]?.saleDate?.trim() || "2026-04-01";
  const baseLimitValue = resolveBaseLimitValue(masterProducts);
  const hasUploadedFiles = uploadedFiles.length > 0 || hasMasterProducts;
  const standardizedRows = buildUploadedProductRows(masterProducts, uploadedFiles, workbookProductName);
  const noteArtifacts = hasUploadedFiles
    ? buildNoteRows(standardizedRows, masterProducts, workbookProductName)
    : null;
  const requestedLimitValue = extractRequestedLimitValue(request.rawInput);
  const targetRows = standardizedRows.filter((row) =>
    matchesRequestedChangeTarget(
      request.rawInput,
      String(row.특약명 ?? ""),
      String(row.보험코드 ?? "")
    )
  );
  const targetLabel = targetRows[0]?.특약명?.trim() || "소액암진단";
  const targetLimitValue = targetRows[0]?.가입한도?.trim() || baseLimitValue;
  const limitSummary = buildRuleMeasureSummary(renderMode, targetLimitValue, request.rawInput);

  const summary: DraftSummary = {
    target: targetLabel,
    beforeValue: limitSummary.beforeValue,
    afterValue: limitSummary.afterValue,
    appliedAnswers:
      answerValues.length > 0
        ? answerValues
        : ["질문 답변 미입력 - 기본 초안으로 생성"],
    pendingNotes: limitSummary.isNoOpChange
      ? [
          "변경 전후 기준이 동일해 실제 변경 여부를 다시 확인 필요",
          "66세 이상 예외 주석은 최종 검토 필요"
        ]
      : ["66세 이상 예외 주석은 최종 검토 필요"]
  };

  return {
    overview: hasUploadedFiles
      ? [
          { 항목: "가이드라인 개수", 값: `${uploadedFiles.length}개` },
          { 항목: "반영된 상품명 수", 값: `${collectProductNames(standardizedRows).length}개` },
          {
            항목: "반영된 상품명 목록",
            값: collectProductNames(standardizedRows).join(" / ")
          },
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
      ? standardizedRows.map((row, index) => ({
          상품명: row.상품명,
          특약명: row.특약명,
          상품코드: row.상품코드,
          보험코드: row.보험코드,
          판매일자: row.판매일자 || saleDate,
          가입한도: row.가입한도 || "",
          비고: row.비고 || "",
          "Rule ID": `R-0${index + 1}`,
          상태: "표준화 완료",
          ...buildRuleMeasureFields(
            renderMode,
            row.가입한도 || baseLimitValue,
            requestedLimitValue,
            matchesRequestedChangeTarget(
              request.rawInput,
              String(row.특약명 ?? ""),
              String(row.보험코드 ?? "")
            )
          ),
          인별합산: 3000,
          주석ID: noteArtifacts?.noteIdsByRuleIndex.get(index)?.join(",") || "",
          출처위치: row.원본파일명,
          검토메모: row.검토메모,
          초안상태: "초안"
        }))
      : [
      {
        상품명: workbookProductName,
        특약명: "소액암진단",
        상품코드: "LI00113",
        보험코드: "LI00113",
        판매일자: saleDate,
        가입한도: baseLimitValue,
        비고: "암진단-소액암 연계 / 소액암 인별합산 예외",
        "Rule ID": "R-003",
        상태: "시행예정",
        ...buildRuleMeasureFields(renderMode, baseLimitValue, requestedLimitValue, true),
        인별합산: 3000,
        주석ID: "N-002,N-003",
        출처위치: request.fileName || "직접 입력 기반",
        검토메모: "소액암진단 단일건 한도 상향 초안. 인별합산 및 주석 영향 검토 필요",
        초안상태: "초안"
      }
      ],
    noteMaster: hasUploadedFiles
      ? noteArtifacts?.noteMaster ?? []
      : [
      {
        상품명: workbookProductName,
        상품코드: "LI00113",
        보험코드: "LI00113",
        "Note ID": "N-002",
        주석명: "암진단 / 소액암진단 / LI00113 주석",
        "주석 원문": "직접 입력 기반 / 특약명 암진단-소액암 연계 / 보험코드 LI00113 / 암진단 가입시 소액암 진단 가입필수",
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
        주석명: "소액암진단 / LI00113 / 인별합산 예외 주석",
        "주석 원문": "직접 입력 기반 / 특약명 소액암 인별합산 예외 / 보험코드 LI00113 / 소액암 진단 인별합산 한도 5천만원 (단, 66세 이상 3천만)",
        주석유형: "예외/상향기준",
        적용대상: "R-003",
        우선순위: 1,
        출처위치: "Sheet1!B20",
        검토메모: "66세 이상 예외 주석은 최종 검토 필요"
      }
      ],
    ruleNoteMap: hasUploadedFiles
      ? noteArtifacts?.ruleNoteMap ?? []
      : [
          {
            상품명: workbookProductName,
            특약명: "소액암진단",
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
      ? standardizedRows.map((row, index) => ({
          상품명: row.상품명,
          특약명: row.특약명,
          상품코드: row.상품코드,
          보험코드: row.보험코드,
          가입한도: row.가입한도 || "",
          비고: row.비고 || "특약 단위 변경 이력",
          "Change ID": `C-0${index + 1}`,
          "Rule ID": `R-0${index + 1}`,
          상태변경: "파일별 표준화 -> 특약별 머지",
          현행값: row.원본파일명,
          변경값: row.특약명,
          "Note ID": noteArtifacts?.noteIdsByRuleIndex.get(index)?.join(",") || "",
          사유: row.검토메모,
          적용일: "검토 필요",
          변경메모: "특약 단위 변경 이력"
        }))
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
        "Note ID": "N-002,N-003",
        사유: request.rawInput || "소액암진단 단일건 한도 상향",
        적용일: "검토 필요",
        비고: summary.appliedAnswers.join(" | ")
      }
      ]
  };
}
