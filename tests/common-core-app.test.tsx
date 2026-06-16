import ExcelJS from "exceljs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "@/app/page";
import { extractProductCandidatesFromFiles } from "@/lib/product-candidate-parser";

describe("Common core app flow", () => {
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

  function getPreviewPayload() {
    return {
      overview: [
        { 항목: "상품명", 값: "건강하고 튼튼하게" },
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
    render(<HomePage />);

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

    render(<HomePage />);

    await user.upload(
      screen.getByLabelText("가이드라인 엑셀 업로드"),
      await buildGuidelineFile()
    );

    expect(
      screen.queryByText("아직 가이드라인 파일이 선택되지 않았습니다.")
    ).not.toBeInTheDocument();
    expect(screen.getByText("1개 기준 파일 선택됨")).toBeInTheDocument();
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

    render(<HomePage />);

    await createMasterWorkbook(user);
    expect(screen.queryByText("Rule Master")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "미리보기" }));

    expect(await screen.findByText("Rule Master")).toBeInTheDocument();
    expect(screen.getAllByText("건강하고 튼튼하게").length).toBeGreaterThan(0);
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

    render(<HomePage />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));

    expect(
      screen.getByRole("heading", { name: "검토 메모 및 확인질문" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "초안생성" })
    ).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("답변을 입력해 주세요.")).toHaveLength(5);
    expect(screen.queryByText("반영된 답변")).not.toBeInTheDocument();
    expect(
      screen.getByText(/master-guideline 중심 검토 메모에 따라, master-guideline의 각 파일을 표준 템플릿으로 먼저 변환한 뒤 머지할까요\?/i)
    ).toBeInTheDocument();
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

    render(<HomePage />);

    await createMasterWorkbook(user);
    await user.type(
      screen.getByLabelText("표 또는 자연어 입력"),
      "소액암진단 단일건 한도를 1000에서 2000으로 변경하고 66세 이상 예외는 시행예정으로 둡니다."
    );
    await user.click(screen.getByRole("button", { name: "입력완료" }));

    expect(screen.getAllByPlaceholderText("답변을 입력해 주세요.")).toHaveLength(7);
    expect(screen.getByText("질문 8")).toBeInTheDocument();
    expect(screen.getByText("질문 9")).toBeInTheDocument();
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

    render(<HomePage />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    await user.type(
      screen.getAllByPlaceholderText("답변을 입력해 주세요.")[0],
      "일반/건강과 간편 모두 2000으로 변경"
    );
    await user.type(
      screen.getAllByPlaceholderText("답변을 입력해 주세요.")[1],
      "인별합산 3000 유지"
    );
    await user.type(
      screen.getAllByPlaceholderText("답변을 입력해 주세요.")[2],
      "66세 이상 예외는 기존 기준 유지"
    );
    await user.type(
      screen.getAllByPlaceholderText("답변을 입력해 주세요.")[3],
      "연계조건 유지"
    );
    await user.type(
      screen.getAllByPlaceholderText("답변을 입력해 주세요.")[4],
      "시행예정 초안으로 유지"
    );
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
    expect(
      screen.getByRole("button", { name: "상품 추출 다운로드" })
    ).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/draft-summary",
      expect.objectContaining({
        method: "POST"
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

    render(<HomePage />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    const answers = screen.getAllByPlaceholderText("답변을 입력해 주세요.");
    for (const [index, input] of answers.entries()) {
      await user.type(input, `답변 ${index + 1}`);
    }
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

    render(<HomePage />);

    await user.upload(
      screen.getByLabelText("가이드라인 엑셀 업로드"),
      await buildGuidelineFile("실버보험 신계약가이드라인.xlsx", [
        ["LI00122", "실버보험 신계약가이드라인", "2026-05-15"]
      ])
    );
    await user.click(screen.getByRole("button", { name: "전체 통합 마스터 파일 만들기" }));
    await user.click(screen.getByRole("button", { name: "입력완료" }));

    const answers = screen.getAllByPlaceholderText("답변을 입력해 주세요.");
    for (const [index, input] of answers.entries()) {
      await user.type(input, `답변 ${index + 1}`);
    }
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

    render(<HomePage />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    const answers = screen.getAllByPlaceholderText("답변을 입력해 주세요.");
    for (const [index, input] of answers.entries()) {
      await user.type(input, `답변 ${index + 1}`);
    }
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

    render(<HomePage />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));

    const confirmButton = screen.getByRole("button", { name: "초안생성" });
    expect(confirmButton).toBeDisabled();

    const answers = screen.getAllByPlaceholderText("답변을 입력해 주세요.");
    for (const [index, input] of answers.entries()) {
      await user.type(input, `답변 ${index + 1}`);
    }

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

    render(<HomePage />);

    await createMasterWorkbook(user);
    await user.click(screen.getByRole("button", { name: "입력완료" }));
    const answers = screen.getAllByPlaceholderText("답변을 입력해 주세요.");
    for (const [index, input] of answers.entries()) {
      await user.type(input, `답변 ${index + 1}`);
    }

    await user.click(screen.getByRole("button", { name: "초안생성" }));

    expect(
      await screen.findByText("초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.")
    ).toBeInTheDocument();
  });
});
