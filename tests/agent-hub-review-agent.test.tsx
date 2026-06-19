import ExcelJS from "exceljs";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentHubPage from "@/components/agent-hub-page";
import * as reviewDraftModule from "@/lib/review-agent-draft";

async function buildReviewWorkbookFile() {
  const workbook = new ExcelJS.Workbook();

  const overview = workbook.addWorksheet("Overview");
  overview.addRow(["항목", "값"]);
  overview.addRow(["상품명", "건강하고 튼튼하게"]);
  overview.addRow(["상품코드", "LP0000001"]);
  overview.addRow(["판매일자", "2026-04-01"]);

  const ruleMaster = workbook.addWorksheet("Rule Master");
  ruleMaster.addRow([
    "상품명",
    "상품코드",
    "판매일자",
    "Rule ID",
    "상태",
    "특약명",
    "보험코드",
    "as-is 일반/건강 단일건",
    "to-be 일반/건강 단일건",
    "as-is 간편 단일건",
    "to-be 간편 단일건",
    "인별합산",
    "주석ID",
    "출처위치",
    "검토메모"
  ]);
  ruleMaster.addRow([
    "건강하고 튼튼하게",
    "LP0000001",
    "2026-04-01",
    "R-002",
    "현행",
    "암진단",
    "LI00112",
    "2000",
    "3000",
    "2000",
    "3000",
    "5000",
    "N-002",
    "표 본문 2행",
    "소액암 가입필수 연계조건 확인"
  ]);

  const noteMaster = workbook.addWorksheet("Note Master");
  noteMaster.addRow(["상품명", "Note ID", "주석명", "주석 원문", "주석유형", "적용대상", "출처위치"]);
  noteMaster.addRow([
    "건강하고 튼튼하게",
    "N-002",
    "암진단-소액암 연계",
    "암진단 가입시 소액암 진단 가입필수",
    "연계조건",
    "R-002",
    "주2"
  ]);

  const ruleNoteMap = workbook.addWorksheet("Rule-Note Map");
  ruleNoteMap.addRow(["상품명", "Rule ID", "Note ID", "적용범위", "적용방식", "검토필요"]);
  ruleNoteMap.addRow(["건강하고 튼튼하게", "R-002", "N-002", "단일행", "연계조건 적용", "Y"]);

  const changeLog = workbook.addWorksheet("Change Log");
  changeLog.addRow(["상품명", "Change ID", "Rule ID", "상태변경", "현행값", "변경값", "사유", "비고"]);
  changeLog.addRow([
    "건강하고 튼튼하게",
    "C-001",
    "R-002",
    "한도 상향",
    "암진단 단일건 2000",
    "암진단 단일건 3000",
    "상품 경쟁력 보완",
    "현장 안내 필요"
  ]);

  const rawBuffer = await workbook.xlsx.writeBuffer();
  const arrayBuffer =
    rawBuffer instanceof ArrayBuffer
      ? rawBuffer
      : rawBuffer.buffer.slice(rawBuffer.byteOffset, rawBuffer.byteOffset + rawBuffer.byteLength);

  const file = new File([arrayBuffer], "review-master.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  Object.defineProperty(file, "arrayBuffer", {
    value: async () => arrayBuffer
  });

  return file;
}

describe("Agent hub review agent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("applies the parsed draft in the review tab after upload", async () => {
    const user = userEvent.setup();

    vi.spyOn(reviewDraftModule, "buildReviewDraftFromFile").mockResolvedValue({
      fileName: "review-master.xlsx",
      sheetCount: 5,
      hasRequiredSheets: true,
      uploadStatusText: "시트 5개 인식 / 필수 시트 확인 완료 / 초안 생성 가능",
      noticeTitle: "건강하고 튼튼하게 인수기준 변경 안내",
      oneLineSummary: "건강하고 튼튼하게 상품의 변경 특약 1건을 현장공지 초안으로 정리했습니다.",
      majorChanges: "암진단(LI00112) 일반/건강 단일건 2000 → 3000",
      cautions: "암진단 가입시 소액암 진단 가입필수",
      effectiveDate: "2026-04-01",
      owner: "신계약심사P",
      faqs: [
        { id: "faq-1", question: "어떤 특약이 변경되었나요?", answer: "암진단" },
        { id: "faq-2", question: "가장 큰 변경 포인트는 무엇인가요?", answer: "암진단 단일건 상향" },
        { id: "faq-3", question: "연결된 주석이나 검토사항이 있나요?", answer: "소액암 가입필수" }
      ]
    });

    render(
      <AgentHubPage
        userSession={{
          employeeId: "28172",
          department: "신계약기획P",
          name: "홍수향",
          loggedInAt: new Date().toISOString()
        }}
      />
    );

    await user.click(screen.getByRole("tab", { name: /심사/i }));
    await user.upload(screen.getByLabelText("엑셀 업로드"), await buildReviewWorkbookFile());

    expect(await screen.findByText("review-master.xlsx")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "초안 생성" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("건강하고 튼튼하게 인수기준 변경 안내")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("건강하고 튼튼하게 상품의 변경 특약 1건을 현장공지 초안으로 정리했습니다.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("암진단(LI00112) 일반/건강 단일건 2000 → 3000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("암진단 가입시 소액암 진단 가입필수")).toBeInTheDocument();
  });
});
