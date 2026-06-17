import type { ReviewMemo, ReviewQuestion } from "@/lib/sample-data";
import type { ParsedNoteEntry, ParsedProductCandidate } from "@/lib/product-candidate-parser";
import {
  extractRequestedLimitValue,
  matchesDelimitedTerm,
  normalizeSearchText
} from "@/lib/change-intent";

type ReviewContentContext = {
  masterFileNames: string[];
  changeFileNames: string[];
  rawInput: string;
  productName: string;
  masterProducts?: ParsedProductCandidate[];
};

type NoteQuestionCandidate = {
  noteText: string;
  noteType: ParsedNoteEntry["noteType"];
  specialNames: Set<string>;
  productNames: Set<string>;
  productCodes: Set<string>;
  insuranceCodes: Set<string>;
  count: number;
};

export type ReviewQuestionGroups = {
  coreQuestions: ReviewQuestion[];
  detailQuestions: ReviewQuestion[];
};

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function pickPrimaryLabel(fileNames: string[], fallback: string) {
  const primary = fileNames.find((item) => item.trim());
  return primary ? stripExtension(primary) : fallback;
}

function summarizeText(value: string, fallback: string, maxLength = 54) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function summarizeChange(rawInput: string) {
  const normalized = rawInput.replace(/\s+/g, " ").trim();
  const rangeMatch = normalized.match(/(\d[\d,]*)\s*(?:->|→|~|에서)\s*(\d[\d,]*)/);

  if (rangeMatch) {
    return `${rangeMatch[1]} → ${rangeMatch[2]}`;
  }

  return summarizeText(normalized, "변경 내용 확인 필요", 28);
}

function formatCodeList(values: Iterable<string>) {
  return Array.from(new Set(Array.from(values).map((value) => normalizeText(value)).filter(Boolean)));
}

function collectChangeTargetTerms(rawInput: string, masterProducts: ParsedProductCandidate[] = []) {
  const normalizedInput = normalizeText(rawInput);
  if (!normalizedInput) {
    return new Set<string>();
  }

  const knownTerms = new Set<string>();

  for (const product of masterProducts) {
    for (const item of product.specialItems ?? []) {
      const specialName = normalizeText(item.specialName);
      const insuranceCode = normalizeText(item.insuranceCode);
      const productName = normalizeText(product.productName);

      if (specialName) {
        knownTerms.add(specialName);
      }

      if (insuranceCode) {
        knownTerms.add(insuranceCode);
      }

      if (productName) {
        knownTerms.add(productName);
      }
    }
  }

  const matchedTerms = new Set<string>();

  for (const term of knownTerms) {
    if (term && matchesDelimitedTerm(normalizedInput, term)) {
      matchedTerms.add(term);
    }
  }

  return matchedTerms;
}

function classifyNoteType(text: string): ParsedNoteEntry["noteType"] {
  const normalized = normalizeText(text);

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

function splitNoteFragments(rawNoteText: string) {
  return normalizeText(rawNoteText)
    .split(/\s*\/\s*|\n+/)
    .map((fragment) => normalizeText(fragment))
    .filter(Boolean);
}

function parseFootnoteReferences(rawNoteText: string) {
  const normalized = normalizeText(rawNoteText);
  const match = normalized.match(/^주\s*((?:\d+(?:\s*[,/]\s*\d+)*))(?:\s+(.*))?$/);

  if (!match) {
    return null;
  }

  const labels = match[1]
    .split(/[,/]/)
    .map((label) => `주${label.trim()}`)
    .filter(Boolean);

  return {
    labels,
    remainder: normalizeText(match[2] ?? "")
  };
}

function stripFootnoteLabel(text: string) {
  return normalizeText(text).replace(/^주\s*\d+\)?\s*/, "");
}

function expandNoteText(rawNoteText: string, footnoteByLabel: Map<string, string>) {
  const fragments: { noteText: string; noteType: ParsedNoteEntry["noteType"] }[] = [];

  for (const fragment of splitNoteFragments(rawNoteText)) {
    const parsed = parseFootnoteReferences(fragment);
    if (!parsed) {
      fragments.push({
        noteText: fragment,
        noteType: classifyNoteType(fragment)
      });
      continue;
    }

    parsed.labels.forEach((label) => {
      const noteText = footnoteByLabel.get(label);
      if (!noteText) {
        return;
      }

      fragments.push({
        noteText: stripFootnoteLabel(noteText),
        noteType: classifyNoteType(noteText)
      });
    });

    if (parsed.remainder) {
      fragments.push({
        noteText: stripFootnoteLabel(parsed.remainder),
        noteType: classifyNoteType(parsed.remainder)
      });
    }
  }

  return fragments;
}

function candidateMatchesTarget(candidate: NoteQuestionCandidate, targetTerms: Set<string>) {
  if (targetTerms.size === 0) {
    return false;
  }

  const candidateTerms = [
    ...candidate.specialNames,
    ...candidate.productNames,
    ...candidate.insuranceCodes
  ].map((value) => normalizeText(value).toLowerCase());

  for (const target of targetTerms) {
    const normalizedTarget = normalizeText(target).toLowerCase();
    if (!normalizedTarget) {
      continue;
    }

    if (candidateTerms.some((term) => normalizeSearchText(term) === normalizeSearchText(normalizedTarget))) {
      return true;
    }
  }

  return false;
}

function buildNoteQuestionCandidates(
  masterProducts: ParsedProductCandidate[] = [],
  rawInput = ""
) {
  const candidates = new Map<string, NoteQuestionCandidate>();
  const targetTerms = collectChangeTargetTerms(rawInput, masterProducts);

  for (const product of masterProducts) {
    const footnoteByLabel = new Map(
      (product.noteEntries ?? [])
        .map((entry) => [normalizeText(entry.noteLabel), normalizeText(entry.noteText)] as const)
        .filter(([label, noteText]) => Boolean(label) && Boolean(noteText))
    );

    for (const item of product.specialItems ?? []) {
      const specialName = normalizeText(item.specialName);
      const productName = normalizeText(product.productName);
      const productCode = normalizeText(product.productCode ?? "");
      const insuranceCode = normalizeText(item.insuranceCode);
      const noteText = normalizeText(item.noteText ?? "");

      if (!noteText) {
        continue;
      }

      const resolvedFragments = expandNoteText(noteText, footnoteByLabel);
      const noteFragments = resolvedFragments.length > 0 ? resolvedFragments : [{ noteText, noteType: classifyNoteType(noteText) }];

      for (const fragment of noteFragments) {
        const key = fragment.noteText.toLowerCase();
        let entry = candidates.get(key);

        if (!entry) {
          entry = {
            noteText: fragment.noteText,
            noteType: fragment.noteType,
            specialNames: new Set(),
            productNames: new Set(),
            productCodes: new Set(),
            insuranceCodes: new Set(),
            count: 0
          };
          candidates.set(key, entry);
        }

        entry.specialNames.add(specialName);
        entry.productNames.add(productName);
        entry.productCodes.add(productCode);
        entry.insuranceCodes.add(insuranceCode);
        entry.count += 1;
      }
    }
  }

  return Array.from(candidates.values())
    .filter((candidate) => candidate.noteText)
    .filter((candidate) =>
      candidate.specialNames.size > 1 ||
      candidate.productNames.size > 1 ||
      candidate.noteType !== "본문주석"
    )
    .filter((candidate) => candidateMatchesTarget(candidate, targetTerms))
    .sort((left, right) => {
      const score = (candidate: NoteQuestionCandidate) =>
        candidate.specialNames.size * 2 +
        candidate.productNames.size +
        (candidate.noteType === "계산식" ? 2 : candidate.noteType === "예외" ? 1 : 0);

      return score(right) - score(left);
    });
}

function buildNoteQuestionPrompt(candidate: NoteQuestionCandidate, index: number): ReviewQuestion {
  const specialNames = Array.from(candidate.specialNames).filter(Boolean);
  const productNames = Array.from(candidate.productNames).filter(Boolean);
  const insuranceCodes = formatCodeList(candidate.insuranceCodes);
  const specialText = specialNames.length > 0 ? specialNames.join(" / ") : "연결 특약";
  const productText = productNames.length > 1 ? ` (${formatCodeList(productNames).join(" / ")})` : "";
  const codeText = insuranceCodes.length > 0 ? ` / 보험코드 ${insuranceCodes.join(" / ")}` : "";
  const noteSnippet = summarizeText(candidate.noteText, "주석 원문", 48);
  const sharedContext =
    specialNames.length > 1 || productNames.length > 1
      ? "같은 원문이 여러 특약/상품/보험코드에 연결되어 있습니다. 모두 함께 반영할지 확인해 주세요."
      : "연결된 특약/보험코드/주석이 함께 바뀌는지 확인해 주세요.";

  if (candidate.noteType === "계산식" || candidate.noteType === "예외") {
    return {
      id: `question-note-${index + 1}`,
      prompt: `계산식/예외 주석 "${noteSnippet}"은 ${specialText}${codeText}${productText}에 연결되어 있습니다. ${sharedContext}`,
      hint: "예: 유지 / 함께 수정 / 별도 검토"
    };
  }

  return {
    id: `question-note-${index + 1}`,
    prompt: `주석 원문 "${noteSnippet}"은 ${specialText}${codeText}${productText}에 연결되어 있습니다. ${sharedContext}`,
    hint: "예: 모두 반영 / 일부만 반영 / 주석 분리"
  };
}

type MatchedChangeItem = {
  productName: string;
  specialName: string;
  insuranceCode: string;
  limitValue: string;
};

function collectMatchedChangeItems(context: ReviewContentContext): MatchedChangeItem[] {
  const normalizedInput = normalizeSearchText(context.rawInput);
  const matchedItems: MatchedChangeItem[] = [];

  if (!normalizedInput) {
    return matchedItems;
  }

  for (const product of context.masterProducts ?? []) {
    const productName = normalizeText(product.productName);

    for (const item of product.specialItems ?? []) {
      const specialName = normalizeText(item.specialName);
      const insuranceCode = normalizeText(item.insuranceCode);
      const limitValue = normalizeText(item.limitValue ?? "");
      const candidateTerms = [productName, specialName, insuranceCode]
        .map((value) => normalizeSearchText(value))
        .filter(Boolean);

      if (candidateTerms.some((term) => normalizedInput.includes(term))) {
        matchedItems.push({
          productName,
          specialName,
          insuranceCode,
          limitValue
        });
      }
    }
  }

  return matchedItems;
}

function buildCoreConfirmationQuestions(
  context: ReviewContentContext
): ReviewQuestion[] {
  const matchedItems = collectMatchedChangeItems(context);
  const requestedLimitValue = extractRequestedLimitValue(context.rawInput);

  if (matchedItems.length === 0) {
    return [];
  }

  const primaryItem = matchedItems[0];
  const targetNames = Array.from(
    new Set(
      matchedItems
        .map((item) => item.specialName || item.productName)
        .filter(Boolean)
    )
  );
  const targetCodes = Array.from(
    new Set(matchedItems.map((item) => item.insuranceCode).filter(Boolean))
  );
  const targetText =
    targetNames.length > 0
      ? targetNames.join(" / ")
      : primaryItem.specialName || primaryItem.productName || "대상 특약";
  const codeText = targetCodes.length > 0 ? ` / 보험코드 ${targetCodes.join(" / ")}` : "";
  const currentLimit = primaryItem.limitValue || requestedLimitValue || "변경값 미확인";
  const coreQuestions: ReviewQuestion[] = [];

  coreQuestions.push({
    id: "core-question-1",
    prompt:
      matchedItems.length > 1
        ? `입력한 변경은 ${targetText}${codeText} 중 어느 특약에만 적용할까요?`
        : `입력한 변경 대상이 ${targetText}${codeText} 맞나요?`,
    hint: "예: 이 특약만 적용 / 여러 특약 함께 적용 / 대상 수정"
  });

  if (requestedLimitValue) {
    coreQuestions.push({
      id: "core-question-2",
      prompt:
        currentLimit.replace(/,/g, "") === requestedLimitValue
          ? `현재 기준 ${targetText}의 단일건 한도는 ${currentLimit}이고 직접입력 값도 ${requestedLimitValue}로 같아 보입니다. 실제로 변경이 맞는지 다시 확인해 주세요.`
          : `변경값 ${requestedLimitValue}를 ${targetText}의 새 단일건 한도로 확정할까요? 현재 기준은 ${currentLimit}로 읽힙니다.`,
      hint: "예: 변경 확정 / 값 수정 / 변경 없음"
    });
  }

  coreQuestions.push({
    id: "core-question-3",
    prompt: `이 특약과 연결된 주석·예외까지 함께 바꿀까요, 아니면 특약 한도만 먼저 변경할까요?`,
    hint: "예: 주석까지 함께 반영 / 특약만 변경 / 별도 검토"
  });

  return coreQuestions.slice(0, 3);
}

function buildDetailReviewQuestions(
  context: ReviewContentContext,
  reviewMemos: ReviewMemo[]
): ReviewQuestion[] {
  const masterLabel = pickPrimaryLabel(context.masterFileNames, "기준파일");
  const changeLabel = pickPrimaryLabel(context.changeFileNames, "변경파일");
  const inputSummary = summarizeText(context.rawInput, "직접입력 없음");
  const changeSummary = summarizeChange(context.rawInput);
  const productLabel = context.productName.trim() || "상품";
  const noteCandidates = buildNoteQuestionCandidates(context.masterProducts ?? [], context.rawInput);
  const noteQuestions = noteCandidates.map((candidate, index) =>
    buildNoteQuestionPrompt(candidate, index)
  );

  const questions: ReviewQuestion[] = [
    ...noteQuestions,
    {
      id: "question-1",
      prompt: `${reviewMemos[0]?.title ?? masterLabel} 메모에 따라, ${masterLabel}의 각 파일을 표준 템플릿으로 먼저 변환한 뒤 머지할까요?`,
      hint: `예: ${masterLabel} 파일별 표준화 후 통합`
    },
    {
      id: "question-2",
      prompt: `${reviewMemos[1]?.title ?? changeLabel} 메모를 기준으로, ${changeLabel}에서 가장 먼저 반영할 변경은 무엇인가요?`,
      hint: "예: 한도 변경 / 예외 문구 수정 / 적용일 조정"
    },
    {
      id: "question-3",
      prompt: `직접입력 요약 "${inputSummary}"를 기준으로 변경값을 ${changeSummary}로 확정할까요?`,
      hint: "예: 확정 / 추가 확인 필요"
    },
    {
      id: "question-4",
      prompt: `${reviewMemos[2]?.title ?? "상품 추출 기준"}에 따라, ${productLabel} 추출 시 기준파일과 변경파일 중 어느 쪽을 최종 기준으로 둘까요?`,
      hint: "예: 통합 마스터 우선 / 변경파일 우선"
    },
    {
      id: "question-5",
      prompt: `파일별 머지 후 남길 검토메모나 보류 사항이 있나요?`,
      hint: "예: 66세 이상 예외 / 시행일 미정"
    }
  ];

  if (context.masterFileNames.length > 1) {
    questions.push({
      id: "question-6",
      prompt: `${masterLabel} 외에 업로드된 기준 파일도 같은 표준 템플릿으로 함께 머지할까요?`,
      hint: "예: 모두 머지 / 일부만 머지 / 우선순위 지정"
    });
  }

  if (context.changeFileNames.length > 1) {
    questions.push({
      id: "question-7",
      prompt: `${changeLabel}가 여러 개이므로, 변경 파일들을 모두 반영할지 아니면 대표 파일만 기준으로 둘지 정해 주세요.`,
      hint: "예: 모두 반영 / 대표 파일 우선 / 파일별 분리 검토"
    });
  }

  if (/66세|65세|70세|예외|한도/.test(context.rawInput)) {
    questions.push({
      id: "question-8",
      prompt: `직접입력에서 감지된 예외/한도 조건("${changeSummary}")을 최종 초안에 그대로 둘까요, 별도 검토 메모로 남길까요?`,
      hint: "예: 초안 반영 / 검토 메모 유지"
    });
  }

  if (/시행|적용일|예정/.test(context.rawInput)) {
    questions.push({
      id: "question-9",
      prompt: `적용 시점 관련 표현을 ${productLabel} 기준으로 확정해도 될까요?`,
      hint: "예: 즉시 반영 / 시행예정 유지 / 적용일 미정"
    });
  }

  return questions.map((question, index) => ({
    ...question,
    label: `질문 ${index + 1}`
  }));
}

export function buildReviewQuestionGroups(
  context: ReviewContentContext,
  reviewMemos: ReviewMemo[]
): ReviewQuestionGroups {
  const coreQuestions = buildCoreConfirmationQuestions(context).map((question, index) => ({
    ...question,
    label: `핵심 ${index + 1}`
  }));
  const detailQuestions = buildDetailReviewQuestions(context, reviewMemos);

  return {
    coreQuestions,
    detailQuestions
  };
}

export function buildReviewMemos(
  context: ReviewContentContext
): ReviewMemo[] {
  const masterLabel = pickPrimaryLabel(context.masterFileNames, "기준파일");
  const changeLabel = pickPrimaryLabel(context.changeFileNames, "변경파일");
  const inputSummary = summarizeText(context.rawInput, "직접입력 없음", 42);

  return [
    {
      id: "memo-1",
      title: `${masterLabel} 중심 검토`,
      description: `${masterLabel} 기준으로 초안을 먼저 맞추고 ${changeLabel}와 보험코드로 연결된 주석/예외가 함께 바뀌는지 확인합니다.`,
      status: "검토 필요"
    },
    {
      id: "memo-2",
      title: `${changeLabel} 반영 여부 확인`,
      description: `변경 내용 요약 "${inputSummary}"가 통합 마스터의 같은 특약/보험코드/주석 묶음 전체에 반영될지 사람 확인이 필요합니다.`,
      status: "검토 필요"
    },
    {
      id: "memo-3",
      title: "상품 추출 기준 정리",
      description: `${context.productName.trim() || "상품"} 추출 시 기준파일과 변경파일 중 어떤 것을 우선할지 확인합니다.`,
      status: "참고"
    }
  ];
}

export function buildReviewQuestions(
  context: ReviewContentContext,
  reviewMemos: ReviewMemo[]
): ReviewQuestion[] {
  return buildReviewQuestionGroups(context, reviewMemos).detailQuestions;
}
