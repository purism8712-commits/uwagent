"use client";

const SUPPORT_AGENT_URL = "/support-agent-app.html";

type SupportAgentFrameProps = {
  src?: string;
  title?: string;
  height?: number;
};

export function SupportAgentFrame({
  src = SUPPORT_AGENT_URL,
  title = "지원 Agent",
  height = 3600
}: SupportAgentFrameProps) {
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
