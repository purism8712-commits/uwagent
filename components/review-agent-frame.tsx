"use client";

const LOCAL_REVIEW_AGENT_URL = "/review-agent/index.html";

type ReviewAgentFrameProps = {
  src?: string;
  title?: string;
  height?: number;
};

export function ReviewAgentFrame({
  src = LOCAL_REVIEW_AGENT_URL,
  title = "심사 Agent",
  height = 3600
}: ReviewAgentFrameProps) {
  return (
    <iframe
      src={src}
      title={title}
      style={{
        width: "100%",
        height: `${height}px`,
        border: "0",
        display: "block",
        background: "transparent",
        borderRadius: "24px"
      }}
    />
  );
}
