# Common Core App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop-first Next.js app for the common core agent flow with an input step, a review/question step, and a polished finance-inspired UI that can be viewed in the browser.

**Architecture:** Create a small App Router Next.js application with a single page that renders a two-step wizard via local React state. Keep sample data local for now, split UI into focused components, and verify the interaction flow with browser-based checks.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules, local sample state, desktop browser verification

---

## File Structure

- Create: `C:\Users\suhyang\Desktop\uwagent\package.json` — app scripts and dependencies
- Create: `C:\Users\suhyang\Desktop\uwagent\tsconfig.json` — TypeScript config
- Create: `C:\Users\suhyang\Desktop\uwagent\next.config.ts` — Next.js config
- Create: `C:\Users\suhyang\Desktop\uwagent\next-env.d.ts` — Next.js type stub
- Create: `C:\Users\suhyang\Desktop\uwagent\app\layout.tsx` — root layout
- Create: `C:\Users\suhyang\Desktop\uwagent\app\page.tsx` — top-level page and wizard state
- Create: `C:\Users\suhyang\Desktop\uwagent\app\globals.css` — global theme and base styles
- Create: `C:\Users\suhyang\Desktop\uwagent\components\step-progress-bar.tsx` — step indicator
- Create: `C:\Users\suhyang\Desktop\uwagent\components\hero-section.tsx` — hero block
- Create: `C:\Users\suhyang\Desktop\uwagent\components\input-stage.tsx` — input step UI
- Create: `C:\Users\suhyang\Desktop\uwagent\components\review-stage.tsx` — review step UI
- Create: `C:\Users\suhyang\Desktop\uwagent\components\components.module.css` — shared component styles
- Create: `C:\Users\suhyang\Desktop\uwagent\lib\sample-data.ts` — sample review memo/question data
- Create: `C:\Users\suhyang\Desktop\uwagent\tests\common-core-flow.spec.md` — manual verification checklist

### Task 1: Scaffold the Next.js app shell

**Files:**
- Create: `C:\Users\suhyang\Desktop\uwagent\package.json`
- Create: `C:\Users\suhyang\Desktop\uwagent\tsconfig.json`
- Create: `C:\Users\suhyang\Desktop\uwagent\next.config.ts`
- Create: `C:\Users\suhyang\Desktop\uwagent\next-env.d.ts`

- [ ] **Step 1: Write the dependency manifest**

```json
{
  "name": "uwagent",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.1",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Add TypeScript and Next.js config files**

```json
// C:\Users\suhyang\Desktop\uwagent\tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

```ts
// C:\Users\suhyang\Desktop\uwagent\next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

```ts
// C:\Users\suhyang\Desktop\uwagent\next-env.d.ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`  
Expected: installs Next.js, React, TypeScript packages with no errors

- [ ] **Step 4: Commit scaffold**

```bash
git add package.json tsconfig.json next.config.ts next-env.d.ts package-lock.json
git commit -m "chore: scaffold next app shell"
```

### Task 2: Build the shared app frame and theme

**Files:**
- Create: `C:\Users\suhyang\Desktop\uwagent\app\layout.tsx`
- Create: `C:\Users\suhyang\Desktop\uwagent\app\globals.css`

- [ ] **Step 1: Create the root layout**

```tsx
// C:\Users\suhyang\Desktop\uwagent\app\layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "신계약 공통 에이전트",
  description: "변경내용 입력부터 검토메모 확인까지 이어지는 공통 코어 에이전트 앱",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Add global theme styles**

```css
/* C:\Users\suhyang\Desktop\uwagent\app\globals.css */
:root {
  --bg: #f4f7fb;
  --surface: #ffffff;
  --surface-alt: #eef3fb;
  --ink: #101828;
  --muted: #667085;
  --line: #d9e2f1;
  --navy: #233a78;
  --navy-deep: #18264d;
  --blue: #2f80ed;
  --blue-soft: #d8e8ff;
  --amber-soft: #fff1c2;
  --amber-ink: #8a5b00;
  --shadow: 0 20px 50px rgba(17, 24, 39, 0.08);
  --radius-xl: 28px;
  --radius-lg: 20px;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background:
    radial-gradient(circle at top left, rgba(47, 128, 237, 0.08), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, var(--bg) 100%);
  color: var(--ink);
  font-family: "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
}

button,
input,
textarea {
  font: inherit;
}
```

- [ ] **Step 3: Run the app to verify base shell boots**

Run: `npm run dev`  
Expected: Next.js dev server starts successfully

- [ ] **Step 4: Commit theme frame**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: add global app frame and theme"
```

### Task 3: Implement sample data and step components

**Files:**
- Create: `C:\Users\suhyang\Desktop\uwagent\lib\sample-data.ts`
- Create: `C:\Users\suhyang\Desktop\uwagent\components\step-progress-bar.tsx`
- Create: `C:\Users\suhyang\Desktop\uwagent\components\hero-section.tsx`
- Create: `C:\Users\suhyang\Desktop\uwagent\components\input-stage.tsx`
- Create: `C:\Users\suhyang\Desktop\uwagent\components\review-stage.tsx`
- Create: `C:\Users\suhyang\Desktop\uwagent\components\components.module.css`

- [ ] **Step 1: Define sample review data**

```ts
// C:\Users\suhyang\Desktop\uwagent\lib\sample-data.ts
export type ReviewMemo = {
  id: string;
  title: string;
  description: string;
  status: "검토 필요" | "참고";
};

export type ReviewQuestion = {
  id: string;
  label: string;
  prompt: string;
  hint: string;
};

export const sampleReviewMemos: ReviewMemo[] = [
  {
    id: "memo-1",
    title: "소액암진단 단일건 한도 상향 초안",
    description: "일반/건강과 간편 모두 1000에서 2000으로 상향하는 안이 감지되었습니다.",
    status: "검토 필요",
  },
  {
    id: "memo-2",
    title: "인별합산 주석 영향 확인 필요",
    description: "인별합산 3000 유지 여부와 66세 이상 예외 주석 관계를 확인해야 합니다.",
    status: "검토 필요",
  },
  {
    id: "memo-3",
    title: "암진단-소액암 연계조건",
    description: "암진단 가입 시 소액암진단 가입 필수 조건은 유지되는 것으로 읽혔습니다.",
    status: "참고",
  },
];

export const sampleReviewQuestions: ReviewQuestion[] = [
  {
    id: "question-1",
    label: "질문 1",
    prompt: "소액암진단 단일건 한도를 일반/건강과 간편 모두 2000으로 변경할까요?",
    hint: "예: 둘 다 2000으로 변경 / 일반만 변경 / 보류",
  },
  {
    id: "question-2",
    label: "질문 2",
    prompt: "인별합산 3000은 유지할까요, 단일건 상향에 맞춰 함께 재검토할까요?",
    hint: "예: 3000 유지 / 인별합산도 변경 검토",
  },
];
```

- [ ] **Step 2: Add presentational components and shared CSS**

Code to include:
- `step-progress-bar.tsx` with two labeled steps and active styling
- `hero-section.tsx` with title `신계약 공통 에이전트`
- `input-stage.tsx` with file input, textarea, and `입력완료` button
- `review-stage.tsx` with memo cards, question inputs, and `초안 확정` button
- `components.module.css` containing the card layout, hero gradient, wizard grid, buttons, and desktop widths

Required component signatures:

```tsx
export function StepProgressBar({ step }: { step: "input" | "review" }) {}
export function HeroSection() {}
export function InputStage(props: {
  rawInput: string;
  fileName: string;
  onRawInputChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onComplete: () => void;
}) {}
export function ReviewStage(props: {
  fileName: string;
  rawInput: string;
  answers: Record<string, string>;
  onAnswerChange: (id: string, value: string) => void;
}) {}
```

- [ ] **Step 3: Run TypeScript check through Next build**

Run: `npm run build`  
Expected: build succeeds without type errors

- [ ] **Step 4: Commit UI components**

```bash
git add lib/sample-data.ts components
git commit -m "feat: add common core wizard components"
```

### Task 4: Wire the page state and screen transition

**Files:**
- Create: `C:\Users\suhyang\Desktop\uwagent\app\page.tsx`

- [ ] **Step 1: Build the top-level page with local state**

```tsx
// C:\Users\suhyang\Desktop\uwagent\app\page.tsx
"use client";

import { useState } from "react";
import { HeroSection } from "@/components/hero-section";
import { InputStage } from "@/components/input-stage";
import { ReviewStage } from "@/components/review-stage";
import { StepProgressBar } from "@/components/step-progress-bar";
import styles from "@/components/components.module.css";

type Step = "input" | "review";

export default function HomePage() {
  const [step, setStep] = useState<Step>("input");
  const [rawInput, setRawInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <main className={styles.pageShell}>
      <HeroSection />
      <StepProgressBar step={step} />
      {step === "input" ? (
        <InputStage
          rawInput={rawInput}
          fileName={fileName}
          onRawInputChange={setRawInput}
          onFileChange={(file) => setFileName(file?.name ?? "")}
          onComplete={() => setStep("review")}
        />
      ) : (
        <ReviewStage
          fileName={fileName}
          rawInput={rawInput}
          answers={answers}
          onAnswerChange={(id, value) =>
            setAnswers((current) => ({ ...current, [id]: value }))
          }
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Extend the shared CSS with page shell and desktop layout**

Add to `C:\Users\suhyang\Desktop\uwagent\components\components.module.css`:

```css
.pageShell {
  width: min(1440px, calc(100vw - 64px));
  margin: 0 auto;
  padding: 32px 0 72px;
}
```

- [ ] **Step 3: Verify step transition manually**

Run: `npm run dev`  
Expected: clicking `입력완료` moves from the input screen to the review screen

- [ ] **Step 4: Commit page wiring**

```bash
git add app/page.tsx components/components.module.css
git commit -m "feat: wire common core wizard flow"
```

### Task 5: Add verification notes and browser-ready handoff

**Files:**
- Create: `C:\Users\suhyang\Desktop\uwagent\tests\common-core-flow.spec.md`
- Modify: `C:\Users\suhyang\Desktop\uwagent\docs\progress.md`

- [ ] **Step 1: Write manual verification checklist**

```md
# Common Core Flow Manual Check

- Open the desktop app in a browser
- Confirm hero title reads `신계약 공통 에이전트`
- Confirm `변경내용 입력` card shows file upload and text input
- Click `입력완료`
- Confirm review screen appears
- Confirm at least 3 review memos render
- Confirm at least 2 review questions accept text input
```

- [ ] **Step 2: Update progress log**

Append one line to `C:\Users\suhyang\Desktop\uwagent\docs\progress.md` noting the Next.js UI implementation step.

- [ ] **Step 3: Run final build check**

Run: `npm run build`  
Expected: production build completes successfully

- [ ] **Step 4: Commit verification docs**

```bash
git add tests/common-core-flow.spec.md docs/progress.md
git commit -m "docs: add common core app verification notes"
```

## Self-Review

- Spec coverage: the plan covers the hero title, dual input methods, step transition, review memo/question UI, and desktop-only layout.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: `step`, `rawInput`, `fileName`, and `answers` naming is consistent across components and page state.
