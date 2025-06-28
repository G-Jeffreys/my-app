# Product Requirements Document (PRD) – Combined and Expanded for Phase 2 AI and Platform Agnosticism

## Document Control

- **Version:** 0.3
- **Author:** ChatGPT (in collaboration with user)
- **Last Updated:** 26 Jun 2025

---

## 1. Purpose & Background

A mobile chat application inspired by Snapchat where media disappears **after a countdown that starts upon delivery (receipt) rather than on open**. In Phase 2, every piece of content also generates a persistent LLM summary (using Retrieval‑Augmented Generation) and passes through an automated sensitive‑content filter. This hybrid "ephemeral + recall" design offers the fun of vanishing media while preserving lightweight knowledge of what was shared.

---

## 2. Goals & Success Metrics

| Goal                                | Metric                                         | Target (90 days post‑launch) |
| ----------------------------------- | ---------------------------------------------- | ---------------------------- |
| Delight in ephemerality             | Avg. daily media sent / DAU                    | ≥ 12                         |
| Minimise missed‑message frustration | Missed‑without‑summary complaint tickets       | < 0.5 % of active users      |
| Fast, reliable delivery             | P50 end‑to‑end send→device download            | ≤ 800 ms                     |
| Efficient summaries                 | Avg. LLM cost / MAU                            | ≤ US\$3                      |
| Trust & safety                      | Toxic content caught by filter before delivery | ≥ 98 %                       |

---

## 3. Phased Approach

### Phase 1 – Core Ephemeral Messaging

[...original Phase 1 content remains unchanged...]

### Phase 2 – AI Summaries & Moderation (RAG)

#### Overview

Phase 2 introduces persistent, lossy LLM-generated summaries for all messages, while enforcing platform-wide safety via automated moderation. Each group chat operates its own Retrieval-Augmented Generation (RAG) memory, built from historical summaries, enabling context-aware recap and summarization features.

#### Phase 2 Key Capabilities:

1. **Summarization**

   - Every message generates a one-sentence summary (≤30 tokens) via GPT-4o-mini.
   - Summary must be shorter and contain strictly less information than the original (lossy, ambiguous, factual).
   - Summaries persist independently from the TTL-bound original message.
   - Rendered below expired (or optionally live) message bubbles.

2. **Moderation**

   - All messages undergo content filtering via OpenAI Moderation (text) and AWS Rekognition / Google Vision (images/video).
   - Messages flagged by moderation **are never delivered to the recipient**. No notification is shown to the sender.
   - Moderation verdicts are stored in `moderation/{msgId}`. No appeals process initially.

3. **RAG Memory (Per Group Chat)**

   - Each group chat seeds and maintains its own RAG memory using Pinecone vector store.
   - Summaries are indexed and chunked per `conversationId`.
   - Contextual queries and conversation-level summarization to be added later (Phase 2.5+).

4. **Workflow Infrastructure**

   - Firestore trigger (`messages/{id}`) enqueues task to Cloud Tasks.
   - Cloud Run worker (`moderateAndSummarize.ts`) handles moderation, summarization, Pinecone indexing.
   - Retries supported via Cloud Tasks (up to 3 times).

5. **Client Support**

   - Summary line rendered using shimmer ➝ summary ➝ fallback state.
   - Honors `ephemeralOnly` flag to skip summarization for select messages.

#### Technical Constraints:

- **Must function identically on Expo Web and Android (via Expo Go)**.
  - No Node-only libraries or native modules on client.
  - All AI tasks performed server-side.
  - React-only UI components with Expo-safe APIs.
- Camera/video features remain the only platform-specific exception.

---

## 5. User Stories (Selected)

### Epic S – Summary Generation & Persistence

| User Story ID | Story                                                                                                                  | Acceptance Hint                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **S1**        | *As a recipient*, I see a one-sentence summary appear beneath a snap **within 5s (P95)** of media download completing. | Summary renders below message bubble before expiration. |
| **S2**        | *As a recipient who missed a snap*, I can tap the summary to open an action sheet (copy, react, report).               | Summary remains visible after TTL expiry.               |
| **S3**        | *As a sender*, I can disable the persistent summary for a particular snap via "Ephemeral-Only" toggle.                 | Flag reflected in Firestore and honored by backend.     |
| **S4**        | *As the system*, if summary generation fails, retry up to 3× before showing "Summary unavailable".                     | Logged retry count; fallback UI state.                  |

### Epic R – Retrieval-Augmented Generation (Contextuality)

| ID     | Story                                                                                             | Hint                                       |
| ------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **R1** | *As a system*, I chunk and index summaries by group chat using Pinecone under `conversationId`.   | Summary embedding stored with metadata.    |
| **R2** | *As a developer*, I rely on a Cloud Tasks queue to decouple Firestore triggers from worker logic. | Worker pulled from task queue (Cloud Run). |

### Epic C – Safety (AI Moderation)

| ID     | Story                                                                                             | Hint                                             |
| ------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **C1** | *As the system*, I block delivery of any message flagged by moderation pipeline.                  | Message is never delivered; sender not notified. |
| **C2** | *As a developer*, I require moderation and summarization to function the same on Web and Android. | Client is agnostic, all backend logic.           |

---

## 6. Functional Requirements

### 6.2 Phase 2

| FR-ID | Description                                                                                           | Priority | Status        |
| ----- | ----------------------------------------------------------------------------------------------------- | -------- | ------------- |
| FR-9  | The system shall generate ≤30-token summary per message using GPT-4o-mini.                            | Must     | 🔮 SCAFFOLDED |
| FR-10 | Summaries shall persist after original message expiration.                                            | Must     | 🔮 SCAFFOLDED |
| FR-11 | If content is flagged by moderation APIs, the message is blocked with no delivery or sender feedback. | Must     | 🔮 SCAFFOLDED |
| FR-12 | The client shall render summaries in a shimmer ➝ complete ➝ error UI pipeline.                        | Should   | 🔮 SCAFFOLDED |
| FR-13 | Summary and moderation pipeline must operate identically on Expo Web and Android.                     | Must     | ✅ ACCOUNTED   |
| FR-14 | Summaries shall be indexed to Pinecone under their `conversationId` as RAG chunks.                    | Must     | 🔮 PLANNED    |

---

## 8. Technical Architecture (Updated)

```
Client (Expo Web + Expo Go) ──► Firebase Auth ──► Firestore
                                 │                 ├── messages/{messageId}
                                 │                 ├── summaries/{summaryId}
                                 │                 ├── moderation/{messageId}
                                 │                 ├── conversations/{conversationId}
                                 └── Firebase Storage (/messages/{filename})

Firestore Trigger ──► Cloud Function (enqueueModerationJob)
                                 │
                                 ▼
                        Cloud Tasks Queue
                                 │
                                 ▼
                       Cloud Run Worker (moderateAndSummarize.ts)
                                 │
                 ┌───────────────┴────────────────┐
                 │                                │
       OpenAI GPT-4o-mini                OpenAI Moderation + Rekognition
                 │                                │
                 └────► Write to Firestore (summaries + moderation)

                          ▼
                      Pinecone Vector Store (group-level RAG)
```

---

## 15. Implementation Roadmap – Phase 2 (Expanded)

### ✅ READY TO START

- Firestore schema, message flags, and security rules are complete.
- Platform abstraction ensures Expo Web + Android compatibility.
- Summary and moderation API scaffolding in place (`config/messaging.ts`).

### 🚀 Next Engineering Tasks

| Task Block | Description                                                                       |
| ---------- | --------------------------------------------------------------------------------- |
| T1         | ``: Firestore Cloud Function enqueues job to Cloud Tasks.                         |
| T2         | ``: Cloud Run handler that performs moderation, summarization, Pinecone indexing. |
| T3         | ``: Client UI component to render summary below message bubble.                   |
| T4         | **Integration Tests**: Ensure consistent operation across Expo Web and Android.   |

---

All other sections from the original PRD remain unchanged for context, including timeline, analytics, non-functional requirements, risks, and future backlog.

