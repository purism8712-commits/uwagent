import { NextResponse } from "next/server";
import { buildDraftWorkbookBuffer } from "@/lib/draft-export";
import { masterWorkbookStore } from "@/lib/master-workbook-store";

async function createWorkbookResponse(
  payload: unknown,
  options?: { downloadName?: string; metaSheet?: Record<string, string>[] }
) {
  const baselineSnapshot = await masterWorkbookStore.load();
  const { buffer, downloadName } = await buildDraftWorkbookBuffer(payload, {
    ...options,
    baselineRequest: baselineSnapshot?.request ?? null
  });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="${downloadName}"`
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
  const uploadedFiles = searchParams.get("uploadedFiles") ?? "[]";
  const masterFiles = searchParams.get("masterFiles") ?? "[]";
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
      uploadedFiles: (() => {
        try {
          return JSON.parse(uploadedFiles);
        } catch {
          return [];
        }
      })()
    },
    {
      downloadName,
      metaSheet: [
        {
          exportMode,
          productName: productName || "전체 상품",
          masterFiles,
          uploadedFiles,
          baselineLoaded: baselineSnapshot ? "Y" : "N"
        }
      ]
    }
  );
}
