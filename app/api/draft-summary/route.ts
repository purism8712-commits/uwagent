import { NextResponse } from "next/server";
import { buildDraftWorkbookData, normalizeDraftRequest } from "@/lib/draft-builder";
import { masterWorkbookStore } from "@/lib/master-workbook-store";

export async function POST(request: Request) {
  const payload = await request.json();
  const normalizedRequest = normalizeDraftRequest(payload);
  const storedSnapshot = await masterWorkbookStore.load();
  const requestWithMasterProducts =
    normalizedRequest.masterProducts.length > 0 || !storedSnapshot?.request.masterProducts?.length
      ? normalizedRequest
      : {
          ...normalizedRequest,
          uploadedFiles:
            normalizedRequest.uploadedFiles.length > 0
              ? normalizedRequest.uploadedFiles
              : storedSnapshot.uploadedFiles,
          masterProducts: storedSnapshot.request.masterProducts
        };

  const { summary } = buildDraftWorkbookData(requestWithMasterProducts, { mode: "change" });

  return NextResponse.json({ summary });
}
