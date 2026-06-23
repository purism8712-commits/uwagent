import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "@/components/home-page";
import AgentHubGate from "@/components/agent-hub-gate";
import LoginPage from "@/components/login-page";
import PreviewGate from "@/components/preview-gate";
import { AUTH_SESSION_KEY, readAuthSession, writeAuthSession } from "@/lib/session";

const routerReplaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock
  })
}));

describe("Login flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    routerReplaceMock.mockReset();
  });

  it("allows login for any department and stores the session before redirecting", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("사번"), "12345");
    await user.selectOptions(screen.getByLabelText("부서"), "신계약지원P");
    await user.type(screen.getByLabelText("이름"), "홍길동");
    const loginButton = screen.getByRole("button", { name: "로그인" });
    await waitFor(() => expect(loginButton).toBeEnabled());
    await user.click(loginButton);

    expect(routerReplaceMock).toHaveBeenCalledWith("/agent-tabs");
    expect(window.localStorage.getItem(AUTH_SESSION_KEY)).toContain("12345");
    expect(window.localStorage.getItem(AUTH_SESSION_KEY)).toContain("신계약지원P");
  });

  it("keeps common-core action buttons disabled for support users while showing the content", () => {
    render(
      <HomePage
        userSession={{
          employeeId: "12345",
          department: "신계약지원P",
          name: "홍길동",
          loggedInAt: new Date().toISOString()
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "신계약 인수기준 반영 Agent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체 통합 마스터 파일 만들기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "미리보기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "입력완료" })).toBeDisabled();
  });

  it("redirects unauthenticated users away from the preview screen", async () => {
    render(<PreviewGate />);

    await waitFor(() => expect(routerReplaceMock).toHaveBeenCalledWith("/"));
  });

  it("redirects unauthenticated users away from the agent-tabs screen", async () => {
    render(<AgentHubGate />);

    await waitFor(() => expect(routerReplaceMock).toHaveBeenCalledWith("/"));
  });

  it("falls back to window.name when localStorage writes are blocked", () => {
    const session = {
      employeeId: "12345",
      department: "신계약기획P",
      name: "홍길동",
      loggedInAt: new Date().toISOString()
    };
    const originalName = window.name;
    const setItemSpy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    try {
      writeAuthSession(session);

      expect(readAuthSession()).toEqual(session);
    } finally {
      setItemSpy.mockRestore();
      window.name = originalName;
    }
  });
});
