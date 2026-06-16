export type ReviewMemo = {
  id: string;
  title: string;
  description: string;
  status: "검토 필요" | "참고";
};

export type ReviewQuestion = {
  id: string;
  label: string;
  prompt: string;
  hint: string;
};

export type SampleProductOption = {
  id: string;
  productCode?: string;
  productName: string;
  saleDate: string;
  summary: string;
};

export const sampleReviewMemos: ReviewMemo[] = [
  {
    id: "memo-1",
    title: "소액암진단 단일건 한도 상향 초안",
    description:
      "일반/건강과 간편 모두 1000에서 2000으로 상향하는 안이 감지되었습니다.",
    status: "검토 필요"
  },
  {
    id: "memo-2",
    title: "인별합산 및 예외 주석 확인 필요",
    description:
      "인별합산 3000 유지 여부와 66세 이상 예외 문구의 관계를 사람 확인으로 넘겨야 합니다.",
    status: "검토 필요"
  },
  {
    id: "memo-3",
    title: "암진단-소액암 연계조건 유지",
    description:
      "암진단 가입 시 소액암진단 가입 필수 조건은 현재 초안에서 유지되는 것으로 읽혔습니다.",
    status: "참고"
  }
];

export const sampleReviewQuestions: ReviewQuestion[] = [
  {
    id: "question-1",
    label: "질문 1",
    prompt: "소액암진단 단일건 한도를 일반/건강과 간편 모두 2000으로 변경할까요?",
    hint: "예: 둘 다 2000으로 변경 / 일반만 변경 / 보류"
  },
  {
    id: "question-2",
    label: "질문 2",
    prompt: "인별합산 3000은 유지할까요, 단일건 상향과 함께 다시 검토할까요?",
    hint: "예: 3000 유지 / 인별합산도 변경 검토"
  },
  {
    id: "question-3",
    label: "질문 3",
    prompt: "66세 이상 예외 한도 문구는 기존 기준을 유지할까요, 이번 변경에 맞춰 같이 수정할까요?",
    hint: "예: 기존 3000 유지 / 예외 한도도 함께 수정 검토"
  },
  {
    id: "question-4",
    label: "질문 4",
    prompt: "암진단 가입 시 소액암진단 가입 필수 연계조건은 그대로 유지할까요?",
    hint: "예: 연계조건 유지 / 연계조건 완화 검토"
  },
  {
    id: "question-5",
    label: "질문 5",
    prompt: "적용 시점은 즉시 반영인가요, 시행예정 초안으로만 남길까요?",
    hint: "예: 시행예정 초안 / 즉시 반영 예정 / 적용일 미정"
  }
];

export const sampleProductOptions: SampleProductOption[] = [
  {
    id: "product-1",
    productName: "건강하고 튼튼하게",
    saleDate: "2026-04-01",
    summary: "주보험, 암진단, 소액암진단, 파워수술 기준 포함"
  },
  {
    id: "product-2",
    productName: "건강플러스암보험",
    saleDate: "2026-05-15",
    summary: "암진단군 한도 및 인별합산 주석 중심 상품"
  },
  {
    id: "product-3",
    productName: "튼튼간편건강보험",
    saleDate: "2026-03-20",
    summary: "간편심사형 가입한도와 수술특약 비교 기준 포함"
  },
  {
    id: "product-4",
    productName: "스마트입원케어보험",
    saleDate: "2026-02-10",
    summary: "입원간병인, 신입원특약, 연계조건 예시 포함"
  }
];
