import ExcelJS from "exceljs";
import { buildDraftWorkbookData, normalizeDraftRequest } from "@/lib/draft-builder";
import {
  buildReviewMemos,
  buildReviewQuestionGroups,
  buildReviewQuestions
} from "@/lib/review-content";
import type { ParsedProductCandidate } from "@/lib/product-candidate-parser";
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

  it("derives per-file product labels from uploaded guideline filenames", () => {
    const draft = buildDraftWorkbookData({
      fileName: "건강하게 신계약가이드라인.xlsx",
      rawInput: "파일별 표준화 후 전체 통합본 생성",
      answers: {},
      uploadedFiles: [
        "건강하게 신계약가이드라인.xlsx",
        "실버보험 신계약가이드라인.xlsx"
      ]
    });

    expect(draft.overview).toEqual([
      { 항목: "가이드라인 개수", 값: "2개" },
      { 항목: "반영된 상품명 수", 값: "2개" },
      { 항목: "반영된 상품명 목록", 값: "건강하게 / 실버보험" },
      { 항목: "판매일자", 값: "2026-04-01" },
      { 항목: "상품 코드 수", 값: "2개" },
      { 항목: "업로드 파일 수", 값: "2개" },
      { 항목: "처리 방식", 값: "파일별 표준화 후 단일 통합 마스터 병합" }
    ]);
    expect(draft.ruleMaster[0]).toMatchObject({
      상품명: "건강하게",
      출처위치: "건강하게 신계약가이드라인.xlsx"
    });
    expect(draft.ruleMaster[1]).toMatchObject({
      상품명: "실버보험",
      출처위치: "실버보험 신계약가이드라인.xlsx"
    });
  });

  it("merges uploaded files into a standardized master workbook preview", () => {
    const draft = buildDraftWorkbookData({
      fileName: "master-guideline.xlsx",
      rawInput: "파일별 표준화 후 전체 통합본 생성",
      answers: {},
      productName: "건강플러스암보험",
      uploadedFiles: ["master-guideline.xlsx", "change-guideline.xlsx"]
    }, { mode: "master" });

    expect(draft.overview).toEqual([
      { 항목: "가이드라인 개수", 값: "2개" },
      { 항목: "반영된 상품명 수", 값: "2개" },
      { 항목: "반영된 상품명 목록", 값: "master-guideline / change-guideline" },
      { 항목: "판매일자", 값: "2026-04-01" },
      { 항목: "상품 코드 수", 값: "2개" },
      { 항목: "업로드 파일 수", 값: "2개" },
      { 항목: "처리 방식", 값: "파일별 표준화 후 단일 통합 마스터 병합" }
    ]);
    expect(draft.ruleMaster).toHaveLength(2);
    expect(draft.ruleMaster[0]).toMatchObject({
      "Rule ID": "R-01",
      상태: "표준화 완료",
      출처위치: "master-guideline.xlsx"
    });
    expect(Object.keys(draft.ruleMaster[0]).some((key) => key.startsWith("to-be"))).toBe(false);
    expect(draft.changeLog[0]).toMatchObject({
      "Rule ID": "R-01",
      상태변경: "파일별 표준화 -> 특약별 머지"
    });
  });

  it("expands bundled insurance codes into row-level rule and note rows", () => {
    const masterProduct = {
      id: "guide-건강하게-신계약가이드라인-xlsx-Sheet1-LP040506",
      productCode: "LP040506",
      insuranceCode: "LI00111 외 9건",
      productName: "건강하고 튼튼하게",
      saleDate: "2026-04-01",
      sourceFileName: "건강하게 신계약가이드라인.xlsx",
      sheetName: "Sheet1",
      specialItems: [
        { specialName: "주보험", insuranceCode: "LI00111", noteText: "주1" },
        { specialName: "암진단", insuranceCode: "LI00112", noteText: "주2" },
        { specialName: "소액암진단", insuranceCode: "LI00113", noteText: "주2,3" },
        { specialName: "파워수술 1종", insuranceCode: "LI00115", noteText: "주4 1종*20배 < 5종가입금액" },
        { specialName: "파워수술 2종", insuranceCode: "LI00116" }
      ],
      noteEntries: [
        { noteLabel: "주1", noteText: "주보험 가입시 소액암 진단 가입필수", noteType: "본문주석" },
        { noteLabel: "주2", noteText: "암진단 및 소액암진단은 동일 기준 적용", noteType: "본문주석" }
      ],
      insuranceCodeMapping:
        "주보험: LI00111 / 암진단: LI00112 / 소액암진단: LI00113 / 파워수술 1종: LI00115 / 파워수술 2종: LI00116",
      summary: "상품코드 LP040506 / 보험코드 LI00111 외 9건 기준 / 판매일자 2026-04-01"
    } satisfies ParsedProductCandidate;

    const draft = buildDraftWorkbookData({
      fileName: "건강하게 신계약가이드라인.xlsx",
      rawInput: "파일별 표준화 후 전체 통합본 생성",
      answers: {},
      productName: "건강하고 튼튼하게",
      uploadedFiles: ["건강하게 신계약가이드라인.xlsx"],
      masterProducts: [masterProduct]
    });

    expect(draft.ruleMaster).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          특약명: "주보험",
          보험코드: "LI00111",
          주석ID: "N-001"
        }),
        expect.objectContaining({
          특약명: "암진단",
          보험코드: "LI00112",
          주석ID: "N-002"
        }),
        expect.objectContaining({
          특약명: "소액암진단",
          보험코드: "LI00113",
          주석ID: "N-002"
        }),
        expect.objectContaining({
          특약명: "파워수술 1종",
          보험코드: "LI00115",
          주석ID: "N-003"
        }),
        expect.objectContaining({
          특약명: "파워수술 2종",
          보험코드: "LI00116"
        })
      ])
    );

    expect(draft.noteMaster).toHaveLength(3);
    expect(draft.noteMaster).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "Note ID": "N-001",
          특약명: "주보험",
          주석명: "주보험 / LI00111 비고",
          "주석 원문": "주보험 가입시 소액암 진단 가입필수",
          주석유형: "비고 / 본문주석",
          참조횟수: 1
        }),
        expect.objectContaining({
          "Note ID": "N-002",
          특약명: "암진단 / 소액암진단",
          주석명: "암진단 / LI00112 비고",
          "주석 원문": "암진단 및 소액암진단은 동일 기준 적용",
          주석유형: "비고 / 본문주석",
          참조횟수: 2
        }),
        expect.objectContaining({
          "Note ID": "N-003",
          특약명: "파워수술 1종",
          주석명: "파워수술 1종 / LI00115 비고",
          "주석 원문": "1종*20배 < 5종가입금액",
          주석유형: "비고 / 계산식",
          참조횟수: 1
        })
      ])
    );

    expect(draft.ruleNoteMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          특약명: "주보험",
          보험코드: "LI00111",
          "Note ID": "N-001"
        }),
        expect.objectContaining({
          특약명: "파워수술 1종",
          보험코드: "LI00115",
          "Note ID": "N-003"
        })
      ])
    );

    expect(draft.changeLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          특약명: "주보험",
          상태변경: "파일별 표준화 -> 특약별 머지"
        }),
        expect.objectContaining({
          특약명: "파워수술 1종",
          상태변경: "파일별 표준화 -> 특약별 머지"
        })
      ])
    );
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

  it("changes to-be limits only for the special item matched by the natural language request", () => {
    const masterProduct = {
      id: "guide-건강하게-신계약가이드라인-xlsx-Sheet1-LP040506",
      productCode: "LP040506",
      insuranceCode: "LI00111 외 9건",
      productName: "건강하고 튼튼하게",
      saleDate: "2026-04-01",
      sourceFileName: "건강하게 신계약가이드라인.xlsx",
      sheetName: "Sheet1",
      specialItems: [
        { specialName: "주보험", insuranceCode: "LI00111", limitValue: "1000", noteText: "주1" },
        { specialName: "암진단", insuranceCode: "LI00112", limitValue: "2000", noteText: "주2" },
        { specialName: "소액암진단", insuranceCode: "LI00113", limitValue: "2000", noteText: "주2,3" },
        { specialName: "파워수술 1종", insuranceCode: "LI00115", limitValue: "100", noteText: "주4 1종*20배 < 5종가입금액" }
      ],
      noteEntries: [
        { noteLabel: "주1", noteText: "주보험 가입시 소액암 진단 가입필수", noteType: "본문주석" },
        { noteLabel: "주2", noteText: "암진단 및 소액암진단은 동일 기준 적용", noteType: "본문주석" },
        { noteLabel: "주3", noteText: "소액암 진단 인별합산 한도 5천만원 (단, 66세 이상 3천만)", noteType: "계산식" },
        { noteLabel: "주4", noteText: "파워수술 인별합산 1구좌 가입가능", noteType: "계산식" }
      ],
      insuranceCodeMapping:
        "주보험: LI00111 / 암진단: LI00112 / 소액암진단: LI00113 / 파워수술 1종: LI00115",
      summary: "상품코드 LP040506 / 보험코드 LI00111 외 9건 기준 / 판매일자 2026-04-01"
    } satisfies ParsedProductCandidate;

    const draft = buildDraftWorkbookData({
      fileName: "change-guideline.xlsx",
      rawInput: "소액암진단 단일건 한도를 5000으로 변경",
      answers: {},
      productName: "건강하고 튼튼하게",
      masterProducts: [masterProduct]
    });

    const targetRow = draft.ruleMaster.find((row) => row.특약명 === "소액암진단");
    const siblingRow = draft.ruleMaster.find((row) => row.특약명 === "암진단");
    const unrelatedRow = draft.ruleMaster.find((row) => row.특약명 === "주보험");

    expect(targetRow).toMatchObject({
      "as-is 일반/건강 단일건": "2000",
      "to-be 일반/건강 단일건": "5000",
      "as-is 간편 단일건": "2000",
      "to-be 간편 단일건": "5000"
    });
    expect(siblingRow).toMatchObject({
      "as-is 일반/건강 단일건": "2000",
      "to-be 일반/건강 단일건": "2000",
      "as-is 간편 단일건": "2000",
      "to-be 간편 단일건": "2000"
    });
    expect(unrelatedRow).toMatchObject({
      "as-is 일반/건강 단일건": "1000",
      "to-be 일반/건강 단일건": "1000",
      "as-is 간편 단일건": "1000",
      "to-be 간편 단일건": "1000"
    });
  });

  it("parses Korean unit amounts like 5천 when applying a change request", () => {
    const masterProduct = {
      id: "guide-실버보험-Sheet1-LP030405",
      productCode: "LP030405",
      insuranceCode: "LI00111 외 9건",
      productName: "실버보험",
      saleDate: "2026-05-01",
      sourceFileName: "실버보험 신계약가이드라인.xlsx",
      sheetName: "Sheet1",
      specialItems: [
        { specialName: "주보험", insuranceCode: "LI00111", limitValue: "1000", noteText: "주1" },
        { specialName: "뇌혈관 진단", insuranceCode: "LI10112", limitValue: "1000", noteText: "주2" },
        { specialName: "허혈심사진단", insuranceCode: "LI10113", limitValue: "1000", noteText: "주2,3" }
      ],
      noteEntries: [
        { noteLabel: "주1", noteText: "주보험 가입시 소액암 진단 가입필수", noteType: "본문주석" },
        { noteLabel: "주2", noteText: "뇌혈관 진단 인별합산 한도 2000만 (66세 이상 1천만)", noteType: "계산식" },
        { noteLabel: "주3", noteText: "허혈심장진단 인별합산 한도 2천만 (66세 이상 500만)", noteType: "계산식" }
      ],
      insuranceCodeMapping:
        "주보험: LI00111 / 뇌혈관 진단: LI10112 / 허혈심사진단: LI10113",
      summary: "상품코드 LP030405 / 보험코드 LI00111 외 9건 기준 / 판매일자 2026-05-01"
    } satisfies ParsedProductCandidate;

    const draft = buildDraftWorkbookData({
      fileName: "change-guideline.xlsx",
      rawInput: "뇌혈관진단 5천으로 변경",
      answers: {},
      productName: "실버보험",
      masterProducts: [masterProduct]
    });

    const targetRow = draft.ruleMaster.find((row) => row.특약명 === "뇌혈관 진단");
    const siblingRow = draft.ruleMaster.find((row) => row.특약명 === "허혈심사진단");

    expect(targetRow).toMatchObject({
      "as-is 일반/건강 단일건": "1000",
      "to-be 일반/건강 단일건": "5000",
      "as-is 간편 단일건": "1000",
      "to-be 간편 단일건": "5000"
    });
    expect(siblingRow).toMatchObject({
      "as-is 일반/건강 단일건": "1000",
      "to-be 일반/건강 단일건": "1000",
      "as-is 간편 단일건": "1000",
      "to-be 간편 단일건": "1000"
    });
  });

  it("builds review questions from every note candidate in the uploaded master workbook", async () => {
    const masterProduct = {
      id: "guide-건강하게-신계약가이드라인-xlsx-Sheet1-LP040506",
      productCode: "LP040506",
      insuranceCode: "LI00111 외 9건",
      productName: "건강하고 튼튼하게",
      saleDate: "2026-04-01",
      sourceFileName: "건강하게 신계약가이드라인.xlsx",
      sheetName: "Sheet1",
      specialItems: [
        { specialName: "주보험", insuranceCode: "LI00111", noteText: "주1" },
        { specialName: "암진단", insuranceCode: "LI00112", noteText: "주2" },
        { specialName: "소액암진단", insuranceCode: "LI00113", noteText: "주2,3" },
        { specialName: "파워수술 1종", insuranceCode: "LI00115", noteText: "주4 1종*20배 < 5종가입금액" },
        { specialName: "파워수술 2종", insuranceCode: "LI00116" }
      ],
      noteEntries: [
        { noteLabel: "주1", noteText: "주보험 가입시 소액암 진단 가입필수", noteType: "본문주석" },
        { noteLabel: "주2", noteText: "암진단 및 소액암진단은 동일 기준 적용", noteType: "본문주석" },
        { noteLabel: "주3", noteText: "소액암 진단 인별합산 한도 5천만원 (단, 66세 이상 3천만)", noteType: "계산식" },
        { noteLabel: "주4", noteText: "파워수술 인별합산 1구좌 가입가능", noteType: "계산식" },
        { noteLabel: "주5", noteText: "신입원 특약 위험등급별 한도 : A등급 3만원, B등급 1만원", noteType: "본문주석" },
        { noteLabel: "주6", noteText: "입원 간병인은 타사 가입시 가입불가", noteType: "본문주석" }
      ],
      insuranceCodeMapping:
        "주보험: LI00111 / 암진단: LI00112 / 소액암진단: LI00113 / 파워수술 1종: LI00115 / 파워수술 2종: LI00116",
      summary: "상품코드 LP040506 / 보험코드 LI00111 외 9건 기준 / 판매일자 2026-04-01"
    } satisfies ParsedProductCandidate;
    const memos = buildReviewMemos({
      masterFileNames: ["건강하게 신계약가이드라인.xlsx"],
      changeFileNames: [],
      rawInput: "소액암진단 단일건 한도를 1000에서 2000으로 변경하고 66세 이상 예외는 시행예정으로 둡니다.",
      productName: "건강하고 튼튼하게"
    });

    const questions = buildReviewQuestions(
      {
        masterFileNames: ["건강하게 신계약가이드라인.xlsx"],
        changeFileNames: [],
        rawInput: "소액암진단 단일건 한도를 1000에서 2000으로 변경하고 66세 이상 예외는 시행예정으로 둡니다.",
        productName: "건강하고 튼튼하게",
        masterProducts: [masterProduct]
      },
      memos
    );

    expect(questions).toHaveLength(9);
    expect(questions.map((question) => question.prompt)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("암진단 및 소액암진단은 동일 기준 적용"),
        expect.stringContaining("소액암 진단 인별합산 한도 5천만원"),
        expect.stringContaining("1000 → 2000"),
        expect.stringContaining("시행예정")
      ])
    );
    expect(questions.map((question) => question.prompt)).not.toEqual(
      expect.arrayContaining([expect.stringContaining("뇌혈관 진단")])
    );
  });

  it("asks for confirmation when the requested limit matches the current master value", () => {
    const masterProduct = {
      id: "guide-건강하게-신계약가이드라인-xlsx-Sheet1-LP040506",
      productCode: "LP040506",
      insuranceCode: "LI00113",
      productName: "건강하고 튼튼하게",
      saleDate: "2026-04-01",
      sourceFileName: "건강하게 신계약가이드라인.xlsx",
      sheetName: "Sheet1",
      specialItems: [
        { specialName: "소액암진단", insuranceCode: "LI00113", limitValue: "2000", noteText: "주2" }
      ],
      noteEntries: [
        { noteLabel: "주2", noteText: "소액암 진단 인별합산 한도 5천만원 (단, 66세 이상 3천만)", noteType: "계산식" }
      ],
      insuranceCodeMapping: "소액암진단: LI00113",
      summary: "상품코드 LP040506 / 보험코드 LI00113 기준 / 판매일자 2026-04-01"
    } satisfies ParsedProductCandidate;

    const draft = buildDraftWorkbookData({
      fileName: "건강하게 신계약가이드라인.xlsx",
      rawInput: "소액암진단 단일건 한도를 1000에서 2000으로 변경",
      answers: {},
      uploadedFiles: ["건강하게 신계약가이드라인.xlsx"],
      masterProducts: [masterProduct]
    }, { mode: "change" });

    expect(draft.summary.afterValue).toBe("변경 없음");
    expect(draft.summary.pendingNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("실제 변경 여부를 다시 확인")
      ])
    );

    const memos = buildReviewMemos({
      masterFileNames: ["건강하게 신계약가이드라인.xlsx"],
      changeFileNames: [],
      rawInput: "소액암진단 단일건 한도를 1000에서 2000으로 변경",
      productName: "건강하고 튼튼하게"
    });
    const questionGroups = buildReviewQuestionGroups(
      {
        masterFileNames: ["건강하게 신계약가이드라인.xlsx"],
        changeFileNames: [],
        rawInput: "소액암진단 단일건 한도를 1000에서 2000으로 변경",
        productName: "건강하고 튼튼하게",
        masterProducts: [masterProduct]
      },
      memos
    );

    expect(questionGroups.coreQuestions[1].prompt).toEqual(
      expect.stringContaining("변경이 없는 상태")
    );
  });

  it("keeps identical footnote labels separated by source file so insurance-code mapping does not leak across products", () => {
    const draft = buildDraftWorkbookData({
      fileName: "master-guideline.xlsx",
      rawInput: "파일별 표준화 후 전체 통합본 생성",
      answers: {},
      productName: "건강하고 튼튼하게",
      uploadedFiles: [
        "건강하게 신계약가이드라인.xlsx",
        "실버보험 신계약가이드라인.xlsx"
      ],
      masterProducts: [
        {
          id: "product-a",
          productCode: "LP040506",
          insuranceCode: "LI00111 외 1건",
          productName: "건강하고 튼튼하게",
          saleDate: "2026-04-01",
          sourceFileName: "건강하게 신계약가이드라인.xlsx",
          sheetName: "Sheet1",
          specialItems: [
            { specialName: "암진단", insuranceCode: "LI00112", noteText: "주2" }
          ],
          noteEntries: [
            { noteLabel: "주2", noteText: "암진단 가입시 소액암 진단 가입필수", noteType: "본문주석" }
          ],
          insuranceCodeMapping: "암진단: LI00112",
          summary: "상품코드 LP040506 / 보험코드 LI00112 기준 / 판매일자 2026-04-01"
        } satisfies ParsedProductCandidate,
        {
          id: "product-b",
          productCode: "LP030405",
          insuranceCode: "LI10111 외 1건",
          productName: "실버보험",
          saleDate: "2026-05-01",
          sourceFileName: "실버보험 신계약가이드라인.xlsx",
          sheetName: "Sheet1",
          specialItems: [
            { specialName: "뇌혈관진단", insuranceCode: "LI10112", noteText: "주2" }
          ],
          noteEntries: [
            { noteLabel: "주2", noteText: "뇌혈관 진단 인별합산 한도 2000만 (66세 이상 1천만)", noteType: "계산식" }
          ],
          insuranceCodeMapping: "뇌혈관진단: LI10112",
          summary: "상품코드 LP030405 / 보험코드 LI10112 기준 / 판매일자 2026-05-01"
        } satisfies ParsedProductCandidate
      ]
    });

    expect(draft.noteMaster).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "주석 원문": "암진단 가입시 소액암 진단 가입필수",
          특약명: "암진단",
          보험코드: "LI00112"
        }),
        expect.objectContaining({
          "주석 원문": "뇌혈관 진단 인별합산 한도 2000만 (66세 이상 1천만)",
          특약명: "뇌혈관진단",
          보험코드: "LI10112"
        })
      ])
    );
    expect(draft.ruleNoteMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          특약명: "암진단",
          보험코드: "LI00112",
          비고: "암진단 가입시 소액암 진단 가입필수"
        }),
        expect.objectContaining({
          특약명: "뇌혈관진단",
          보험코드: "LI10112",
          비고: "뇌혈관 진단 인별합산 한도 2000만 (66세 이상 1천만)"
        })
      ])
    );
  });
});
