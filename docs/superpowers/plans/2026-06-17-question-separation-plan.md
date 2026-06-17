# 질문 분리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 핵심 확인 질문은 실제 변경 결정을 가르는 최소 질문만 남기고, 영향 검토는 별도의 사람 확인 리스트로 분리한다.

**Architecture:** `lib/review-content.ts`에서 질문 생성 책임을 "결정 질문"과 "영향 검토 항목"으로 분리한다. `components/review-stage.tsx`는 두 목록을 서로 다른 카드로 보여 주되, 초안 생성 가능 여부는 핵심 확인 질문 답변만 기준으로 판단한다.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library

---

### Task 1: 질문 생성 로직 분리

**Files:**
- Modify: `lib/review-content.ts`
- Test: `tests/draft-builder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("separates decision questions from broad impact review items", () => {
  const groups = buildReviewQuestionGroups(context, memos);

  expect(groups.coreQuestions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        prompt: expect.stringContaining("어느 특약에만 적용"),
      }),
    ])
  );
  expect(groups.detailQuestions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        prompt: expect.stringContaining("주석 / 예외조건 영향"),
      }),
    ])
  );
  expect(groups.reviewItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: expect.stringContaining("같은 특약이 여러 상품에 걸친 경우"),
      }),
    ])
  );
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:
```bash
npm test -- tests/draft-builder.test.ts -t "separates decision questions from broad impact review items"
```

Expected:
- FAIL because `reviewItems` is not yet returned and the split is not enforced

- [ ] **Step 3: Implement the split**

Implement the following in `lib/review-content.ts`:

```ts
export type ReviewQuestionGroups = {
  coreQuestions: ReviewQuestion[];
  detailQuestions: ReviewQuestion[];
  reviewItems: ReviewReviewItem[];
};
```

Rules:
- `coreQuestions` only contains questions that change the target selection:
  - 대상 특약이 1개인지
  - 특약명 기준인지 보험코드 기준인지
  - 매핑된 전체 보험코드를 전부 반영할지
- `detailQuestions` only contains questions that are needed to complete the draft after the target is fixed
- `reviewItems` contains non-blocking items for humans to inspect:
  - 동일 특약이 여러 상품에 걸친 경우
  - 주석/예외조건이 연결된 경우
  - 값은 같지만 변경 의도로 입력된 경우
  - 보험코드가 여러 개 연결된 경우

- [ ] **Step 4: Run the test to confirm it passes**

Run:
```bash
npm test -- tests/draft-builder.test.ts -t "separates decision questions from broad impact review items"
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add lib/review-content.ts tests/draft-builder.test.ts
git commit -m "feat: separate decision questions from review items"
```

### Task 2: Review stage UI split

**Files:**
- Modify: `components/review-stage.tsx`
- Modify: `components/components.module.css`
- Test: `tests/common-core-app.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it("shows a separate human review list without blocking draft generation", async () => {
  render(<HomePage userSession={authorizedSession} />);
  // build master, answer core questions, and open step 3

  expect(screen.getByText("사람 확인 리스트")).toBeInTheDocument();
  expect(screen.getByText("검토 메모 및 확인질문")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "초안생성" })).toBeEnabled();
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:
```bash
npm test -- tests/common-core-app.test.tsx -t "shows a separate human review list without blocking draft generation"
```

Expected:
- FAIL because the UI still treats broad review content like blocking questions

- [ ] **Step 3: Update the review screen**

Render three sections in `components/review-stage.tsx`:
- `추가 확인 질문`
  - only the core blocking questions
- `사람 확인 리스트`
  - broad impact items, rendered read-only
- `상세 확인 질문`
  - the actual answer-required questions that remain after core confirmation

Keep draft generation gated only by unanswered `coreQuestions` and `detailQuestions`.
Do **not** gate on `reviewItems`.

- [ ] **Step 4: Run the test to confirm it passes**

Run:
```bash
npm test -- tests/common-core-app.test.tsx -t "shows a separate human review list without blocking draft generation"
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add components/review-stage.tsx components/components.module.css tests/common-core-app.test.tsx
git commit -m "feat: split review questions from human review list"
```

### Task 3: End-to-end regression check

**Files:**
- Modify: none
- Test: `tests/common-core-app.test.tsx`

- [ ] **Step 1: Run the full common-core app test file**

Run:
```bash
npm test -- tests/common-core-app.test.tsx
```

Expected:
- PASS

- [ ] **Step 2: Verify the user flow**

Confirm the flow still works:
- STEP 1 master workbook creation
- STEP 2 change input
- STEP 3 core questions first, then detailed questions
- STEP 4 draft summary
- STEP 5 download section

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: verify question split review flow"
```

