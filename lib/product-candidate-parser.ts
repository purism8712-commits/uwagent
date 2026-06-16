import * as XLSX from "xlsx";
import type { SampleProductOption } from "@/lib/sample-data";

type ParsedProductCandidate = SampleProductOption & {
  productCode?: string;
};

type ColumnMap = {
  productCode: number;
  productName: number;
  saleDate: number;
};

const PRODUCT_CODE_HEADERS = ["상품코드", "보험코드", "코드", "상품 코드"];
const PRODUCT_NAME_HEADERS = ["상품명", "특약명", "상품명칭", "특약"];
const SALE_DATE_HEADERS = ["판매일자", "판매일", "판매 시작일", "시행일자"];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function sanitizeId(text: string) {
  return text.replace(/[^a-zA-Z0-9가-힣_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function normalizeSaleDate(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  const compact = text.replace(/\s+/g, "");
  const directMatches = [
    /^(\d{4})[.-](\d{1,2})[.-](\d{1,2})$/,
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    /^(\d{4})년(\d{1,2})월(\d{1,2})일$/
  ];

  for (const pattern of directMatches) {
    const match = compact.match(pattern);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  const fallbackMatch = compact.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (fallbackMatch) {
    const [, year, month, day] = fallbackMatch;
    return `${year}-${month}-${day}`;
  }

  return text;
}

function normalizeCellValue(cell: any) {
  if (!cell) {
    return "";
  }

  if (typeof cell === "string" || typeof cell === "number") {
    return normalizeText(cell);
  }

  if (cell instanceof Date) {
    return normalizeSaleDate(
      `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(
        cell.getDate()
      ).padStart(2, "0")}`
    );
  }

  const value = cell.text || cell.value;

  if (value && typeof value === "object" && "result" in value) {
    return normalizeText((value as { result?: unknown }).result);
  }

  return normalizeText(value);
}

function findColumnMap(rows: string[][]): { rowIndex: number; columns: ColumnMap } | null {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const productCodeIndex = row.findIndex((cell) =>
      PRODUCT_CODE_HEADERS.some((header) => cell.includes(header))
    );
    const productNameIndex = row.findIndex((cell) =>
      PRODUCT_NAME_HEADERS.some((header) => cell.includes(header))
    );
    const saleDateIndex = row.findIndex((cell) =>
      SALE_DATE_HEADERS.some((header) => cell.includes(header))
    );

    if (productNameIndex >= 0 && saleDateIndex >= 0) {
      return {
        rowIndex,
        columns: {
          productCode: productCodeIndex,
          productName: productNameIndex,
          saleDate: saleDateIndex
        }
      };
    }
  }

  return null;
}

function dedupeCandidates(candidates: ParsedProductCandidate[]) {
  const seen = new Set<string>();
  const result: ParsedProductCandidate[] = [];

  for (const candidate of candidates) {
    const dedupeKey = [
      candidate.productCode?.trim().toLowerCase() ?? "",
      candidate.productName.trim().toLowerCase(),
      candidate.saleDate.trim()
    ].join("|");

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(candidate);
  }

  return result;
}

function buildCandidateSummary(candidate: ParsedProductCandidate, sheetName: string) {
  const saleDateText = candidate.saleDate ? `판매일자 ${candidate.saleDate}` : "판매일자 미기재";
  const codeText = candidate.productCode ? `상품코드 ${candidate.productCode}` : sheetName;

  return `${codeText} 기준 / ${saleDateText}`;
}

async function readWorkbookRows(file: File) {
  const rawBuffer =
    typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : await new Response(file).arrayBuffer();
  const workbookInput =
    typeof Buffer !== "undefined"
      ? Buffer.from(new Uint8Array(rawBuffer))
      : rawBuffer;
  const workbook = XLSX.read(workbookInput, {
    type: typeof Buffer !== "undefined" ? "buffer" : "array",
    cellDates: true
  });

  return workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: "",
        raw: false
      })
      .map((row) =>
        row.map((cell) => normalizeCellValue(cell))
      );

    return { worksheet: { name: sheetName }, rows };
  });
}

export async function extractProductCandidatesFromFiles(files: File[]) {
  const candidates: ParsedProductCandidate[] = [];

  for (const file of files) {
    const worksheets = await readWorkbookRows(file);

    for (const { worksheet, rows } of worksheets) {
      const headerInfo = findColumnMap(rows);
      if (!headerInfo) {
        continue;
      }

      const { rowIndex, columns } = headerInfo;

      for (let index = rowIndex + 1; index < rows.length; index += 1) {
        const row = rows[index] ?? [];
        if (row.every((cell) => normalizeText(cell) === "")) {
          continue;
        }

        const productCode =
          columns.productCode >= 0 ? normalizeText(row[columns.productCode]) : "";
        const productName = normalizeText(row[columns.productName]) || stripExtension(file.name);
        const saleDate =
          columns.saleDate >= 0 ? normalizeSaleDate(row[columns.saleDate]) : "";

        if (!productName && !productCode) {
          continue;
        }

        candidates.push({
          id: sanitizeId(`${file.name}-${worksheet.name}-${index}-${productCode || productName}`),
          productCode: productCode || undefined,
          productName,
          saleDate: saleDate || "미기재",
          summary: buildCandidateSummary(
            {
              id: "",
              productCode: productCode || undefined,
              productName,
              saleDate: saleDate || ""
            },
            worksheet.name
          )
        });
      }
    }
  }

  return dedupeCandidates(candidates);
}
