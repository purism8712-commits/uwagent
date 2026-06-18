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

type WindowNameSessionState = {
  [AUTH_SESSION_KEY]?: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function canUseWindowName() {
  return typeof window !== "undefined" && typeof window.name === "string";
}

function parseWindowNameSessionState(): WindowNameSessionState {
  if (!canUseWindowName()) {
    return {};
  }

  try {
    const parsed = JSON.parse(window.name) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as WindowNameSessionState;
    }
  } catch {
    // fall through to empty state
  }

  return {};
}

function readWindowNameSession(): string | null {
  const state = parseWindowNameSessionState();
  const raw = state[AUTH_SESSION_KEY];
  return typeof raw === "string" && raw.trim() ? raw : null;
}

function writeWindowNameSession(raw: string) {
  if (!canUseWindowName()) {
    return;
  }

  const state = parseWindowNameSessionState();
  state[AUTH_SESSION_KEY] = raw;
  window.name = JSON.stringify(state);
}

function clearWindowNameSession() {
  if (!canUseWindowName()) {
    return;
  }

  const state = parseWindowNameSessionState();
  if (AUTH_SESSION_KEY in state) {
    delete state[AUTH_SESSION_KEY];
  }

  window.name = JSON.stringify(state);
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
    const fallbackRaw = readWindowNameSession();
    if (!fallbackRaw) {
      return null;
    }

    try {
      const parsed = JSON.parse(fallbackRaw) as Partial<AuthSession>;
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

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (raw) {
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

  const fallbackRaw = readWindowNameSession();
  if (!fallbackRaw) {
    return null;
  }

  try {
    const parsed = JSON.parse(fallbackRaw) as Partial<AuthSession>;
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
  const serialized = JSON.stringify(session);

  if (canUseStorage()) {
    try {
      window.localStorage.setItem(AUTH_SESSION_KEY, serialized);
      return;
    } catch {
      // fall back to window.name
    }
  }

  writeWindowNameSession(serialized);
}

export function clearAuthSession() {
  if (canUseStorage()) {
    try {
      window.localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // fall back to clearing window.name
    }
  }

  clearWindowNameSession();
}
