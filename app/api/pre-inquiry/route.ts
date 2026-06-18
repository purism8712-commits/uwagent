import { NextResponse } from "next/server";
import {
  answerPreInquiry,
  saveAdoptedInquiry,
  type InquiryAdoptionEntry
} from "@/lib/pre-inquiry";

type InquiryRequest = {
  question?: string;
};

type InquiryAdoptRequest = {
  question?: string;
  answer?: string;
  source?: "bizrouter" | "local";
  evidence?: InquiryAdoptionEntry["evidence"];
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as InquiryRequest;
    const question = payload.question?.trim() ?? "";

    if (!question) {
      return NextResponse.json(
        { ok: false, message: "question is required" },
        { status: 400 }
      );
    }

    const result = await answerPreInquiry(question);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "MASTER_NOT_FOUND" ? 404 : 500;
    const responseMessage =
      message === "MASTER_NOT_FOUND"
        ? "통합 마스터 파일이 아직 저장되지 않았습니다."
        : message === "QUESTION_REQUIRED"
          ? "질문을 입력해 주세요."
          : "사전문의 답변 생성에 실패했습니다.";

    return NextResponse.json({ ok: false, message: responseMessage }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as InquiryAdoptRequest;
    const question = payload.question?.trim() ?? "";
    const answer = payload.answer?.trim() ?? "";
    const source = payload.source === "bizrouter" ? "bizrouter" : "local";
    const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];

    if (!question || !answer) {
      return NextResponse.json(
        { ok: false, message: "question and answer are required" },
        { status: 400 }
      );
    }

    const entry: InquiryAdoptionEntry = {
      id: `PI-${Date.now()}`,
      question,
      answer,
      source,
      evidence,
      adoptedAt: new Date().toISOString()
    };

    await saveAdoptedInquiry(entry);
    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json(
      { ok: false, message: "사전문의 채택 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
