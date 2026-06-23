import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AgentHubPage from "@/components/agent-hub-page";

describe("Agent hub support agent", () => {
  it("shows the embedded support-agent-app screen inside the support tab", async () => {
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

    const frame = await screen.findByTitle("지원 Agent");
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute("src", "/support-agent-app.html");
  });
});
