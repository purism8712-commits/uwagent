import { NextResponse } from "next/server";
import { buildDraftWorkbookData, normalizeDraftRequest } from "@/lib/draft-builder";

export async function POST(request: Request) {
  const payload = await request.json();
  const { summary } = buildDraftWorkbookData(normalizeDraftRequest(payload));

  return NextResponse.json({ summary });
}
