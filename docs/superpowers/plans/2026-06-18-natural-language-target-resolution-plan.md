# Natural Language Target Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자연어 입력에서 정확한 특약명/보험코드 대상만 먼저 찾고, 애매하면 유사 후보 최대 3개만 보여준 뒤 확정된 특약에만 변경을 반영한다.

**Architecture:** 입력 해석은 `lib/change-intent.ts`의 문자열 정규화/매칭 로직을 재사용하고, 후보 생성은 `lib/review-content.ts`에서 분리된 대상 해석 함수로 계산한다. `HomePage`는 선택된 대상 상태를 들고, `ReviewStage`는 후보 창과 핵심 질문 창을 순차적으로 보여 준다.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library

---

### Task 1: Add target-candidate extraction helpers

**Files:**
- Modify: `lib/review-content.ts`
- Modify: `tests/common-core-app.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a regression test that types `소액암진단 단일건 한도를 1000에서 2000으로 변경` after loading the bundled bundled workbook and expects:

```ts
expect(await screen.findByRole("heading", { name: "대상 후보 확인" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "소액암진단 선택" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/common-core-app.test.tsx -t "shows target candidates before core questions"
```

Expected: FAIL because no candidate panel exists yet.

- [ ] **Step 3: Write minimal implementation**

Add a small helper in `lib/review-content.ts` that:

```ts
export type TargetCandidate = {
  id: string;
  productName: string;
  specialName: string;
  insuranceCode: string;
  score: number;
};

export function buildTargetCandidates(context: {
  rawInput: string;
  masterProducts: ParsedProductCandidate[];
}): TargetCandidate[] {
  // 1) exact match on insuranceCode
  // 2) exact match on specialName/productName
  // 3) fuzzy match using normalizeSearchText / matchesDelimitedTerm
  // keep top 3 only, dedupe by productName + specialName + insuranceCode
}
```

Return exact matches first, then fuzzy candidates, always capped at 3.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/common-core-app.test.tsx -t "shows target candidates before core questions"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/common-core-app.test.tsx lib/review-content.ts
git commit -m "feat: add natural language target candidate ranking"
```

### Task 2: Gate review questions behind target selection

**Files:**
- Modify: `components/home-page.tsx`
- Modify: `components/review-stage.tsx`
- Modify: `tests/common-core-app.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a regression test that ensures:

1. the candidate panel appears after `입력완료`
2. clicking a candidate reveals the core question dialog
3. the dialog stays open after filling the last answer until `핵심 확인 완료` is clicked

Suggested assertions:

```ts
await user.click(screen.getByRole("button", { name: "소액암진단 선택" }));
expect(await screen.findByRole("dialog", { name: "핵심 확인 질문" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "핵심 확인 완료" })).toBeEnabled();
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/common-core-app.test.tsx -t "keeps the core question window open until the user clicks the completion button"
```

Expected: FAIL until `selectedTargetCandidate` is threaded through the UI.

- [ ] **Step 3: Write minimal implementation**

In `components/home-page.tsx`, add:

```ts
const [selectedTargetCandidate, setSelectedTargetCandidate] = useState<ParsedProductCandidate | null>(null);
```

Reset it when raw input or uploaded master files change:

```ts
setSelectedTargetCandidate(null);
```

Pass it to `ReviewStage`.

In `components/review-stage.tsx`, render a compact candidate panel when no target is selected:

```tsx
{targetCandidates.length > 0 && !selectedTargetCandidate ? (
  <section aria-label="대상 후보 확인">
    {targetCandidates.slice(0, 3).map((candidate) => (
      <button key={candidate.id} type="button" onClick={() => onTargetSelect(candidate)}>
        {candidate.specialName} 선택
      </button>
    ))}
  </section>
) : null}
```

Only build core questions after `selectedTargetCandidate` exists.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/common-core-app.test.tsx -t "keeps the core question window open until the user clicks the completion button"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/home-page.tsx components/review-stage.tsx tests/common-core-app.test.tsx
git commit -m "feat: require target selection before core questions"
```

### Task 3: Keep draft generation bound to the selected target

**Files:**
- Modify: `lib/draft-builder.ts`
- Modify: `components/home-page.tsx`
- Modify: `tests/common-core-app.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a regression test that confirms the final summary target matches the selected candidate rather than the first matching item in the workbook.

Expected assertion:

```ts
expect(await screen.findByText("소액암진단")).toBeInTheDocument();
expect(screen.queryByText("암진단")).not.toBeVisible();
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/common-core-app.test.tsx -t "shows final summary and enables excel download after confirming the draft"
```

Expected: FAIL if the draft builder still uses a broader match.

- [ ] **Step 3: Write minimal implementation**

Extend the draft request with the selected target:

```ts
type DraftRequest = {
  // existing fields...
  selectedTarget?: {
    productName: string;
    specialName: string;
    insuranceCode: string;
  } | null;
};
```

Use that object in `buildDraftWorkbookData` so `target`, `beforeValue`, and `afterValue` are read from the chosen 특약 only.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/draft-builder.ts components/home-page.tsx tests/common-core-app.test.tsx
git commit -m "feat: bind draft generation to selected target"
```

### Task 4: Final verification

**Files:**
- Modify: none

- [ ] **Step 1: Run the full focused test suite**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: all tests pass.

- [ ] **Step 2: Verify the local flow in the browser**

Open `http://127.0.0.1:3000/`, upload the bundled guideline workbook, enter a natural-language change, confirm the target candidate, and verify that:

1. only the selected 특약 is highlighted
2. core questions appear after selection
3. the dialog stays open until the completion button is clicked
4. step 4 summary uses the selected target

- [ ] **Step 3: Commit verification fixes if any**

```bash
git add -A
git commit -m "test: verify natural language target resolution flow"
```

