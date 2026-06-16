import ExcelJS from "exceljs";
import { buildDraftWorkbookData, normalizeDraftRequest } from "@/lib/draft-builder";
import { buildDraftWorkbookBuffer } from "@/lib/draft-export";

describe("draft request normalization", () => {
  it("accepts legacy payload fields used by manual API callers", () => {
    const normalized = normalizeDraftRequest({
      uploadedFileName: "신계약가이드라인.xlsx",
      userInput: "소액암진단 단일건 한도를 1000에서 2000으로 변경",
      questionAnswers: ["인별합산 3000 유지", "주석 기존 기준 유지"],
      productName: "건강플러스암보험"
    });

    expect(normalized.fileName).toBe("신계약가이드라인.xlsx");
    expect(normalized.rawInput).toBe("소액암진단 단일건 한도를 1000에서 2000으로 변경");
    expect(normalized.productName).toBe("건강플러스암보험");
    expect(normalized.answers).toEqual({
      "legacy-1": "인별합산 3000 유지",
      "legacy-2": "주석 기존 기준 유지"
    });
  });

  it("builds a fallback summary when answers are missing", () => {
    const draft = buildDraftWorkbookData({
      fileName: "",
      rawInput: "소액암진단 단일건 한도 상향",
      answers: {}
    });

    expect(draft.summary.appliedAnswers).toEqual([
      "질문 답변 미입력 - 기본 초안으로 생성"
    ]);
    expect(draft.overview).toEqual([
      { 항목: "상품명", 값: "건강하고 튼튼하게" },
      { 항목: "판매일자", 값: "2026-04-01" }
    ]);
    expect(draft.ruleMaster[0]).toMatchObject({
      상품명: "건강하고 튼튼하게",
      판매일자: "2026-04-01"
    });
  });

  it("uses the entered product name in workbook rows", () => {
    const draft = buildDraftWorkbookData({
      fileName: "",
      rawInput: "소액암진단 단일건 한도 상향",
      answers: {},
      productName: "건강플러스암보험"
    });

    expect(draft.overview).toEqual([
      { 항목: "상품명", 값: "건강플러스암보험" },
      { 항목: "판매일자", 값: "2026-04-01" }
    ]);
    expect(draft.ruleMaster[0]).toMatchObject({
      상품명: "건강플러스암보험"
    });
    expect(draft.noteMaster[0]).toMatchObject({
      상품명: "건강플러스암보험"
    });
  });

  it("highlights changed cells when a baseline master exists", async () => {
    const { buffer } = await buildDraftWorkbookBuffer(
      {
        fileName: "change-guideline.xlsx",
        rawInput: "소액암진단 단일건 1000에서 2000으로 변경",
        answers: {
          question_1: "인별합산 3000 유지"
        },
        productName: "건강플러스암보험"
      },
      {
        baselineRequest: {
          fileName: "master-guideline.xlsx",
          rawInput: "",
          answers: {},
          productName: "건강플러스암보험"
        }
      }
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const ruleMaster = workbook.getWorksheet("Rule Master");
    expect(ruleMaster).toBeDefined();
    const headerValues = ruleMaster?.getRow(1).values as Array<string | number | undefined>;
    const sourceColumn = headerValues.indexOf("출처위치");
    expect(sourceColumn).toBeGreaterThan(0);

    const sourceCell = ruleMaster?.getRow(2).getCell(sourceColumn);
    expect(sourceCell?.fill).toMatchObject({
      type: "pattern",
      pattern: "solid"
    });
    expect(sourceCell?.font).toMatchObject({
      bold: true
    });
  });
});
