import { NextRequest } from "next/server";
import { proxyReviewAgentJson } from "@/lib/review-agent-proxy";

export async function POST(request: NextRequest) {
  const body = await request.arrayBuffer();
  return proxyReviewAgentJson("/api/answer", {
    method: "POST",
    headers: request.headers,
    body
  });
}
