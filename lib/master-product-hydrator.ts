import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import * as XLSX from "xlsx";
import {
  buildFallbackProductCandidates,
  type ParsedNoteEntry,
  type ParsedProductCandidate,
  type SpecialItemMapping
} from "@/lib/product-candidate-parser";

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function deriveProductLabel(fileName: string) {
  const baseName = stripExtension(fileName).trim();

  if (!baseName) {
    return "";
  }

  return baseName
    .replace(/\s*신계약가이드라인$/i, "")
    .replace(/\s*가이드라인$/i, "")
    .trim();
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

function normalizeCellValue(cell: unknown) {
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

  if (typeof cell === "object" && cell !== null) {
    const value = (cell as { text?: unknown; value?: unknown }).text ?? (cell as { value?: unknown }).value;
    return normalizeText(value);
  }

  return normalizeText(cell);
}

function extractLabeledValue(rows: string[][], label: string) {
  for (const row of rows.slice(0, 6)) {
    const firstCell = normalizeText(row[0]);
    if (!firstCell.includes(label)) {
      continue;
    }

    const [, value = ""] = firstCell.split(":");
    return normalizeText(value);
  }

  return "";
}

function summarizeCodes(codes: string[], fallback = "") {
  const uniqueCodes = Array.from(
    new Set(
      codes
        .map((code) => normalizeText(code))
        .filter((code) => code && code !== "묶음특약")
    )
  );

  if (uniqueCodes.length === 0) {
    return fallback;
  }

  if (uniqueCodes.length === 1) {
    return uniqueCodes[0];
  }

  return `${uniqueCodes[0]} 외 ${uniqueCodes.length - 1}건`;
}

function buildInsuranceMappingText(items: SpecialItemMapping[]) {
  const mappings = items
    .map((item) => {
      const specialName = normalizeText(item.specialName);
      const insuranceCode = normalizeText(item.insuranceCode);

      if (!specialName && !insuranceCode) {
        return "";
      }

      if (!specialName) {
        return insuranceCode;
      }

      if (!insuranceCode) {
        return specialName;
      }

      return `${specialName}: ${insuranceCode}`;
    })
    .filter(Boolean);

  return mappings.join(" / ");
}

function findGuideColumnIndex(headerRow: string[], ...labels: string[]) {
  return headerRow.findIndex((cell) => {
    const normalizedCell = normalizeText(cell);
    return labels.some((label) => normalizedCell.includes(label));
  });
}

function extractFootnoteLabel(text: string) {
  const match = normalizeText(text).match(/^주\s*(\d+)\)?/);
  if (!match) {
    return "";
  }

  return `주${match[1]}`;
}

function extractFootnoteText(text: string) {
  const normalized = normalizeText(text);
  const match = normalized.match(/^주\s*\d+\)?\s*(.*)$/);
  return normalizeText(match?.[1] ?? normalized);
}

function classifyNoteType(text: string): ParsedNoteEntry["noteType"] {
  const normalized = normalizeText(text);

  if (!normalized) {
    return "기타";
  }

  if (normalized.includes("예외") || normalized.includes("유의")) {
    return "예외";
  }

  if (/[<>×x*]/.test(normalized) || normalized.includes("배") || normalized.includes("합산")) {
    return "계산식";
  }

  return "본문주석";
}

function extractFootnoteEntries(rows: string[][], startIndex: number) {
  const entries: ParsedNoteEntry[] = [];
  let currentEntry: ParsedNoteEntry | null = null;

  for (const row of rows.slice(startIndex)) {
    const joinedRow = normalizeText(row.join(" "));
    const firstCell = normalizeText(row[0]);

    if (!joinedRow) {
      currentEntry = null;
      continue;
    }

    const label = extractFootnoteLabel(firstCell || joinedRow);
    if (label) {
      const noteText = extractFootnoteText(joinedRow);
      currentEntry = {
        noteLabel: label,
        noteText,
        noteType: classifyNoteType(noteText)
      };
      entries.push(currentEntry);
      continue;
    }

    if (currentEntry && firstCell === "") {
      currentEntry.noteText = normalizeText(`${currentEntry.noteText} ${joinedRow}`);
      currentEntry.noteType = classifyNoteType(currentEntry.noteText);
    }
  }

  return entries;
}

function isGenericSpecialLabel(value: string) {
  return /^특약\s*\d+$/.test(normalizeText(value));
}

function isBundleMarker(value: string) {
  return normalizeText(value) === "묶음특약";
}

function isBundleChildLabel(value: string) {
  return /^\d+\s*종$/.test(normalizeText(value));
}

function resolveSpecialName(row: string[], fallbackIndex: number) {
  const primary = normalizeText(row[0]);
  const secondary = normalizeText(row[1]);
  const tertiary = normalizeText(row[2]);

  return primary || secondary || tertiary || `특약 ${fallbackIndex + 1}`;
}

function buildCandidateSummary(
  candidate: Pick<ParsedProductCandidate, "productCode" | "insuranceCode" | "saleDate">,
  sheetName: string
) {
  const saleDateText = candidate.saleDate ? `판매일자 ${candidate.saleDate}` : "판매일자 미기재";
  const codeText = candidate.productCode ? `상품코드 ${candidate.productCode}` : sheetName;
  const insuranceText = candidate.insuranceCode ? `보험코드 ${candidate.insuranceCode}` : "";

  return `${codeText}${insuranceText ? ` / ${insuranceText}` : ""} 기준 / ${saleDateText}`;
}

function extractGuideLayoutCandidate(fileName: string, sheetName: string, rows: string[][]) {
  const labeledProductName = extractLabeledValue(rows, "상품명");
  const labeledProductCode = extractLabeledValue(rows, "상품코드");
  const labeledSaleDate = extractLabeledValue(rows, "판매 일자");
  const insuranceHeaderRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeText(cell).includes("보험코드"))
  );

  const hasGuideLayoutSignals =
    Boolean(labeledProductName) ||
    Boolean(labeledProductCode) ||
    Boolean(labeledSaleDate) ||
    insuranceHeaderRowIndex >= 0;

  if (!hasGuideLayoutSignals) {
    return null;
  }

  const productName = labeledProductName || deriveProductLabel(fileName);
  const productCode = labeledProductCode;
  const saleDate = normalizeSaleDate(labeledSaleDate);

  let insuranceCode = "";
  let specialItems: SpecialItemMapping[] = [];
  let noteEntries: ParsedNoteEntry[] = [];
  if (insuranceHeaderRowIndex >= 0) {
    const headerRow = rows[insuranceHeaderRowIndex] ?? [];
    const specialNameColumnIndex = findGuideColumnIndex(headerRow, "특약명", "특약");
    const insuranceCodeColumnIndex = findGuideColumnIndex(headerRow, "보험코드", "보험 코드");
    const noteColumnIndex = findGuideColumnIndex(headerRow, "비고", "주석", "유의");
    const limitColumnIndex = findGuideColumnIndex(headerRow, "가입한도", "한도");

    if (insuranceCodeColumnIndex >= 0) {
      let bundleParentName = "";
      specialItems = rows
        .slice(insuranceHeaderRowIndex + 1)
        .flatMap((row, offset) => {
          const insuranceCode = normalizeText(row[insuranceCodeColumnIndex] ?? "");
          const directRowName =
            specialNameColumnIndex >= 0 ? normalizeText(row[specialNameColumnIndex] ?? "") : "";
          const rowName = directRowName || resolveSpecialName(row, offset);
          const noteText = noteColumnIndex >= 0 ? normalizeText(row[noteColumnIndex] ?? "") : "";
          const limitValue = limitColumnIndex >= 0 ? normalizeText(row[limitColumnIndex] ?? "") : "";

          if (!insuranceCode) {
            return [];
          }

          if (isBundleMarker(insuranceCode)) {
            bundleParentName = rowName;
            return [];
          }

          let specialName = rowName;
          if (bundleParentName) {
            if (isBundleChildLabel(rowName)) {
              specialName = `${bundleParentName} ${rowName}`;
            } else {
              bundleParentName = "";
            }
          }

          return [
            {
              specialName,
              insuranceCode,
              limitValue: limitValue || undefined,
              noteText: noteText || undefined
            }
          ];
        });

      noteEntries = extractFootnoteEntries(rows, insuranceHeaderRowIndex + 1);
      insuranceCode = summarizeCodes(
        specialItems.map((item) => item.insuranceCode),
        ""
      );
    }
  }

  const insuranceCodeMapping = buildInsuranceMappingText(specialItems);

  if (!productName && !productCode && !insuranceCode) {
    return null;
  }

  return {
    id: sanitizeId(`guide-${fileName}-${sheetName}-${productCode || productName}`),
    productCode: productCode || undefined,
    insuranceCode: insuranceCode || undefined,
    productName: productName || deriveProductLabel(fileName),
    saleDate: saleDate || "미기재",
    sourceFileName: fileName,
    sheetName,
    specialItems,
    noteEntries,
    insuranceCodeMapping: insuranceCodeMapping || undefined,
    summary: buildCandidateSummary(
      {
        productCode: productCode || undefined,
        insuranceCode: insuranceCode || undefined,
        saleDate
      },
      sheetName
    )
  } satisfies ParsedProductCandidate;
}

async function readWorkbookRows(filePath: string) {
  const rawBuffer = await readFile(filePath);
  const workbook = XLSX.read(rawBuffer, {
    type: "buffer",
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
      .map((row) => row.map((cell) => normalizeCellValue(cell)));

    return { sheetName, rows };
  });
}

export function hasResolvedMasterProducts(products: ParsedProductCandidate[]) {
  return products.some((product) => {
    const hasMapping = Boolean(product.insuranceCodeMapping?.trim());
    const hasSpecialItems =
      Array.isArray(product.specialItems) &&
      product.specialItems.length > 0 &&
      product.specialItems.every((item) => Boolean(item.insuranceCode.trim())) &&
      product.specialItems.every((item) => Boolean(item.limitValue?.trim()) || Boolean(item.noteText?.trim())) &&
      product.specialItems.every(
        (item) => !isBundleMarker(item.insuranceCode) && !isGenericSpecialLabel(item.specialName)
      );

    return hasMapping && hasSpecialItems;
  });
}

export async function hydrateMasterProductsFromData(fileNames: string[]) {
  const hydratedCandidates: ParsedProductCandidate[] = [];

  for (const fileName of fileNames) {
    const resolvedPath = join(process.cwd(), "data", basename(fileName));
    if (!existsSync(resolvedPath)) {
      continue;
    }

    const worksheets = await readWorkbookRows(resolvedPath);
    for (const { sheetName, rows } of worksheets) {
      const candidate = extractGuideLayoutCandidate(basename(fileName), sheetName, rows);
      if (candidate) {
        hydratedCandidates.push(candidate);
      }
    }
  }

  if (hydratedCandidates.length > 0) {
    return hydratedCandidates;
  }

  return buildFallbackProductCandidates(fileNames);
}
