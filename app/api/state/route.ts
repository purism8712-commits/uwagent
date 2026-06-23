import { NextRequest } from "next/server";
import { proxyReviewAgentJson } from "@/lib/review-agent-proxy";

export async function GET(request: NextRequest) {
  return proxyReviewAgentJson("/api/state", {
    method: "GET",
    headers: request.headers,
    searchParams: request.nextUrl.searchParams
  });
}

export async function POST(request: NextRequest) {
  const body = await request.arrayBuffer();
  return proxyReviewAgentJson("/api/state", {
    method: "POST",
    headers: request.headers,
    body
  });
}
