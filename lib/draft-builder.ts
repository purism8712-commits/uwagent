export type DraftRequest = {
  fileName: string;
  rawInput: string;
  answers: Record<string, string>;
  productName?: string;
};

export type LegacyDraftRequest = {
  uploadedFileName?: string;
  userInput?: string;
  questionAnswers?: string[];
  answers?: Record<string, string> | null;
  fileName?: string;
  rawInput?: string;
  productName?: string;
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
    productName: request.productName ?? ""
  };
}

export function buildDraftWorkbookData(request: DraftRequest): DraftWorkbookData {
  const answerValues = Object.values(request.answers ?? {}).filter(Boolean);
  const productName = request.productName?.trim() || "건강하고 튼튼하게";
  const saleDate = "2026-04-01";

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
    overview: [
      { 항목: "상품명", 값: productName },
      { 항목: "판매일자", 값: saleDate }
    ],
    summary,
    ruleMaster: [
      {
        상품명: productName,
        판매일자: saleDate,
        "Rule ID": "R-003",
        상태: "시행예정",
        특약명: "소액암진단",
        보험코드: "LI00113",
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
    noteMaster: [
      {
        상품명: productName,
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
        상품명: productName,
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
    ruleNoteMap: [
      {
        상품명: productName,
        "Rule ID": "R-003",
        "Note ID": "N-002",
        적용범위: "단일행",
        적용방식: "연계조건 적용",
        출처위치: "Sheet1!E7 + Sheet1!B19",
        검토필요: "N"
      },
      {
        상품명: productName,
        "Rule ID": "R-003",
        "Note ID": "N-003",
        적용범위: "단일행",
        적용방식: "예외 적용",
        출처위치: "Sheet1!E7 + Sheet1!B20",
        검토필요: "Y"
      }
    ],
    changeLog: [
      {
        상품명: productName,
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
