# STEP Flow Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the common core app into a single vertical flow where STEP 1 starts with master upload and preview, STEP 2 collects change input, STEP 3 expands review memos and questions after `입력완료`, STEP 4 expands after `초안생성`, and STEP 5 shows the final download actions.

**Architecture:** Keep the existing `HomePage` state as the orchestrator, but switch from a split layout to a stacked step flow. `InputStage` becomes the first two blocks in the sequence, `ReviewStage` becomes a full-width stacked panel for STEP 3, and the final download actions are rendered only after draft confirmation. Preserve the current API contract, workbook generation, and download URLs so the change is limited to presentation and step gating.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Vitest, ExcelJS.

---

### Task 1: Convert the page shell into a vertical step flow

**Files:**
- Modify: `components/home-page.tsx`
- Modify: `components/step-progress-bar.tsx`
- Modify: `components/components.module.css`

- [ ] **Step 1: Write the failing test**

Add a UI test in `tests/common-core-app.test.tsx` that renders the page and asserts the main flow is ordered as `STEP 1`, `STEP 2`, `STEP 3`, with no visible download card before draft confirmation. Example:

```ts
it("renders the first three steps in a vertical flow before draft creation", () => {
  render(<HomePage />);

  expect(screen.getByText("STEP 1")).toBeInTheDocument();
  expect(screen.getByText("STEP 2")).toBeInTheDocument();
  expect(screen.queryByText("STEP 4")).not.toBeInTheDocument();
  expect(screen.queryByText("STEP 5")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: the new expectation fails because the layout still uses the old split flow and does not gate STEP 4 / STEP 5.

- [ ] **Step 3: Write minimal implementation**

Update `components/home-page.tsx` so the page renders the step cards in a stacked order rather than a split right-rail layout. Keep the same state and callbacks, but change the composition to:

```tsx
return (
  <main className={styles.pageShell}>
    <HeroSection />
    <StepProgressBar step={step} />
    <InputStage
      ...
      onComplete={() => setStep("review")}
      onStartDraft={() => setShowDownloadStage(true)}
      isReviewVisible={step === "review"}
      isDownloadVisible={showDownloadStage}
    />
  </main>
);
```

Update `StepProgressBar` to show `STEP 1`, `STEP 2`, `STEP 3`, `STEP 4`, and `STEP 5` labels in order, with the first two visible immediately and the later steps visually disabled until unlocked.

Update the CSS in `components/components.module.css` so the layout is a single vertical column with step cards stacked underneath each other, and the cards expand downward instead of occupying a side column.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: the page renders the first three steps in a vertical sequence and no download card appears before draft confirmation.

- [ ] **Step 5: Commit**

```bash
git add components/home-page.tsx components/step-progress-bar.tsx components/components.module.css tests/common-core-app.test.tsx
git commit -m "feat: switch common core to vertical step flow"
```

### Task 2: Merge STEP 1 and STEP 2 into the first two stacked cards

**Files:**
- Modify: `components/input-stage.tsx`
- Modify: `components/components.module.css`

- [ ] **Step 1: Write the failing test**

Add a test that ensures the master upload / preview area and the change input area both render in the same stacked flow, and that the preview card still exposes the `미리보기` button while the change input card remains below it. Example:

```ts
expect(screen.getByRole("button", { name: "미리보기" })).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "변경내용 입력" })).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "검토메모 및 확인질문" })).not.toBeVisible();
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: the test fails because the current input layout still renders side-by-side sections and the step labels do not match the new sequence.

- [ ] **Step 3: Write minimal implementation**

Refactor `InputStage` so it renders two stacked cards in the same column:

```tsx
<section className={styles.stepStack}>
  <div className={styles.currentGuidelinesCard}>...</div>
  <div className={styles.currentGuidelinesPreviewCard}>...</div>
  <div className={styles.inputPanel}>...</div>
</section>
```

Move the current `STEP 0` wording to `STEP 1` for the master creation card, and make the change input card display `STEP 2`. Keep the preview panel attached to the top card so the user can create and inspect the integrated workbook before moving on.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: the stacked cards render in the intended order and the preview button still works.

- [ ] **Step 5: Commit**

```bash
git add components/input-stage.tsx components/components.module.css
git commit -m "feat: stack master creation and change input steps"
```

### Task 3: Expand STEP 3 and unlock STEP 4 / STEP 5 after draft creation

**Files:**
- Modify: `components/review-stage.tsx`
- Modify: `components/home-page.tsx`
- Modify: `components/components.module.css`

- [ ] **Step 1: Write the failing test**

Add a UI test that clicks `입력완료`, fills the review answers, then clicks `초안 생성` and asserts that the download card appears underneath the review card. Example:

```ts
await user.click(screen.getByRole("button", { name: "입력완료" }));
await user.click(screen.getByRole("button", { name: "초안 생성" }));
expect(await screen.findByText("통합 마스터와 상품 추출 다운로드")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "통합 마스터 다운로드" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "상품 추출 다운로드" })).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: the test fails because `초안생성` does not yet reveal a new STEP 4 / STEP 5 block in the current layout.

- [ ] **Step 3: Write minimal implementation**

Change `ReviewStage` so the review memo list and question list stay in a single full-width card. Place the submit button at the bottom of that card and rename it to `초안 생성`. After `finalSummary` exists, render a new card directly below the review card:

```tsx
{finalSummary ? (
  <div className={styles.downloadFlowCard}>
    <span className={styles.guideStepLabel}>STEP 4</span>
    <h3 className={styles.guideTitle}>초안 생성 완료</h3>
    <div className={styles.downloadOptionCard}>...</div>
    <div className={styles.downloadOptionCard}>...</div>
  </div>
) : null}
```

Keep the two download actions grouped as the final card content so they feel like a continuation of the same flow.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: after `초안생성`, the new download section becomes visible below the review card and the buttons are available.

- [ ] **Step 5: Commit**

```bash
git add components/review-stage.tsx components/home-page.tsx components/components.module.css
git commit -m "feat: reveal download step after draft creation"
```

### Task 4: Update step labels, accessibility text, and progress documentation

**Files:**
- Modify: `components/step-progress-bar.tsx`
- Modify: `docs/progress.md`
- Modify: `tests/common-core-app.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that checks the step labels match the new sequence exactly: `STEP 1`, `STEP 2`, `STEP 3`, `STEP 4`, `STEP 5`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: the test fails until the progress bar and card headings are updated together.

- [ ] **Step 3: Write minimal implementation**

Update `components/step-progress-bar.tsx` so the visible progress bar text matches the new flow:

```tsx
<section className={styles.stepCard} aria-label="단계 진행 상태">
  <div className={styles.stepItem}><span className={styles.stepBullet}>1</span><span>전체 통합 마스터 파일 만들기</span></div>
  <div className={styles.stepDivider} />
  <div className={styles.stepItem}><span className={styles.stepBullet}>2</span><span>변경내용 입력</span></div>
  <div className={styles.stepDivider} />
  <div className={styles.stepItem}><span className={styles.stepBullet}>3</span><span>검토메모 및 확인질문</span></div>
  <div className={styles.stepDivider} />
  <div className={styles.stepItem}><span className={styles.stepBullet}>4</span><span>초안생성</span></div>
  <div className={styles.stepDivider} />
  <div className={styles.stepItem}><span className={styles.stepBullet}>5</span><span>다운로드</span></div>
</section>
```

Update `docs/progress.md` with the new step-flow entry once the implementation is done.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/common-core-app.test.tsx
```

Expected: the step labels and the new download stage appear together without breaking existing flows.

- [ ] **Step 5: Commit**

```bash
git add components/step-progress-bar.tsx docs/progress.md tests/common-core-app.test.tsx
git commit -m "feat: align step labels with new flow"
```

### Task 5: Verify the full browser flow end-to-end

**Files:**
- No code changes unless verification exposes a concrete bug

- [ ] **Step 1: Run the app and verify in the browser**

Open `http://127.0.0.1:3000/preview`, then confirm this sequence visually:

1. STEP 1 shows master upload and preview in one card.
2. STEP 2 shows change input below it.
3. Clicking `입력완료` reveals STEP 3 below.
4. Clicking `초안 생성` reveals STEP 4 / STEP 5 below.
5. Download buttons remain visible as the final card.

- [ ] **Step 2: Run the targeted tests again**

Run:

```bash
npm test -- tests/common-core-app.test.tsx tests/draft-builder.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: complete vertical common core step flow"
```

