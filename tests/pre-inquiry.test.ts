import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerPreInquiry } from "@/lib/pre-inquiry";

const masterWorkbookLoadMock = vi.hoisted(() => vi.fn());
const hydrateMasterProductsFromDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/master-workbook-store", () => ({
  masterWorkbookStore: {
    load: masterWorkbookLoadMock
  }
}));

vi.mock("@/lib/master-product-hydrator", () => ({
  hydrateMasterProductsFromData: hydrateMasterProductsFromDataMock
}));

describe("pre inquiry source preference", () => {
  beforeEach(() => {
    vi.stubEnv("BIZROUTER_API_KEY", "");
    vi.stubEnv("BIZROUTER_BASE_URL", "");
    vi.stubEnv("BIZROUTER_MODEL", "");
    masterWorkbookLoadMock.mockReset();
    hydrateMasterProductsFromDataMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the final uploaded master workbook snapshot over original source files", async () => {
    masterWorkbookLoadMock.mockResolvedValue({
      uploadedFiles: ["통합마스터.xlsx"],
      sourceFiles: ["원본A.xlsx", "원본B.xlsx"],
      request: {
        fileName: "통합마스터.xlsx",
        rawInput: "",
        answers: {},
        productName: "",
        uploadedFiles: ["통합마스터.xlsx"],
        masterProducts: [
          {
            productName: "건강하게",
            productCode: "LP040506",
            insuranceCode: "LI00111",
            saleDate: "2026-04-01",
            sourceFileName: "최종통합마스터.xlsx",
            sheetName: "Rule Master",
            insuranceCodeMapping: "주보험: LI00111",
            specialItems: [
              {
                specialName: "주보험",
                insuranceCode: "LI00111",
                limitValue: "3000"
              }
            ],
            noteEntries: []
          }
        ]
      },
      createdAt: "2026-06-21T00:00:00.000Z"
    });

    hydrateMasterProductsFromDataMock.mockResolvedValue([
      {
        productName: "건강하게",
        productCode: "LP040506",
        insuranceCode: "LI00111",
        saleDate: "2026-04-01",
        sourceFileName: "원본A.xlsx",
        sheetName: "Sheet1",
        insuranceCodeMapping: "주보험: LI00111",
        specialItems: [
          {
            specialName: "주보험",
            insuranceCode: "LI00111",
            limitValue: "1000"
          }
        ],
        noteEntries: []
      }
    ]);

    const result = await answerPreInquiry("주보험 한도");

    expect(hydrateMasterProductsFromDataMock).toHaveBeenCalledWith(["원본A.xlsx", "원본B.xlsx"]);
    expect(result.source).toBe("local");
    expect(result.evidence[0]?.sourceFileName).toBe("최종통합마스터.xlsx");
    expect(result.evidence[0]?.section).toBe("Rule Master");
  });
});
