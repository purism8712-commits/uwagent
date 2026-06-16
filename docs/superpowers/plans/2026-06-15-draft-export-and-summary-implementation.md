# Draft Export And Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real `초안확정` flow that shows a final summary on screen and downloads a common-core `.xlsx` draft file.

**Architecture:** Keep the existing two-step Next.js app, add API routes for summary and export, and wire the review screen to call them. Use local sample draft data for now, but separate draft-building logic into reusable server helpers.

**Tech Stack:** Next.js App Router, React, TypeScript, xlsx, Vitest, Testing Library

---
