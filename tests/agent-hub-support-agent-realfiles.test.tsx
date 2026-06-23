import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AgentHubPage from "@/components/agent-hub-page";

describe("Agent hub support agent - embedded reference page", () => {
  it("keeps the support tab focused on the original support-agent-app screen", async () => {
    const user = userEvent.setup();

    render(
      <AgentHubPage
        userSession={{
          employeeId: "28172",
          department: "신계약기획P",
          name: "홍수향",
          loggedInAt: new Date().toISOString()
        }}
      />
    );

    await user.click(screen.getByRole("tab", { name: /지원/i }));

    expect(screen.getByTitle("지원 Agent")).toHaveAttribute("src", "/support-agent-app.html");
    expect(screen.queryByText("가이드라인과 RD 원본파일을 업로드")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "변환하기" })).not.toBeInTheDocument();
  });
});
