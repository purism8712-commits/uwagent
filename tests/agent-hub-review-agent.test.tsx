import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentHubPage from "@/components/agent-hub-page";

describe("Agent hub review agent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the local review-agent frame in the review tab", async () => {
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

    await user.click(screen.getByRole("tab", { name: /심사/i }));

    const frame = screen.getByTitle("심사 Agent");
    expect(frame).toHaveAttribute("src", "/review-agent/index.html");
  });
});
