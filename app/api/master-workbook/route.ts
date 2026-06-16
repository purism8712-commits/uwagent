import { NextResponse } from "next/server";
import { buildDraftWorkbookData } from "@/lib/draft-builder";
import {
  masterWorkbookStore,
  type MasterWorkbookSnapshot
} from "@/lib/master-workbook-store";
import type { ParsedProductCandidate } from "@/lib/product-candidate-parser";

type MasterWorkbookRequest = {
  uploadedFiles?: string[];
  fileName?: string;
  masterProducts?: unknown[];
};

function isParsedProductCandidate(value: unknown): value is ParsedProductCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return typeof (value as ParsedProductCandidate).productName === "string" &&
    typeof (value as ParsedProductCandidate).sourceFileName === "string" &&
    typeof (value as ParsedProductCandidate).sheetName === "string";
}

function normalizeMasterProducts(value: unknown): ParsedProductCandidate[] {
  return Array.isArray(value) ? value.filter(isParsedProductCandidate) : [];
}

export async function POST(request: Request) {
  const payload = (await request.json()) as MasterWorkbookRequest;
  const uploadedFiles = Array.isArray(payload.uploadedFiles)
    ? payload.uploadedFiles.filter((value): value is string => typeof value === "string")
    : [];

  if (uploadedFiles.length === 0) {
    return NextResponse.json(
      { ok: false, message: "uploadedFiles is required" },
      { status: 400 }
    );
  }

  const snapshot: MasterWorkbookSnapshot = {
    uploadedFiles,
    request: {
      fileName: payload.fileName ?? uploadedFiles[0] ?? "",
      rawInput: "",
      answers: {},
      productName: "",
      uploadedFiles,
      masterProducts: normalizeMasterProducts(payload.masterProducts)
    },
    createdAt: new Date().toISOString()
  };

  await masterWorkbookStore.save(snapshot);

  return NextResponse.json({
    ok: true,
    uploadedCount: uploadedFiles.length,
    savedAt: snapshot.createdAt
  });
}

export async function GET() {
  const snapshot = await masterWorkbookStore.load();

  if (!snapshot) {
    return NextResponse.json(
      { ok: false, message: "master workbook not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    snapshot,
    preview: buildDraftWorkbookData(snapshot.request)
  });
}
