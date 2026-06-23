# Agent Tab Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the support and review agent screens match the planning and pre-inquiry visual language by removing oversized hero cards while preserving the existing content and behavior.

**Architecture:** Keep the existing agent-tab routing and iframe structure intact. Update the standalone support and review HTML surfaces so their top sections become compact, white-background headers with the same lightweight spacing and panel rhythm as the planning agent, then verify the local tab still renders the same functional content.

**Tech Stack:** Next.js, static HTML/CSS, local browser verification.

---

### Task 1: Compress the support and review hero areas

**Files:**
- Modify: `C:/Users/suhyang/Desktop/uwagent/public/support-agent-app.html`
- Modify: `C:/Users/suhyang/Desktop/uwagent/public/review-agent/index.html`

- [ ] **Step 1: Write the failing visual expectation**

```text
The support and review pages should no longer present a large dark hero block at the top. Their headers should read as compact, white-background intro sections with the same calm spacing as the planning agent.
```

- [ ] **Step 2: Verify current pages still show the oversized hero**

Run: open `http://127.0.0.1:3001/agent-tabs` and inspect the support and review tabs
Expected: support/review still display the large hero block before the change

- [ ] **Step 3: Rewrite the top-section HTML/CSS minimally**

```html
<!-- Support and review pages keep the same content blocks below, but the top hero becomes a compact white section. -->
<section class="page-intro">
  <div class="intro-copy">
    <div class="pill">지원 Agent</div>
    <h1>지원 Agent</h1>
    <p>기획 파트와 같은 리듬으로, 원본 파일 업로드와 시스템 반영 흐름을 한눈에 확인할 수 있습니다.</p>
  </div>
</section>
```

- [ ] **Step 4: Verify the top section is reduced and the body content remains**

Run: reload `http://127.0.0.1:3001/agent-tabs`
Expected: support/review keep all their cards and functionality, but the big hero card is gone

### Task 2: Verify the combined tab layout still renders cleanly

**Files:**
- Modify: `C:/Users/suhyang/Desktop/uwagent/components/components.module.css`
- Test: browser verification against `http://127.0.0.1:3001/agent-tabs`

- [ ] **Step 1: Tighten outer spacing only if the tab surface still feels too wide**

```css
/* Keep the tab container focused and reduce the sense of excessive width on wide screens. */
.pageShell {
  width: min(1200px, calc(100vw - 72px));
  margin: 0 auto;
  padding: 56px 0 72px;
}
```

- [ ] **Step 2: Reload the local page and confirm the new shape**

Run: reload `http://127.0.0.1:3001/agent-tabs`
Expected: the planning, support, and review tabs share the same calmer spacing and no oversized hero dominates the support/review screens

- [ ] **Step 3: Leave the existing behavior untouched**

```text
No route changes, iframe target changes, or workbook logic changes are required for this pass.
```
