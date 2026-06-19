import * as XLSX from "xlsx";

export type ReviewDraftFaq = {
  id: string;
  question: string;
  answer: string;
};

export type ReviewWorkbookDraft = {
  fileName: string;
  sheetCount: number;
  hasRequiredSheets: boolean;
  uploadStatusText: string;
  noticeTitle: string;
  oneLineSummary: string;
  majorChanges: string;
  cautions: string;
  effectiveDate: string;
  owner: string;
  faqs: ReviewDraftFaq[];
};

type TableRecord = Record<string, string>;

const REQUIRED_SHEETS = ["Rule Master", "Note Master", "Rule-Note Map", "Change Log"] as const;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function toRows(worksheet: XLSX.WorkSheet | undefined) {
  if (!worksheet) {
    return [] as string[][];
  }

  return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    raw: false
  }).map((row) => row.map((cell) => normalizeText(cell)));
}

function rowsToRecords(rows: string[][]) {
  const meaningfulRows = rows.filter((row) => row.some((cell) => normalizeText(cell)));
  if (meaningfulRows.length === 0) {
    return [] as TableRecord[];
  }

  const [headerRow, ...bodyRows] = meaningfulRows;
  const headers = headerRow.map((cell) => normalizeText(cell));

  return bodyRows
    .map((row) =>
      headers.reduce<TableRecord>((record, header, index) => {
        if (header) {
          record[header] = normalizeText(row[index]);
        }
        return record;
      }, {})
    )
    .filter((record) => Object.values(record).some(Boolean));
}

function overviewMap(rows: string[][]) {
  return rows.slice(1).reduce<Record<string, string>>((acc, row) => {
    const key = normalizeText(row[0]);
    const value = normalizeText(row[1]);
    if (key) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function splitNoteIds(value: string) {
  return value
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function buildChangedFields(rule: TableRecord) {
  return Object.keys(rule)
    .filter((key) => key.startsWith("as-is "))
    .flatMap((asIsKey) => {
      const label = asIsKey.replace(/^as-is\s+/u, "");
      const toBeKey = `to-be ${label}`;
      if (!(toBeKey in rule)) {
        return [];
      }

      const asIsValue = normalizeText(rule[asIsKey]);
      const toBeValue = normalizeText(rule[toBeKey]);

      if (!toBeValue || asIsValue === toBeValue) {
        return [];
      }

      return [{ label, asIsValue, toBeValue }];
    });
}

async function readWorkbookBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") {
    try {
      return await file.arrayBuffer();
    } catch {
      // JSDOM or older browser shims may expose arrayBuffer but fail at runtime.
    }
  }

  if (typeof FileReader !== "undefined") {
    try {
      return await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error("파일 버퍼를 읽지 못했습니다."));
        reader.readAsArrayBuffer(file);
      });
    } catch {
      // Keep falling back for environments where FileReader is partially shimmed.
    }
  }

  return new Response(file).arrayBuffer();
}

export async function buildReviewDraftFromFile(file: File): Promise<ReviewWorkbookDraft> {
  const workbook = XLSX.read(await readWorkbookBuffer(file), { type: "array" });
  const sheetNames = workbook.SheetNames;
  const hasRequiredSheets = REQUIRED_SHEETS.every((sheetName) => sheetNames.includes(sheetName));

  const overview = overviewMap(toRows(workbook.Sheets["Overview"]));
  const ruleMaster = rowsToRecords(toRows(workbook.Sheets["Rule Master"]));
  const noteMaster = rowsToRecords(toRows(workbook.Sheets["Note Master"]));
  const changeLog = rowsToRecords(toRows(workbook.Sheets["Change Log"]));

  const noteTextById = new Map(
    noteMaster.map((note) => [normalizeText(note["Note ID"]), normalizeText(note["주석 원문"])])
  );

  const changedRules = ruleMaster
    .map((rule) => ({
      rule,
      changedFields: buildChangedFields(rule)
    }))
    .filter((item) => item.changedFields.length > 0);

  const productName =
    overview["상품명"] || normalizeText(ruleMaster[0]?.["상품명"]) || file.name.replace(/\.[^.]+$/u, "");

  const saleDate = overview["판매일자"] || normalizeText(ruleMaster[0]?.["판매일자"]);

  const majorChanges = changedRules.length
    ? changedRules
        .flatMap(({ rule, changedFields }) =>
          changedFields.map(
            ({ label, asIsValue, toBeValue }) =>
              `${normalizeText(rule["특약명"])}(${normalizeText(rule["보험코드"])}) ${label} ${asIsValue} → ${toBeValue}`
          )
        )
        .join("\n")
    : "변경값이 확인되지 않아 현행 유지로 보입니다.";

  const cautionCandidates = Array.from(
    new Set(
      changedRules.flatMap(({ rule }) =>
        splitNoteIds(normalizeText(rule["주석ID"]))
          .map((noteId) => noteTextById.get(noteId) ?? "")
          .filter(Boolean)
      )
    )
  );

  const changeLogReasons = changeLog
    .map((row) => normalizeText(row["사유"]))
    .filter(Boolean);

  const cautions = Array.from(new Set([...cautionCandidates, ...changeLogReasons]))
    .slice(0, 4)
    .join("\n");

  const changedSpecialNames = Array.from(
    new Set(changedRules.map(({ rule }) => normalizeText(rule["특약명"])).filter(Boolean))
  );

  const changeCount = changedRules.length;
  const faqs: ReviewDraftFaq[] = [
    {
      id: "faq-1",
      question: "어떤 특약이 변경되었나요?",
      answer: changedSpecialNames.length > 0 ? changedSpecialNames.join(", ") : "변경된 특약이 확인되지 않았습니다."
    },
    {
      id: "faq-2",
      question: "가장 큰 변경 포인트는 무엇인가요?",
      answer: majorChanges.split("\n")[0] ?? "변경 포인트를 추가 확인해 주세요."
    },
    {
      id: "faq-3",
      question: "연결된 주석이나 검토사항이 있나요?",
      answer: cautions.split("\n")[0] ?? "추가 검토사항은 없습니다."
    }
  ];

  return {
    fileName: file.name,
    sheetCount: sheetNames.length,
    hasRequiredSheets,
    uploadStatusText: `시트 ${sheetNames.length}개 인식 / 필수 시트 ${hasRequiredSheets ? "확인 완료" : "일부 누락"} / ${
      hasRequiredSheets ? "초안 생성 가능" : "추가 확인 필요"
    }`,
    noticeTitle: `${productName} 인수기준 변경 안내`,
    oneLineSummary: `${productName} 상품의 변경 특약 ${changeCount}건을 현장공지 초안으로 정리했습니다.`,
    majorChanges,
    cautions,
    effectiveDate: saleDate,
    owner: "신계약심사P",
    faqs
  };
}
