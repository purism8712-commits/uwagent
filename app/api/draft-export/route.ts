import { NextResponse } from "next/server";
import { buildDraftWorkbookBuffer } from "@/lib/draft-export";
import { masterWorkbookStore } from "@/lib/master-workbook-store";

function parseFileList(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function uniqueFiles(fileNames: string[]) {
  return Array.from(new Set(fileNames.map((item) => item.trim()).filter(Boolean)));
}

function parseMasterProducts(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function createWorkbookResponse(
  payload: unknown,
  options?: { downloadName?: string; metaSheet?: Record<string, string>[] }
) {
  const baselineSnapshot = await masterWorkbookStore.load();
  const { buffer, downloadName } = await buildDraftWorkbookBuffer(payload, {
    ...options,
    baselineRequest: baselineSnapshot?.request ?? null
  });
  const safeAsciiName = downloadName
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/["\\]/g, "_") || "download.xlsx";
  const encodedFileName = encodeURIComponent(downloadName);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedFileName}`
    }
  });
}

export async function POST(request: Request) {
  const payload = await request.json();
  return createWorkbookResponse(payload);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exportMode = searchParams.get("exportMode") ?? "master";
  const productName = searchParams.get("productName") ?? "";
  const uploadedFiles = parseFileList(searchParams.get("uploadedFiles"));
  const masterFiles = parseFileList(searchParams.get("masterFiles"));
  const masterProducts = parseMasterProducts(searchParams.get("masterProducts"));
  const combinedFiles = uniqueFiles([...masterFiles, ...uploadedFiles]);
  const baselineSnapshot = await masterWorkbookStore.load();

  let answers: Record<string, string> = {};
  const answersParam = searchParams.get("answers");

  if (answersParam) {
    try {
      const parsed = JSON.parse(answersParam) as Record<string, string>;
      if (parsed && typeof parsed === "object") {
        answers = parsed;
      }
    } catch {
      answers = {};
    }
  }

  const downloadName =
    exportMode === "product" && productName
      ? `${productName}-extract-preview.xlsx`
      : "integrated-master-preview.xlsx";

  return createWorkbookResponse(
    {
      fileName: searchParams.get("fileName") ?? "",
      rawInput: searchParams.get("rawInput") ?? "",
      answers,
      productName,
      uploadedFiles: combinedFiles,
      masterProducts
    },
    {
      downloadName,
      metaSheet: [
        {
          exportMode,
          productName: productName || "전체 상품",
          masterFiles: masterFiles.join(" | "),
          uploadedFiles: combinedFiles.join(" | "),
          baselineLoaded: baselineSnapshot ? "Y" : "N"
        }
      ]
    }
  );
}
