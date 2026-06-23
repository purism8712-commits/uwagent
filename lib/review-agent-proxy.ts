const DEFAULT_UPSTREAM_ORIGIN = "https://review-agent-lovat.vercel.app";

function getUpstreamOrigin() {
  return process.env.REVIEW_AGENT_UPSTREAM_ORIGIN?.trim() || DEFAULT_UPSTREAM_ORIGIN;
}

export async function proxyReviewAgentJson(
  pathname: string,
  init: RequestInit & { request?: Request; searchParams?: URLSearchParams } = {}
) {
  const upstreamUrl = new URL(pathname, getUpstreamOrigin());
  if (init.searchParams) {
    init.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.set(key, value);
    });
  }

  const headers = new Headers(init.headers || {});
  headers.delete("host");
  headers.delete("content-length");

  const upstreamResponse = await fetch(upstreamUrl, {
    method: init.method || "GET",
    headers,
    body: init.body,
    redirect: "follow"
  });

  const text = await upstreamResponse.text();
  try {
    const data = text ? JSON.parse(text) : {};
    return Response.json(data, {
      status: upstreamResponse.status,
      headers: {
        "x-review-agent-upstream": upstreamUrl.origin
      }
    });
  } catch {
    return new Response(text, {
      status: upstreamResponse.status,
      headers: {
        "content-type": upstreamResponse.headers.get("content-type") || "text/plain; charset=utf-8",
        "x-review-agent-upstream": upstreamUrl.origin
      }
    });
  }
}
