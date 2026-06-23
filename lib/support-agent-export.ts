import ExcelJS from "exceljs";
import type { ParsedProductCandidate } from "@/lib/product-candidate-parser";

type SupportWorkbookExportInput = {
  guidelineFileNames: string[];
  rdFileNames: string[];
  candidates: ParsedProductCandidate[];
};

function toArrayBuffer(buffer: unknown) {
  if (buffer instanceof ArrayBuffer) {
    return buffer;
  }

  if (typeof buffer === "object" && buffer !== null && ArrayBuffer.isView(buffer)) {
    const view = buffer as ArrayBufferView;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }

  throw new TypeError("지원 워크북 버퍼를 ArrayBuffer로 변환할 수 없습니다.");
}

export async function buildSupportWorkbookBuffer({
  guidelineFileNames,
  rdFileNames,
  candidates
}: SupportWorkbookExportInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "uwagent";
  workbook.created = new Date();

  const overview = workbook.addWorksheet("Overview");
  overview.columns = [
    { header: "항목", key: "item", width: 24 },
    { header: "값", key: "value", width: 96 }
  ];
  overview.addRow({ item: "가이드라인 파일 수", value: guidelineFileNames.length || 0 });
  overview.addRow({ item: "RD 파일 수", value: rdFileNames.length || 0 });
  overview.addRow({ item: "추출 후보 수", value: candidates.length });
  overview.addRow({ item: "가이드라인 파일명", value: guidelineFileNames.join(", ") || "미입력" });
  overview.addRow({ item: "RD 파일명", value: rdFileNames.join(", ") || "미입력" });

  const productSheet = workbook.addWorksheet("지원 상품 목록");
  productSheet.columns = [
    { header: "상품명", key: "productName", width: 22 },
    { header: "상품코드", key: "productCode", width: 18 },
    { header: "보험코드", key: "insuranceCode", width: 18 },
    { header: "판매일자", key: "saleDate", width: 14 },
    { header: "원본파일", key: "sourceFileName", width: 28 },
    { header: "시트명", key: "sheetName", width: 18 },
    { header: "요약", key: "summary", width: 64 }
  ];

  candidates.forEach((candidate) => {
    productSheet.addRow({
      productName: candidate.productName,
      productCode: candidate.productCode ?? "",
      insuranceCode: candidate.insuranceCode ?? "",
      saleDate: candidate.saleDate,
      sourceFileName: candidate.sourceFileName,
      sheetName: candidate.sheetName,
      summary: candidate.summary
    });
  });

  const specialSheet = workbook.addWorksheet("특약 상세");
  specialSheet.columns = [
    { header: "상품명", key: "productName", width: 22 },
    { header: "특약명", key: "specialName", width: 24 },
    { header: "보험코드", key: "insuranceCode", width: 18 },
    { header: "가입한도", key: "limitValue", width: 18 },
    { header: "주석", key: "noteText", width: 42 },
    { header: "원본파일", key: "sourceFileName", width: 28 }
  ];

  candidates.forEach((candidate) => {
    for (const item of candidate.specialItems ?? []) {
      specialSheet.addRow({
        productName: candidate.productName,
        specialName: item.specialName,
        insuranceCode: item.insuranceCode,
        limitValue: item.limitValue ?? "",
        noteText: item.noteText ?? "",
        sourceFileName: candidate.sourceFileName
      });
    }
  });

  const noteSheet = workbook.addWorksheet("주석 상세");
  noteSheet.columns = [
    { header: "상품명", key: "productName", width: 22 },
    { header: "주석명", key: "noteLabel", width: 18 },
    { header: "주석 원문", key: "noteText", width: 72 },
    { header: "주석유형", key: "noteType", width: 14 },
    { header: "보험코드", key: "insuranceCode", width: 18 },
    { header: "원본파일", key: "sourceFileName", width: 28 }
  ];

  candidates.forEach((candidate) => {
    for (const note of candidate.noteEntries ?? []) {
      noteSheet.addRow({
        productName: candidate.productName,
        noteLabel: note.noteLabel,
        noteText: note.noteText,
        noteType: note.noteType,
        insuranceCode: note.insuranceCode ?? "",
        sourceFileName: candidate.sourceFileName
      });
    }
  });

  const rawBuffer = await workbook.xlsx.writeBuffer();

  return {
    buffer: toArrayBuffer(rawBuffer),
    fileName: "시스템반영_RD.xlsx"
  };
}
