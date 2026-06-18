import ExcelJS from "exceljs";
import {
  buildDraftWorkbookData,
  normalizeDraftRequest,
  type DraftRequest,
  type DraftWorkbookData
} from "@/lib/draft-builder";

type DraftExportOptions = {
  downloadName?: string;
  metaSheet?: Record<string, string>[];
  baselineRequest?: DraftRequest | null;
};

type WorksheetData = Record<string, string | number | undefined>[];

type CellAddress = {
  row: number;
  col: number;
};

function collectColumns(rows: WorksheetData) {
  const columns: string[] = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    }
  }

  return columns;
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function createCellKey(rowIndex: number, colIndex: number) {
  return `${rowIndex}:${colIndex}`;
}

function gatherChangedCells(
  currentRows: WorksheetData,
  baselineRows: WorksheetData
): CellAddress[] {
  const changed: CellAddress[] = [];
  const columns = collectColumns(currentRows);
  const baselineColumns = collectColumns(baselineRows);
  const allColumns = [...columns];

  for (const column of baselineColumns) {
    if (!allColumns.includes(column)) {
      allColumns.push(column);
    }
  }

  const rowCount = Math.max(currentRows.length, baselineRows.length);

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let colIndex = 0; colIndex < allColumns.length; colIndex += 1) {
      const key = allColumns[colIndex];
      const currentValue = normalizeCellValue(currentRows[rowIndex]?.[key]);
      const baselineValue = normalizeCellValue(baselineRows[rowIndex]?.[key]);

      if (currentValue !== baselineValue) {
        changed.push({ row: rowIndex + 2, col: colIndex + 1 });
      }
    }
  }

  return changed;
}

function writeWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: WorksheetData,
  baselineRows?: WorksheetData | null
) {
  const worksheet = workbook.addWorksheet(sheetName);
  const columns = collectColumns(rows);
  const allColumns = [...columns];

  for (const baselineColumn of collectColumns(baselineRows ?? [])) {
    if (!allColumns.includes(baselineColumn)) {
      allColumns.push(baselineColumn);
    }
  }

  if (allColumns.length === 0) {
    allColumns.push("값");
  }

  worksheet.columns = allColumns.map((column) => ({
    header: column,
    key: column,
    width: Math.max(14, Math.min(32, column.length + 4))
  }));

  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF203A7A" }
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB7C6E3" } },
      left: { style: "thin", color: { argb: "FFB7C6E3" } },
      bottom: { style: "thin", color: { argb: "FFB7C6E3" } },
      right: { style: "thin", color: { argb: "FFB7C6E3" } }
    };
  });

  const changedCellKeys = new Set(
    baselineRows ? gatherChangedCells(rows, baselineRows).map(({ row, col }) => createCellKey(row, col)) : []
  );

  rows.forEach((row, rowIndex) => {
    const worksheetRow = worksheet.addRow(allColumns.map((column) => row[column] ?? ""));

    worksheetRow.eachCell((cell, colNumber) => {
      const isChanged = changedCellKeys.has(createCellKey(rowIndex + 2, colNumber));
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } }
      };

      if (isChanged) {
        cell.font = { color: { argb: "FFB42318" }, bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFF4CC" }
        };
      }
    });
  });
}

function buildWorkbookRows(data: DraftWorkbookData) {
  return {
    overview: data.overview,
    ruleMaster: data.ruleMaster,
    noteMaster: data.noteMaster,
    ruleNoteMap: data.ruleNoteMap,
    changeLog: data.changeLog
  };
}

export async function buildDraftWorkbookBuffer(
  payload: unknown,
  options?: DraftExportOptions
) {
  const currentRequest = normalizeDraftRequest(payload);
  const baselineRequest = options?.baselineRequest ?? null;
  const currentDraft = buildDraftWorkbookData(currentRequest);
  const baselineDraft = baselineRequest
    ? buildDraftWorkbookData(baselineRequest)
    : currentDraft;
  const currentRows = buildWorkbookRows(currentDraft);
  const baselineRows = buildWorkbookRows(baselineDraft);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "uwagent";
  workbook.created = new Date();
  workbook.modified = new Date();

  writeWorksheet(workbook, "Overview", currentRows.overview, baselineRows.overview);
  writeWorksheet(workbook, "Rule Master", currentRows.ruleMaster, baselineRows.ruleMaster);
  writeWorksheet(workbook, "Note Master", currentRows.noteMaster, baselineRows.noteMaster);
  writeWorksheet(
    workbook,
    "Rule-Note Map",
    currentRows.ruleNoteMap,
    baselineRows.ruleNoteMap
  );
  writeWorksheet(workbook, "Change Log", currentRows.changeLog, baselineRows.changeLog);

  if (options?.metaSheet && options.metaSheet.length > 0) {
    writeWorksheet(workbook, "Request Meta", options.metaSheet, null);
  }

  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    downloadName: options?.downloadName ?? "common-core-draft.xlsx"
  };
}
