# Phase 2 Implementation Blueprint – AI Summarization & Moderation

## 🛠️ Overview

This document outlines the implementation plan for Phase 2 of the project: integrating LLM-based message summarization, automated moderation, and group-level Retrieval-Augmented Generation (RAG), fully compatible with both Expo Web and Android (Expo Go).

---

## T1. Firestore ➝ Task Queue Integration

Responsible for triggering jobs after message creation.

### Subtasks:
- **T1.1** Create `enqueueModerationJob.ts` Cloud Function (on `messages/{id}` `onCreate`)
- **T1.2** Filter out messages marked `ephemeralOnly` or already moderated
- **T1.3** Format and enqueue job to Cloud Tasks (`POST /moderate-summary-job`)
- **T1.4** Add logging + metrics for enqueue success/failure
- **T1.5** Write unit tests with Firebase Emulator Suite

---

## T2. Cloud Run Worker – `moderateAndSummarize.ts`

Processes jobs: fetches message, runs moderation, generates summary, updates Firestore & Pinecone.

### Subtasks:
- **T2.1** Scaffold endpoint to accept task payload (`messageId`, `conversationId`, etc.)
- **T2.2** Fetch message and associated media (from Firestore & Firebase Storage)
- **T2.3** Run **OpenAI Moderation API** (text) + **Rekognition/Vision SafeSearch** (media)
  - **T2.3a** If flagged: write to `moderation/{id}`, abort, return 200
- **T2.4** If not flagged: Run **GPT-4o-mini** summary (`≤30 tokens`)
  - **T2.4a** Format and write summary to `summaries/{msgId}`
  - **T2.4b** Embed summary using OpenAI embeddings, upsert to Pinecone under `conversationId`
- **T2.5** Handle failures and retry logic (up to 3x, log to Firestore or Sentry)
- **T2.6** Write integration tests + staging simulator

---

## T3. Client Integration (Web + Android)

Display AI summary under message (with shimmer + error fallback).

### Subtasks:
- **T3.1** Create `SummaryLine.tsx` (platform-agnostic UI component)
  - **T3.1a** Render shimmer while `summaryGenerated === false`
  - **T3.1b** Render `summary.text` if available
  - **T3.1c** Render fallback if `summaryUnavailable === true`
- **T3.2** Update message renderer to check `hasSummary` + load summary
- **T3.3** Respect `ephemeralOnly` flag: suppress summary
- **T3.4** Add action sheet (long-press): Copy, React, Report
- **T3.5** Test UI behavior on both Expo Web and Android (manual + E2E)

---

## T4. Pinecone Integration (RAG Setup)

Index and query per-conversation summaries for future RAG use.

### Subtasks:
- **T4.1** Create Pinecone namespace per `conversationId`
- **T4.2** Format summary chunks with timestamp, sender info
- **T4.3** Create embedding vectors via OpenAI, upsert into Pinecone
- **T4.4** Add metadata for future filtering (e.g., recency, user role)
- **T4.5** Write minimal test endpoint to validate group-level search

---

## T5. Observability & Analytics

Track performance and correctness of AI pipeline.

### Subtasks:
- **T5.1** Add Firestore metrics:
  - `summaryGenerated`, `moderationFlagged`, `summaryUnavailable`
- **T5.2** Add Cloud Tasks and Cloud Run logs to console/BigQuery
- **T5.3** Add retry/failure counter to `summaries/` metadata
- **T5.4** Create debug mode for developers (log moderation summary to test dashboard)

---

## T6. QA and Compliance

Verify consistency, reliability, and platform neutrality.

### Subtasks:
- **T6.1** Expo Web and Go: parity test matrix for all summary scenarios
- **T6.2** GDPR/CCPA compliance: summaries exportable via endpoint
- **T6.3** Test false-positive moderation edge cases (e.g. skin tones, sarcasm)
- **T6.4** Manually audit 50+ jobs in staging for summary quality and moderation correctness

---

## 📌 Milestone Tracking Summary

| Milestone                   | Tasks                   | Target Completion |
|----------------------------|--------------------------|-------------------|
| T1 – Firestore Queue Setup | T1.1–T1.5                | Week 1            |
| T2 – AI Worker Core        | T2.1–T2.6                | Week 2–3          |
| T3 – Client Summary UI     | T3.1–T3.5                | Week 2–3          |
| T4 – Pinecone Indexing     | T4.1–T4.5                | Week 4            |
| T5 – Observability         | T5.1–T5.4                | Week 4            |
| T6 – QA and Testing        | T6.1–T6.4                | Week 5            |
