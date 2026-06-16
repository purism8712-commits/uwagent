export const AUTH_SESSION_KEY = "uwagent-auth-session";
export const LOGIN_ALLOWED_DEPARTMENT = "신계약기획P";
export const SUPPORT_AGENT_DEPARTMENT = "신계약지원P";
export const REVIEW_AGENT_DEPARTMENT = "신계약심사P";

export type AgentScope = "common-core" | "support-agent" | "review-agent";

export type AuthSession = {
  employeeId: string;
  department: string;
  name: string;
  loggedInAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function isLoginAllowedDepartment(department: string) {
  return department === LOGIN_ALLOWED_DEPARTMENT;
}

export function canUseAgentScope(department: string, scope: AgentScope) {
  switch (scope) {
    case "common-core":
      return department === LOGIN_ALLOWED_DEPARTMENT;
    case "support-agent":
      return department === SUPPORT_AGENT_DEPARTMENT;
    case "review-agent":
      return department === REVIEW_AGENT_DEPARTMENT;
    default:
      return false;
  }
}

export function readAuthSession(): AuthSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.employeeId !== "string" ||
      typeof parsed.department !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.loggedInAt !== "string"
    ) {
      return null;
    }

    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_KEY);
}
