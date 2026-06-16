import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "@/app/page";

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

  async function createMasterWorkbook(user: ReturnType<typeof userEvent.setup>) {
    const masterUpload = screen.getByLabelText("가이드라인 엑셀 업로드");
    await user.upload(
      masterUpload,
      new File(["master"], "master-guideline.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      })
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
      screen.getByRole("heading", { name: "신계약 공통 에이전트" })
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
      screen.getByRole("heading", { name: "검토메모" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "확인 질문" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "초안 확정" })
    ).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("답변을 입력해 주세요.")).toHaveLength(5);
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
    await user.click(screen.getByRole("button", { name: "초안 확정" }));

    expect(await screen.findByRole("heading", { name: "최종 파일 미리보기" })).toBeInTheDocument();
    expect(screen.getByText("소액암진단")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "초안 확정" }));

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
    await user.click(screen.getByRole("button", { name: "초안 확정" }));
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

  it("keeps 초안 확정 disabled until every question has an answer", async () => {
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

    const confirmButton = screen.getByRole("button", { name: "초안 확정" });
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

    await user.click(screen.getByRole("button", { name: "초안 확정" }));

    expect(
      await screen.findByText("초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.")
    ).toBeInTheDocument();
  });
});
