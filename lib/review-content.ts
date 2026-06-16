import type { ReviewMemo, ReviewQuestion } from "@/lib/sample-data";

type ReviewContentContext = {
  masterFileNames: string[];
  changeFileNames: string[];
  rawInput: string;
  productName: string;
};

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
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
      description: `${masterLabel} 기준으로 초안을 먼저 맞추고 ${changeLabel}의 차이를 확인합니다.`,
      status: "검토 필요"
    },
    {
      id: "memo-2",
      title: `${changeLabel} 반영 여부 확인`,
      description: `변경 내용 요약 "${inputSummary}"가 통합 마스터에 반영될지 사람 확인이 필요합니다.`,
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
  const masterLabel = pickPrimaryLabel(context.masterFileNames, "기준파일");
  const changeLabel = pickPrimaryLabel(context.changeFileNames, "변경파일");
  const inputSummary = summarizeText(context.rawInput, "직접입력 없음");
  const changeSummary = summarizeChange(context.rawInput);
  const productLabel = context.productName.trim() || "상품";

  const questions: ReviewQuestion[] = [
    {
      id: "question-1",
      label: "질문 1",
      prompt: `${reviewMemos[0]?.title ?? masterLabel} 메모에 따라, ${masterLabel}의 각 파일을 표준 템플릿으로 먼저 변환한 뒤 머지할까요?`,
      hint: `예: ${masterLabel} 파일별 표준화 후 통합`
    },
    {
      id: "question-2",
      label: "질문 2",
      prompt: `${reviewMemos[1]?.title ?? changeLabel} 메모를 기준으로, ${changeLabel}에서 가장 먼저 반영할 변경은 무엇인가요?`,
      hint: "예: 한도 변경 / 예외 문구 수정 / 적용일 조정"
    },
    {
      id: "question-3",
      label: "질문 3",
      prompt: `직접입력 요약 "${inputSummary}"를 기준으로 변경값을 ${changeSummary}로 확정할까요?`,
      hint: "예: 확정 / 추가 확인 필요"
    },
    {
      id: "question-4",
      label: "질문 4",
      prompt: `${reviewMemos[2]?.title ?? "상품 추출 기준"}에 따라, ${productLabel} 추출 시 기준파일과 변경파일 중 어느 쪽을 최종 기준으로 둘까요?`,
      hint: "예: 통합 마스터 우선 / 변경파일 우선"
    },
    {
      id: "question-5",
      label: "질문 5",
      prompt: `파일별 머지 후 남길 검토메모나 보류 사항이 있나요?`,
      hint: "예: 66세 이상 예외 / 시행일 미정"
    }
  ];

  if (context.masterFileNames.length > 1) {
    questions.push({
      id: "question-6",
      label: "질문 6",
      prompt: `${masterLabel} 외에 업로드된 기준 파일도 같은 표준 템플릿으로 함께 머지할까요?`,
      hint: "예: 모두 머지 / 일부만 머지 / 우선순위 지정"
    });
  }

  if (context.changeFileNames.length > 1) {
    questions.push({
      id: "question-7",
      label: "질문 7",
      prompt: `${changeLabel}가 여러 개이므로, 변경 파일들을 모두 반영할지 아니면 대표 파일만 기준으로 둘지 정해 주세요.`,
      hint: "예: 모두 반영 / 대표 파일 우선 / 파일별 분리 검토"
    });
  }

  if (/66세|65세|70세|예외|한도/.test(context.rawInput)) {
    questions.push({
      id: "question-8",
      label: "질문 8",
      prompt: `직접입력에서 감지된 예외/한도 조건("${changeSummary}")을 최종 초안에 그대로 둘까요, 별도 검토 메모로 남길까요?`,
      hint: "예: 초안 반영 / 검토 메모 유지"
    });
  }

  if (/시행|적용일|예정/.test(context.rawInput)) {
    questions.push({
      id: "question-9",
      label: "질문 9",
      prompt: `적용 시점 관련 표현을 ${productLabel} 기준으로 확정해도 될까요?`,
      hint: "예: 즉시 반영 / 시행예정 유지 / 적용일 미정"
    });
  }

  return questions;
}
