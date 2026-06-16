# Persisted Master Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persisted master workflow where uploaded guideline Excel files are consolidated into one stored master workbook, later edited from change input, and downloaded as a highlighted final XLSX.

**Architecture:** The app will keep the current client-driven review UI, but add a persisted workbook layer on the server for the consolidated master. Step 0 creates or replaces the saved master workbook from uploaded files, Step 1 applies changes against that stored workbook, and the export route reads the latest saved workbook to generate the final highlighted XLSX download. The UI stays on the same page, but the workflow gains a clear master-save boundary between consolidation and change application.

**Tech Stack:** Next.js App Router, TypeScript, server routes, XLSX workbook generation, existing React UI, browser direct download.

---

### Task 1: Add persisted master workbook storage

**Files:**
- Create: `lib/master-workbook-store.ts`
- Modify: `app/api/draft-export/route.ts`

- [ ] **Step 1: Write the failing test**

Add a focused test that saves a master workbook payload and then loads it back by key, asserting the latest saved workbook is returned for export.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/common-core-app.test.tsx tests/draft-builder.test.ts`
Expected: fail because the store module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement an in-memory persisted master workbook store with `saveMasterWorkbook(key, payload)` and `loadMasterWorkbook(key)` helpers, then wire the export route to read from the saved workbook when one exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/common-core-app.test.tsx tests/draft-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/master-workbook-store.ts app/api/draft-export/route.ts tests/draft-builder.test.ts
git commit -m "feat: persist consolidated master workbook"
```

### Task 2: Add STEP 0 consolidation action and server endpoint

**Files:**
- Modify: `components/input-stage.tsx`
- Modify: `components/components.module.css`
- Modify: `app/page.tsx`
- Create: `app/api/master-workbook/route.ts`

- [ ] **Step 1: Write the failing test**

Add UI tests that upload multiple files, click `전체 통합 마스터 파일 만들기`, and expect a saved-master success state before Step 1 continues.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/common-core-app.test.tsx`
Expected: fail because the new STEP 0 action and endpoint are missing.

- [ ] **Step 3: Write minimal implementation**

Render the STEP 0 card above Step 1 with the upload control and master creation button, then add a POST endpoint that consolidates uploaded files into a standard template workbook and stores it through the new master store.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/common-core-app.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/api/master-workbook/route.ts components/input-stage.tsx components/components.module.css tests/common-core-app.test.tsx
git commit -m "feat: add persisted master creation step"
```

### Task 3: Apply change input to the stored master workbook and export highlighted XLSX

**Files:**
- Modify: `app/api/draft-export/route.ts`
- Modify: `lib/draft-export.ts`
- Modify: `components/review-stage.tsx`
- Modify: `tests/common-core-app.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that creates the master workbook, enters a change request, confirms the draft, and downloads a final XLSX whose response indicates changed cells are highlighted.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/common-core-app.test.tsx tests/draft-builder.test.ts`
Expected: fail until the export route reads the stored master and applies highlight formatting.

- [ ] **Step 3: Write minimal implementation**

Update the export builder so it starts from the persisted master workbook, applies the requested change diff, and styles changed cells with font color and fill; keep the browser download flow as a direct attachment response.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/common-core-app.test.tsx tests/draft-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/draft-export/route.ts lib/draft-export.ts components/review-stage.tsx tests/common-core-app.test.tsx
git commit -m "feat: export highlighted final master workbook"
```

### Task 4: Verify preview route and update progress notes

**Files:**
- Modify: `docs/progress.md`
- Verify: `app/preview/page.tsx`

- [ ] **Step 1: Run the app build**

Run: `npm run build`
Expected: the new persisted-master routes compile successfully.

- [ ] **Step 2: Verify the browser preview**

Open `http://127.0.0.1:3000/preview`, confirm STEP 0 shows above STEP 1, and verify the consolidated master workflow copy appears.

- [ ] **Step 3: Update progress log**

Append a new `STEP` entry describing the persisted master workbook flow and the highlighted XLSX export.

- [ ] **Step 4: Commit**

```bash
git add docs/progress.md app/preview/page.tsx
git commit -m "docs: record persisted master workflow"
```
