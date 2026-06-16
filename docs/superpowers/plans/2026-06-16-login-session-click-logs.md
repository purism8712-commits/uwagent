# Login + Session Click Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a login screen at `/` that gates access to the current agent UI at `/preview`, while recording per-employee click logs into a dedicated server-side folder.

**Architecture:** Keep the current agent UI intact and treat it as the authenticated workspace. Introduce a lightweight client session persisted in `localStorage` for the browser flow, plus a tiny server-side log append API keyed by `employeeId`. Route `/` to a new login form, redirect successful logins to `/preview`, and wrap existing button/interactions with a logging helper that writes JSONL entries under `data/logs/<사번>/`.

**Tech Stack:** Next.js App Router, React, TypeScript, server route handlers, `localStorage`, Node `fs/promises`, existing CSS modules.

---

### Task 1: Add session and login plumbing

**Files:**
- Create: `lib/session.ts`
- Modify: `app/page.tsx`
- Modify: `components/home-page.tsx` if needed for redirect checks
- Test: `tests/login-session.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("redirects to preview after a valid login and keeps the session", async () => {
  // render login, fill employee id / department / name, submit
  // expect preview route content to appear
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/login-session.test.tsx`
Expected: fail because login/session helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type AgentSession = {
  employeeId: string;
  department: "신계약기획P" | "신계약지원P" | "신계약심사P";
  name: string;
};

export const sessionStorageKey = "uwagent.session";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/login-session.test.tsx`
Expected: PASS.

### Task 2: Build the login screen at `/`

**Files:**
- Create: `components/login-page.tsx`
- Modify: `app/page.tsx`
- Modify: `components/components.module.css`
- Test: `tests/login-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("renders the login form with employee id, department dropdown, and name", () => {
  // expect heading "신계약 인수기준 반영 Agent 로그인"
  // expect textboxes for 사번 and 이름
  // expect select for 부서 with the 3 department options
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/login-page.test.tsx`
Expected: fail because the page does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
<form>
  <input aria-label="사번" />
  <select aria-label="부서">
    <option>신계약기획P</option>
    <option>신계약지원P</option>
    <option>신계약심사P</option>
  </select>
  <input aria-label="이름" />
  <button type="submit">로그인</button>
</form>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/login-page.test.tsx`
Expected: PASS.

### Task 3: Add server-side click logging by employee id

**Files:**
- Create: `app/api/click-log/route.ts`
- Create: `lib/click-log-store.ts`
- Modify: `components/home-page.tsx`
- Modify: `components/input-stage.tsx`
- Modify: `components/review-stage.tsx`
- Test: `tests/click-log.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("appends a click log entry under the employee folder", async () => {
  // POST /api/click-log with employeeId and action
  // expect data/logs/<employeeId>/YYYY-MM-DD.jsonl to be written
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/click-log.test.ts`
Expected: fail because the API/store do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
type ClickLogEntry = {
  employeeId: string;
  department: string;
  name: string;
  action: string;
  target: string;
  createdAt: string;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/click-log.test.ts`
Expected: PASS.

### Task 4: Guard `/preview` behind the session and wire click logging

**Files:**
- Modify: `app/preview/page.tsx`
- Modify: `components/home-page.tsx`
- Modify: `components/step-progress-bar.tsx` if needed for auth state
- Test: `tests/route-guard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("shows login when there is no session and preview when session exists", async () => {
  // without localStorage session, app "/" shows login
  // after session set, /preview renders the agent UI
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/route-guard.test.tsx`
Expected: fail because route guard logic is missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
if (!session) {
  return <LoginPage onSuccess={setSession} />;
}

return <HomePage session={session} onLogClick={appendClickLog} />;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/route-guard.test.tsx`
Expected: PASS.

### Task 5: Verify the full flow

**Files:**
- Modify: any touched files only if test feedback requires it
- Test: `tests/common-core-app.test.tsx`, `tests/login-session.test.tsx`, `tests/click-log.test.ts`, `tests/route-guard.test.tsx`

- [ ] **Step 1: Run the full focused test set**

Run: `npm test -- tests/common-core-app.test.tsx tests/login-session.test.tsx tests/click-log.test.ts tests/route-guard.test.tsx`

- [ ] **Step 2: Verify the visual flow**

Run the dev server and confirm:
1. `/` shows login.
2. Submit valid employee info.
3. `/preview` opens the existing agent UI.
4. Clicking major buttons creates log rows under `data/logs/<사번>/`.

- [ ] **Step 3: Commit**

```bash
git add app components lib tests docs/superpowers/plans/2026-06-16-login-session-click-logs.md
git commit -m "feat: add login gate and employee click logging"
```
