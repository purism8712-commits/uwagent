import ExcelJS from "exceljs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "@/components/home-page";
import {
  buildFallbackProductCandidates,
  extractProductCandidatesFromFiles
} from "@/lib/product-candidate-parser";
import { buildDraftWorkbookData } from "@/lib/draft-builder";

describe("Common core app flow", () => {
  const authorizedSession = {
    employeeId: "12345",
    department: "신계약기획P",
    name: "홍길동",
    loggedInAt: new Date().toISOString()
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:preview-file"),
        revokeObjectURL: vi.fn()
      })
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  async function buildGuidelineFile(
    fileName = "master-guideline.xlsx",
    rows: Array<[string, string, string]> = [["LI00111", "건강하고 튼튼하게", "2026-04-01"]]
  ) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    sheet.addRow(["상품코드", "상품명", "판매일자"]);
    for (const row of rows) {
      sheet.addRow(row);
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const arrayBuffer =
      rawBuffer instanceof ArrayBuffer
        ? rawBuffer
        : rawBuffer.buffer.slice(
            rawBuffer.byteOffset,
            rawBuffer.byteOffset + rawBuffer.byteLength
          );

    const file = new File([arrayBuffer], fileName, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => arrayBuffer
    });
    return file;
  }

  async function buildGuideLayoutFile(
    fileName: string,
    productName: string,
    productCode: string,
    saleDate: string,
    insuranceCodes: string[]
  ) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    sheet.addRow([`ㅇ 상품명 : ${productName}`]);
    sheet.addRow([`ㅇ 상품코드 : ${productCode}`]);
    sheet.addRow([`ㅇ 판매 일자 : ${saleDate}`]);
    sheet.addRow([""]);
    sheet.addRow(["특약명", "", "보험코드", "비고란", "가입한도"]);
    sheet.addRow(["", "", "", "", "일반/건강"]);
    sheet.addRow(["", "", "", "", "단일건"]);

    insuranceCodes.forEach((insuranceCode, index) => {
      sheet.addRow([`특약${index + 1}`, "", insuranceCode, "", "1000"]);
    });

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const arrayBuffer =
      rawBuffer instanceof ArrayBuffer
        ? rawBuffer
        : rawBuffer.buffer.slice(
            rawBuffer.byteOffset,
            rawBuffer.byteOffset + rawBuffer.byteLength
          );

    const file = new File([arrayBuffer], fileName, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => arrayBuffer
    });
    return file;
  }

  async function buildBundledGuideLayoutFile(
    fileName: string,
    productName: string,
    productCode: string,
    saleDate: string
  ) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    sheet.addRow([`ㅇ 상품명 : ${productName}`]);
    sheet.addRow([`ㅇ 상품코드 : ${productCode}`]);
    sheet.addRow([`ㅇ 판매 일자 : ${saleDate}`]);
    sheet.addRow([""]);
    sheet.addRow(["특약명", "", "보험코드", "비고란", "가입한도"]);
    sheet.addRow(["", "", "", "", "일반/건강"]);
    sheet.addRow(["", "", "", "", "단일건"]);
    sheet.addRow(["주보험", "", "LI00111", "주1", "1000"]);
    sheet.addRow(["암진단", "", "LI00112", "주2", "2000"]);
    sheet.addRow(["소액암진단", "", "LI00113", "주2,3", "2000"]);
    sheet.addRow(["파워수술", "", "묶음특약", "", ""]);
    sheet.addRow(["", "1종", "LI00115", "주4\n1종*20배 < 5종가입금액", "100"]);
    sheet.addRow(["", "2종", "LI00116", "", "200"]);
    sheet.addRow(["", "3종", "LI00117", "", "300"]);
    sheet.addRow(["", "4종", "LI00118", "", "500"]);
    sheet.addRow(["", "5종", "LI00119", "", "1000"]);
    sheet.addRow(["신입원특약", "", "LI00120", "주5", "3000"]);
    sheet.addRow(["입원간병인", "", "LI00121", "주6", "5000"]);
    sheet.addRow(["주1) 주보험 가입시 소액암 진단 가입필수"]);
    sheet.addRow(["주2) 암진단 및 소액암진단은 동일 기준 적용"]);
    sheet.addRow(["주3) 파워수술은 종별로 개별 적용"]);
    sheet.addRow(["주4) 파워수술 인별합산 1구좌 가입가능"]);
    sheet.addRow(["주5) 신입원 특약 위험등급별 한도 : A등급 3만원, B등급 1만원"]);
    sheet.addRow(["주6) 입원 간병인은 타사 가입시 가입불가"]);

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const arrayBuffer =
      rawBuffer instanceof ArrayBuffer
        ? rawBuffer
        : rawBuffer.buffer.slice(
            rawBuffer.byteOffset,
            rawBuffer.byteOffset + rawBuffer.byteLength
          );

    const file = new File([arrayBuffer], fileName, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => arrayBuffer
    });
    return file;
  }

  async function createMasterWorkbook(user: ReturnType<typeof userEvent.setup>) {
    const masterUpload = screen.getByLabelText("가이드라인 엑셀 업로드");
    await user.upload(
      masterUpload,
      await buildGuidelineFile()
    );
    await user.click(
      screen.getByRole("button", { name: "전체 통합 마스터 파일 만들기" })
    );
    expect(
      await screen.findByText("통합 마스터 파일이 저장되었습니다.")
    ).toBeInTheDocument();
  }

  async function completeCoreConfirmation(user: ReturnType<typeof userEvent.setup>) {
    const targetSelectionDialog = screen.queryByRole("dialog", {
      name: "변경 대상 선택"
    });

    if (targetSelectionDialog) {
      const targetButtons = within(targetSelectionDialog).getAllByRole("button");
      await user.click(targetButtons[0]);
    }

    const coreQuestionDialog = screen.queryByRole("dialog", {
      name: "핵심 확인 질문"
    });

    if (!coreQuestionDialog) {
      return;
    }

    const coreAnswers = within(coreQuestionDialog).getAllByPlaceholderText("답변을 입력해 주세요.");
    for (const [index, input] of coreAnswers.entries()) {
      await user.type(input, `핵심 답변 ${index + 1}`);
    }

    await user.click(
      within(coreQuestionDialog).getByRole("button", { name: "핵심 확인 완료" })
    );
    await screen.findByText("검토 메모 및 확인질문");
  }

  async function fillReviewAnswers(
    user: ReturnType<typeof userEvent.setup>,
    prefix = "답변"
  ) {
    const answers = screen.queryAllByPlaceholderText("답변을 입력해 주세요.");
    for (const [index, input] of answers.entries()) {
      await user.type(input, `${prefix} ${index + 1}`);
    }
    return answers.length;
  }

  function getPreviewPayload() {
    return {
      overview: [
        { 항목: "가이드라인 개수", 값: "1개" },
        { 항목: "반영된 상품명 수", 값: "1개" },
        { 항목: "반영된 상품명 목록", 값: "건강하고 튼튼하게" },
        { 항목: "판매일자", 값: "2026-04-01" }
      ],
      summary: {
        target: "소액암진단",
        beforeValue: "단일건 1000",
        afterValue: "단일건 2000",
        appliedAnswers: ["답변 1"],
        pendingNotes: ["검토 필요"]
      },
      ruleMaster: [
        {
          상품명: "건강하고 튼튼하게",
          "Rule ID": "R-003",
          상태: "시행예정"
        }
      ],
      noteMaster: [],
      ruleNoteMap: [],
      changeLog: []
    };
  }

  it("renders master creation and change input on the first step", () => {
    render(<HomePage userSession={authorizedSession} />);

    expect(
      screen.getByRole("heading", { name: "신계약 인수기준 반영 Agent" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "전체 통합 마스터 파일 만들기" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "변경내용 입력" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("가이드라인 엑셀 업로드")).toBeInTheDocument();
    expect(screen.getByLabelText("변경된 엑셀 업로드")).toBeInTheDocument();
    expect(screen.getByLabelText("표 또는 자연어 입력")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "전체 통합 마스터 파일 만들기" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "미리보기" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "입력완료" })
    ).toBeDisabled();
    expect(screen.queryByText("검토 메모 및 확인질문")).not.toBeInTheDocument();
  });

  it("hides the warning badge after a master file is selected", async () => {
    const user = userEvent.setup();

    render(<HomePage userSession={authorizedSession} />);

    await user.upload(
      screen.getByLabelText("가이드라인 엑셀 업로드"),
      await buildGuidelineFile()
    );

    expect(
      screen.queryByText("아직 가이드라인 파일이 선택되지 않았습니다.")
    ).not.toBeInTheDocument();
    expect(screen.getByText("1개 기준 파일 선택됨")).toBeInTheDocument();
  });

  it("clears selected master files when the reset icon is clicked", async () => {
    const user = userEvent.setup();

    render(<HomePage userSession={authorizedSession} />);

    await user.upload(
      screen.getByLabelText("가이드라인 엑셀 업로드"),
      await buildGuidelineFile()
    );

    await user.click(screen.getByRole("button", { name: "선택 파일 초기화" }));

    expect(
      screen.getByText("아직 가이드라인 파일이 선택되지 않았습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByText("1개 기준 파일 선택됨")).not.toBeInTheDocument();
  });

  it("shows the stored master workbook preview after clicking the preview button", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true, preview: getPreviewPayload() })
        };
      }

      return {
        ok: true,
        json: async () => ({ ok: true })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    expect(screen.queryByText("Rule Master")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "미리보기" }));

    expect(
      await screen.findByRole("tab", { name: /rule master/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /rule master/i }));
    expect(await screen.findByRole("heading", { name: "Rule Master" })).toBeInTheDocument();
    expect(screen.getAllByText("건강하고 튼튼하게").length).toBeGreaterThan(0);
  });

  it("filters the rule master preview by product name", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            preview: {
              overview: [
                { 항목: "가이드라인 개수", 값: "2개" },
                { 항목: "반영된 상품명 수", 값: "2개" },
                { 항목: "반영된 상품명 목록", 값: "건강하고 튼튼하게 / 실버보험" }
              ],
              summary: {
                target: "소액암진단",
                beforeValue: "단일건 1000",
                afterValue: "단일건 2000",
                appliedAnswers: ["답변 1"],
                pendingNotes: ["검토 필요"]
              },
              ruleMaster: [
                {
                  상품명: "건강하고 튼튼하게",
                  주석ID: "N-001",
                  "Rule ID": "R-001",
                  상태: "표준화 완료"
                },
                {
                  상품명: "실버보험",
                  주석ID: "N-002",
                  "Rule ID": "R-002",
                  상태: "표준화 완료"
                }
              ],
              noteMaster: [
                { "Note ID": "N-001", "주석 원문": "주보험 가입시 소액암 진단 가입필수" },
                { "Note ID": "N-002", "주석 원문": "뇌혈관 진단 인별합산 한도 2000만 (66세 이상 1천만)" }
              ],
              ruleNoteMap: [],
              changeLog: []
            }
          })
        };
      }

      return {
        ok: true,
        json: async () => ({ ok: true })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "미리보기" }));
    await user.click(screen.getByRole("tab", { name: /rule master/i }));
    await user.type(screen.getByLabelText("상품명 필터"), "실버보험");

    expect(screen.getByText("실버보험")).toBeInTheDocument();
    expect(screen.queryByText("건강하고 튼튼하게")).not.toBeInTheDocument();
    expect(
      screen.getByTitle("N-002: 뇌혈관 진단 인별합산 한도 2000만 (66세 이상 1천만)")
    ).toBeInTheDocument();
  });

  it("filters the rule master preview by special item name", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            preview: {
              overview: [
                { 항목: "가이드라인 개수", 값: "2개" },
                { 항목: "반영된 상품명 수", 값: "2개" },
                { 항목: "반영된 상품명 목록", 값: "건강하고 튼튼하게 / 실버보험" }
              ],
              summary: {
                target: "소액암진단",
                beforeValue: "단일건 1000",
                afterValue: "단일건 2000",
                appliedAnswers: ["답변 1"],
                pendingNotes: ["검토 필요"]
              },
              ruleMaster: [
                {
                  상품명: "건강하고 튼튼하게",
                  특약명: "주보험",
                  주석ID: "N-001",
                  "Rule ID": "R-001",
                  상태: "표준화 완료"
                },
                {
                  상품명: "실버보험",
                  특약명: "뇌혈관진단",
                  주석ID: "N-002",
                  "Rule ID": "R-002",
                  상태: "표준화 완료"
                }
              ],
              noteMaster: [
                { "Note ID": "N-001", "주석 원문": "주보험 가입시 소액암 진단 가입필수" },
                { "Note ID": "N-002", "주석 원문": "뇌혈관 진단 인별합산 한도 2000만 (66세 이상 1천만)" }
              ],
              ruleNoteMap: [],
              changeLog: []
            }
          })
        };
      }

      return {
        ok: true,
        json: async () => ({ ok: true })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "미리보기" }));
    await user.click(screen.getByRole("tab", { name: /rule master/i }));
    await user.type(screen.getByLabelText("특약명 필터"), "뇌혈관진단");

    expect(screen.getByText("뇌혈관진단")).toBeInTheDocument();
    expect(screen.queryByText("주보험")).not.toBeInTheDocument();
  });

  it("creates the master workbook and then moves to the review screen", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      return {
        ok: true,
        json: async () => ({})
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);

    expect(
      screen.getByRole("heading", { name: "검토 메모 및 확인질문" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "초안생성" })
    ).toBeInTheDocument();
    expect(screen.queryAllByPlaceholderText("답변을 입력해 주세요.")).toHaveLength(0);
    expect(screen.queryByText("반영된 답변")).not.toBeInTheDocument();
    expect(screen.getByText("기본 규칙")).toBeInTheDocument();
  });

  it("uses fixed review rules instead of repeating the generic step 3 questions", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      return {
        ok: true,
        json: async () => ({})
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.type(
      screen.getByLabelText("표 또는 자연어 입력"),
      "소액암진단 단일건 한도를 1000에서 2000으로 변경"
    );
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);

    expect(screen.getByText("기본 규칙")).toBeInTheDocument();
    expect(
      screen.getAllByPlaceholderText("답변을 입력해 주세요.")
    ).toHaveLength(1);
    expect(screen.queryByText("질문 6")).not.toBeInTheDocument();
    expect(screen.queryByText("질문 7")).not.toBeInTheDocument();
  });

  it("adds more review questions when the change text contains extra review triggers", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      return {
        ok: true,
        json: async () => ({})
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.type(
      screen.getByLabelText("표 또는 자연어 입력"),
      "소액암진단 단일건 한도를 1000에서 2000으로 변경하고 66세 이상 예외는 시행예정으로 둡니다."
    );
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);

    expect(screen.getAllByPlaceholderText("답변을 입력해 주세요.")).toHaveLength(2);
    expect(screen.getByText("질문 1")).toBeInTheDocument();
    expect(screen.getByText("질문 2")).toBeInTheDocument();
  });

  it("shows final summary and enables excel download after confirming the draft", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      if (typeof input === "string" && input === "/api/draft-summary") {
        return {
          ok: true,
          json: async () => ({
            summary: {
              target: "소액암진단",
              beforeValue: "단일건 1000",
              afterValue: "단일건 2000",
              appliedAnswers: [
                "일반/건강과 간편 모두 2000으로 변경",
                "인별합산 3000 유지"
              ],
              pendingNotes: ["66세 이상 예외 주석은 최종 검토 필요"]
            }
          })
        };
      }

      return {
        ok: true,
        blob: async () => new Blob(["xlsx"])
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);
    await fillReviewAnswers(user);
    await user.click(screen.getByRole("button", { name: "초안생성" }));

    expect(await screen.findByRole("heading", { name: "초안 생성 결과" })).toBeInTheDocument();
    expect(screen.getByText("소액암진단")).toBeInTheDocument();
    const summaryCard = screen.getByText("반영 요약").closest("div");
    expect(summaryCard).not.toBeNull();
    expect(
      within(summaryCard as HTMLElement).getByText(
        "답변 2개를 반영해 소액암진단 단일건 한도를 1000에서 2000으로 정리했고, 남은 검토 항목은 1건입니다."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "통합 마스터와 상품 추출 다운로드" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "통합 마스터 다운로드" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "최종 업로드" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "지원AGENT 연결" })
    ).toHaveAttribute("href", "https://uw-guide.vercel.app/support-agent-app.html");
    expect(
      screen.getByRole("link", { name: "심사AGENT 연결" })
    ).toHaveAttribute("href", "https://review-agent-lovat.vercel.app/");
    expect(
      screen.getByRole("button", { name: "상품 추출 다운로드" })
    ).toBeDisabled();
    expect(
      screen.queryByRole("dialog", { name: "핵심 확인 질문" })
    ).not.toBeInTheDocument();
    const draftSummaryCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url === "/api/draft-summary"
    );
    expect(draftSummaryCall).toBeDefined();
    expect(draftSummaryCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"masterProducts\"")
      })
    );
  });

  it("shows matching product candidates and enables product extract download after selection", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      if (typeof input === "string" && input === "/api/draft-summary") {
        return {
          ok: true,
          json: async () => ({
            summary: {
              target: "소액암진단",
              beforeValue: "단일건 1000",
              afterValue: "단일건 2000",
              appliedAnswers: ["답변"],
              pendingNotes: ["검토 필요"]
            }
          })
        };
      }

      return {
        ok: true,
        blob: async () => new Blob(["xlsx"])
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);
    await fillReviewAnswers(user);
    await user.click(screen.getByRole("button", { name: "초안생성" }));

    const extractInput = screen.getByPlaceholderText("예: 건강플러스암보험");
    await user.type(extractInput, "건강");

    expect(
      screen.getByRole("button", { name: "건강하고 튼튼하게 선택" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "건강하고 튼튼하게 선택" }));

    expect(extractInput).toHaveValue("건강하고 튼튼하게");
    expect(
      screen.getByRole("button", { name: "상품 추출 다운로드" })
    ).toBeEnabled();
  });

  it("shows sale dates parsed from the uploaded Excel sheet in product candidates", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      if (typeof input === "string" && input === "/api/draft-summary") {
        return {
          ok: true,
          json: async () => ({
            summary: {
              target: "소액암진단",
              beforeValue: "단일건 1000",
              afterValue: "단일건 2000",
              appliedAnswers: ["답변"],
              pendingNotes: ["검토 필요"]
            }
          })
        };
      }

      return {
        ok: true,
        blob: async () => new Blob(["xlsx"])
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await user.upload(
      screen.getByLabelText("가이드라인 엑셀 업로드"),
      await buildGuidelineFile("실버보험 신계약가이드라인.xlsx", [
        ["LI00122", "실버보험 신계약가이드라인", "2026-05-15"]
      ])
    );
    await user.click(screen.getByRole("button", { name: "전체 통합 마스터 파일 만들기" }));
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);
    await fillReviewAnswers(user);
    await user.click(screen.getByRole("button", { name: "초안생성" }));

    const extractInput = screen.getByPlaceholderText("예: 건강플러스암보험");
    await user.type(extractInput, "실버");

    expect(
      await screen.findByRole("button", { name: "실버보험 신계약가이드라인 선택" })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "실버보험 신계약가이드라인 선택" })
    ).toHaveTextContent("판매일자 2026-05-15");
  });

  it("restores stored master candidates after page reload so filename-based search still works", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            snapshot: {
              uploadedFiles: [
                "건강하게 신계약가이드라인.xlsx",
                "실버보험 신계약가이드라인.xlsx"
              ],
              request: {
                masterProducts: []
              }
            },
            preview: getPreviewPayload()
          })
        };
      }

      if (typeof input === "string" && input === "/api/draft-summary") {
        return {
          ok: true,
          json: async () => ({
            summary: {
              target: "소액암진단",
              beforeValue: "단일건 1000",
              afterValue: "단일건 2000",
              appliedAnswers: ["답변"],
              pendingNotes: ["검토 필요"]
            }
          })
        };
      }

      return {
        ok: true,
        blob: async () => new Blob(["xlsx"])
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    expect(
      await screen.findByText("2개 기준 파일 선택됨")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);
    await fillReviewAnswers(user);
    await user.click(screen.getByRole("button", { name: "초안생성" }));

    const extractInput = screen.getByPlaceholderText("예: 건강플러스암보험");
    await user.type(extractInput, "실버");

    expect(
      await screen.findByRole("button", { name: "실버보험 선택" })
    ).toBeInTheDocument();
  });

  it("parses sale dates directly from the uploaded Excel workbook", async () => {
    const file = await buildGuidelineFile("실버보험 신계약가이드라인.xlsx", [
      ["LI00122", "실버보험 신계약가이드라인", "2026-05-15"]
    ]);

    const candidates = await extractProductCandidatesFromFiles([file]);

    expect(candidates).toEqual([
      expect.objectContaining({
        productCode: "LI00122",
        productName: "실버보험 신계약가이드라인",
        saleDate: "2026-05-15"
      })
    ]);
  });

  it("parses product code and insurance code from guide-layout workbook metadata", async () => {
    const file = await buildGuideLayoutFile(
      "건강하게 신계약가이드라인.xlsx",
      "건강하고 튼튼하게",
      "LP040506",
      "2026년 4월 1일",
      ["LI00111", "LI00112", "LI00113"]
    );

    const candidates = await extractProductCandidatesFromFiles([file]);

    expect(candidates).toEqual([
      expect.objectContaining({
        productName: "건강하고 튼튼하게",
        productCode: "LP040506",
        insuranceCode: "LI00111 외 2건",
        insuranceCodeMapping: "특약1: LI00111 / 특약2: LI00112 / 특약3: LI00113",
        saleDate: "2026-04-01"
      })
    ]);
  });

  it("combines bundled coverage rows into row-level insurance-code mappings", async () => {
    const file = await buildBundledGuideLayoutFile(
      "건강하게 신계약가이드라인.xlsx",
      "건강하고 튼튼하게",
      "LP040506",
      "2026년 4월 1일"
    );

    const candidates = await extractProductCandidatesFromFiles([file]);

    expect(candidates).toEqual([
      expect.objectContaining({
        productName: "건강하고 튼튼하게",
        productCode: "LP040506",
        insuranceCode: "LI00111 외 9건",
        insuranceCodeMapping:
          "주보험: LI00111 / 암진단: LI00112 / 소액암진단: LI00113 / 파워수술 1종: LI00115 / 파워수술 2종: LI00116 / 파워수술 3종: LI00117 / 파워수술 4종: LI00118 / 파워수술 5종: LI00119 / 신입원특약: LI00120 / 입원간병인: LI00121",
        specialItems: expect.arrayContaining([
          expect.objectContaining({
            specialName: "주보험",
            insuranceCode: "LI00111",
            limitValue: "1000",
            noteText: "주1"
          }),
          expect.objectContaining({
            specialName: "암진단",
            insuranceCode: "LI00112",
            limitValue: "2000",
            noteText: "주2"
          }),
          expect.objectContaining({
            specialName: "소액암진단",
            insuranceCode: "LI00113",
            limitValue: "2000",
            noteText: "주2,3"
          }),
          expect.objectContaining({
            specialName: "파워수술 1종",
            insuranceCode: "LI00115",
            limitValue: "100",
            noteText: "주4 1종*20배 < 5종가입금액"
          }),
          expect.objectContaining({
            specialName: "파워수술 2종",
            insuranceCode: "LI00116",
            limitValue: "200"
          })
        ]),
        noteEntries: expect.arrayContaining([
          expect.objectContaining({
            noteLabel: "주1",
            noteText: "주보험 가입시 소액암 진단 가입필수",
            noteType: "본문주석"
          }),
          expect.objectContaining({
            noteLabel: "주2",
            noteText: "암진단 및 소액암진단은 동일 기준 적용",
            noteType: "본문주석"
          })
        ]),
        saleDate: "2026-04-01"
      })
    ]);
  });

  it("writes the uploaded workbook's as-is limits and note text into the master preview", async () => {
    const file = await buildBundledGuideLayoutFile(
      "건강하게 신계약가이드라인.xlsx",
      "건강하고 튼튼하게",
      "LP040506",
      "2026년 4월 1일"
    );

    const masterProducts = await extractProductCandidatesFromFiles([file]);
    const draft = buildDraftWorkbookData({
      fileName: "건강하게 신계약가이드라인.xlsx",
      rawInput: "",
      answers: {},
      productName: "건강하고 튼튼하게",
      uploadedFiles: ["건강하게 신계약가이드라인.xlsx"],
      masterProducts
    }, { mode: "master" });

    expect(draft.ruleMaster).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          특약명: "주보험",
          "as-is 일반/건강 단일건": "1000",
          가입한도: "1000",
          비고: "주1"
        }),
        expect.objectContaining({
          특약명: "파워수술 1종",
          "as-is 일반/건강 단일건": "100",
          가입한도: "100",
          비고: "주4 1종*20배 < 5종가입금액"
        })
      ])
    );

    expect(draft.noteMaster).toHaveLength(7);
    const noteById = new Map(draft.noteMaster.map((row) => [String(row["Note ID"] ?? ""), row]));
    expect(noteById.get("N-001")).toMatchObject({
      특약명: "주보험",
      주석명: "주보험 / LI00111 비고",
      "주석 원문": "주보험 가입시 소액암 진단 가입필수",
      주석유형: "비고 / 본문주석",
      참조횟수: 1
    });
    expect(noteById.get("N-002")).toMatchObject({
      특약명: "암진단 / 소액암진단",
      주석명: "암진단 / LI00112 비고",
      "주석 원문": "암진단 및 소액암진단은 동일 기준 적용",
      주석유형: "비고 / 본문주석",
      참조횟수: 2
    });
    expect(noteById.get("N-003")).toMatchObject({
      특약명: "소액암진단",
      주석명: "소액암진단 / LI00113 비고",
      "주석 원문": "파워수술은 종별로 개별 적용",
      주석유형: "비고 / 본문주석",
      참조횟수: 1
    });
    expect(noteById.get("N-004")).toMatchObject({
      특약명: "파워수술 1종",
      주석명: "파워수술 1종 / LI00115 비고",
      "주석 원문": "파워수술 인별합산 1구좌 가입가능",
      주석유형: "비고 / 계산식",
      참조횟수: 1
    });
    expect(noteById.get("N-005")).toMatchObject({
      특약명: "파워수술 1종",
      주석명: "파워수술 1종 / LI00115 비고",
      "주석 원문": "1종*20배 < 5종가입금액",
      주석유형: "비고 / 계산식",
      참조횟수: 1
    });
    expect(noteById.get("N-006")).toMatchObject({
      특약명: "신입원특약",
      주석명: "신입원특약 / LI00120 비고",
      "주석 원문": "신입원 특약 위험등급별 한도 : A등급 3만원, B등급 1만원",
      주석유형: "비고 / 본문주석",
      참조횟수: 1
    });
    expect(noteById.get("N-007")).toMatchObject({
      특약명: "입원간병인",
      주석명: "입원간병인 / LI00121 비고",
      "주석 원문": "입원 간병인은 타사 가입시 가입불가",
      주석유형: "비고 / 본문주석",
      참조횟수: 1
    });
  });

  it("builds fallback product candidates from uploaded filenames when parsing data is missing", () => {
    const candidates = buildFallbackProductCandidates([
      "실버보험 신계약가이드라인.xlsx",
      "건강하게 신계약가이드라인.xlsx"
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({
        productName: "실버보험",
        sourceFileName: "실버보험 신계약가이드라인.xlsx"
      }),
      expect.objectContaining({
        productName: "건강하게",
        sourceFileName: "건강하게 신계약가이드라인.xlsx"
      })
    ]);
  });

  it("downloads integrated master directly when the button is clicked", async () => {
    const user = userEvent.setup();
    const anchorClickMock = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      if (typeof input === "string" && input === "/api/draft-summary") {
        return {
          ok: true,
          json: async () => ({
            summary: {
              target: "소액암진단",
              beforeValue: "단일건 1000",
              afterValue: "단일건 2000",
              appliedAnswers: ["답변"],
              pendingNotes: ["검토 필요"]
            }
          })
        };
      }

      return {
        ok: true,
        blob: async () => new Blob(["xlsx"])
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);
    await fillReviewAnswers(user);
    await user.click(screen.getByRole("button", { name: "초안생성" }));
    await user.click(await screen.findByRole("button", { name: "통합 마스터 다운로드" }));

    expect(anchorClickMock).toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(
        ([url]) => typeof url === "string" && url === "/api/draft-export/save"
      )
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(
        ([url]) => typeof url === "string" && url === "/api/draft-summary"
      )
    ).toBe(true);
    expect(
      screen.getAllByText(
        "다운로드가 시작되면 브라우저의 파일 열기/저장 안내를 확인해 주세요."
      )
    ).toHaveLength(2);
  });

  it("clears the previous draft summary when the change text is edited", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      if (typeof input === "string" && input === "/api/draft-summary") {
        return {
          ok: true,
          json: async () => ({
            summary: {
              target: "소액암진단",
              beforeValue: "단일건 1000",
              afterValue: "단일건 2000",
              appliedAnswers: ["답변"],
              pendingNotes: ["검토 필요"]
            }
          })
        };
      }

      return {
        ok: true,
        blob: async () => new Blob(["xlsx"])
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.type(screen.getByLabelText("표 또는 자연어 입력"), "소액암진단 5천으로 변경");
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);
    await fillReviewAnswers(user);
    await user.click(screen.getByRole("button", { name: "초안생성" }));

    expect(await screen.findByRole("heading", { name: "초안 생성 결과" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("표 또는 자연어 입력"));
    await user.type(screen.getByLabelText("표 또는 자연어 입력"), "뇌혈관 진단 한도 변경");

    expect(screen.queryByRole("heading", { name: "초안 생성 결과" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "통합 마스터와 상품 추출 다운로드" })).not.toBeInTheDocument();
  });

  it("keeps the core question window open until the user clicks the completion button", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      return {
        ok: true,
        json: async () => ({})
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await user.upload(
      screen.getByLabelText("가이드라인 엑셀 업로드"),
      await buildBundledGuideLayoutFile(
        "실버보험 신계약가이드라인.xlsx",
        "실버보험",
        "LP030405",
        "2026년 5월 1일"
      )
    );
    await user.click(screen.getByRole("button", { name: "전체 통합 마스터 파일 만들기" }));
    await user.type(
      screen.getByLabelText("표 또는 자연어 입력"),
      "소액암진단 단일건 한도를 1000에서 2000으로 변경"
    );
    await user.click(screen.getByRole("button", { name: "입력완료" }));

    const targetDialog = await screen.findByRole("dialog", { name: "변경 대상 선택" });
    await user.click(within(targetDialog).getAllByRole("button")[0]);

    const coreDialog = await screen.findByRole("dialog", { name: "핵심 확인 질문" });
    const inputs = within(coreDialog).getAllByPlaceholderText("답변을 입력해 주세요.");

    for (const [index, input] of inputs.entries()) {
      await user.type(input, `핵심 답변 ${index + 1}`);
    }

    expect(within(coreDialog).getByRole("button", { name: "핵심 확인 완료" })).toBeEnabled();
    expect(screen.getByRole("dialog", { name: "핵심 확인 질문" })).toBeInTheDocument();

    await user.click(within(coreDialog).getByRole("button", { name: "핵심 확인 완료" }));

    expect(screen.queryByRole("dialog", { name: "핵심 확인 질문" })).not.toBeInTheDocument();
  });

  it("keeps 초안생성 disabled until every question has an answer", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      return {
        ok: true,
        json: async () => ({})
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.type(
      screen.getByLabelText("표 또는 자연어 입력"),
      "소액암진단 단일건 한도를 1000에서 2000으로 변경"
    );
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);

    const confirmButton = screen.getByRole("button", { name: "초안생성" });
    expect(confirmButton).toBeDisabled();

    await fillReviewAnswers(user);

    expect(confirmButton).toBeEnabled();
  });

  it("shows an error message when draft summary generation fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/master-workbook") {
        return {
          ok: true,
          json: async () => ({ ok: true })
        };
      }

      return {
        ok: false
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage userSession={authorizedSession} />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await completeCoreConfirmation(user);
    await fillReviewAnswers(user);

    await user.click(screen.getByRole("button", { name: "초안생성" }));

    expect(
      await screen.findByText("초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.")
    ).toBeInTheDocument();
  });
});


