# Product Requirements Document (PRD)

## Document Control

- **Version:** 0.2 (Draft)
- **Author:** ChatGPT (drafted for )
- **Last Updated:** 23 Jun 2025

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

### Phase 1 – Core Ephemeral Messaging

1. **Send & Receive Media** (photo, video ≤10 s, text), stored in Firebase Storage + Firestore.
2. **On‑receipt countdown** handled client‑side (`expiresAt = receivedAt + TTL`). TTL is selected by the **sender** per‑message from a predefined set (e.g., 30 s, 1 min, 5 min, 1 h, 6 h, 24 h) with an upper limit of 24 h.
3. **Missed State**: if `now() > expiresAt` and message unopened, show a grey placeholder "Missed snap".
4. **Cleanup Pipeline**: Cloud Function purges blobs once all recipients' `expiresAt` have passed.
5. **Analytics**: events for `media_sent`, `media_received`, `media_missed`, `media_viewed`.

#### Group Chat Implementation (Enhanced Phase 1)

**Core Group Conversation Experience:**
- **Dedicated Group Chat View** (`group-conversation/[conversationId].tsx`): Real-time conversation screen with threaded message display, participant info, and in-conversation message composition
- **Enhanced Group Message Display** (`GroupMessageItem.tsx`): Chat-style message bubbles with sender identification, "own vs received" styling, and proper message threading
- **In-Conversation Composer** (`InConversationComposer.tsx`): Context-aware message composition within group conversations, supporting both text and camera messages with TTL selection
- **Real-time Updates**: Live conversation state management with Firestore listeners for immediate message delivery and participant status updates

**Group Management Features:**
- **Group Settings Screen** (`group-settings/[conversationId].tsx`): Comprehensive group administration including participant management, group name editing, and conversation controls
- **Add Group Members** (`add-group-member/[conversationId].tsx`): Dynamic member addition to existing conversations with friend selection UI and participant limit enforcement
- **Member Management**: Full CRUD operations for group membership including add, remove, and leave group functionality with proper state synchronization

**Data Architecture Enhancements:**
- **Conversation-Scoped Queries**: Message retrieval optimized per conversation with ascending timestamp ordering for chat-style display
- **Enhanced Receipt Tracking**: Group-aware receipt management supporting per-participant TTL tracking and delivery confirmation
- **Group Configuration**: Configurable group limits (MAX_PARTICIPANTS: 5, MIN_PARTICIPANTS: 1) with validation at UI and backend levels

**User Experience Improvements:**
- **Cohesive Navigation Flow**: Groups screen now navigates directly to dedicated conversation views instead of generic compose screen
- **Participant Visibility**: Clear display of group member information with profile pictures, names, and online status indicators
- **Responsive Design**: Web-optimized layouts with max-width constraints and platform-specific styling adaptations

**Technical Implementation Notes:**
- All group functionality maintains compatibility with existing 1:1 messaging architecture
- Proper error handling and loading states throughout group chat flows
- Comprehensive logging and console output for debugging and monitoring
- Modular component architecture for maintainability and testing

### Phase 2 – AI Summaries & Moderation (RAG)

1. **Trigger** `messages/{id}` → Cloud Tasks queue.
2. **RAG Pipeline**
   - **Retrieval Layer**: Vector store (e.g. Supabase pgvector or Pinecone) seeded with company FAQ, chat‑safety policy, and previous message context.
   - **Generation Layer**: GPT‑4o‑mini with system prompt "Generate one‑sentence neutral summary".
3. **Vision Captioning** (images/video key‑frame) at 640 px for cost control.
4. **Sensitive‑Content Filtering** in the same job:
   - **OpenAI Moderation API** for text.
   - **AWS Rekognition / Google Vision SafeSearch** for imagery.
   - If flagged ➜ quarantine message, notify Trust & Safety queue.
5. **Storage**: Summary saved under `summaries/{msgId}`; moderation verdict under `moderation/{msgId}`.
6. **Client UI**: Summary line renders under expired bubble; shimmer placeholder while pending.

---

## 4. Target Audience

- Gen‑Z and young millennial users familiar with Snapchat/Instagram.
- Privacy‑conscious senders who enjoy impermanent sharing but still want conversation context.

---

## 5. User Stories (Selected)

The focus below is on the new, AI‑powered behaviour that differentiates the product.

### Epic S – Summary Generation & Persistence

| User Story ID | Story                                                                                                                                                  | Acceptance Hint                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **S1**        | *As a recipient*, I see a one‑sentence LLM summary appear beneath a snap **within 5 s (P95)** of the media download completing.                        | Summary renders before or alongside countdown UI.            |
| **S2**        | *As a recipient who missed a snap*, I can tap the summary to open an action sheet (copy, react, report).                                               | Summary remains selectable after media expiry.               |
| **S3**        | *As a sender*, I can disable the persistent summary for a particular snap via an "Ephemeral‑Only" toggle.                                              | Toggle state reflected in Firestore and honoured by backend. |
| **S4**        | *As the system*, if the summary job is delayed or fails, the UI shows a shimmer placeholder and retries up to 3× before showing "Summary unavailable". | Logged retry count & failure metric.                         |
| **S5**        | *As the platform*, I attach moderation verdicts to each message and block delivery when content violates policy, surfacing a toast to the sender.      | 98 % of blocked content never reaches recipient.             |

### Epic R – Retrieval‑Augmented Generation (Contextuality)

| User Story ID | Story                                                                                                                                    | Acceptance Hint                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **R1**        | *As a user*, pronouns in summaries are resolved using recent chat context so "he" becomes "Tom" when unambiguous.                        | Unit test: Summary includes correct proper noun given context window. |
| **R2**        | *As the system*, I rerun summarisation if a user changes their display name so stored summaries reflect new aliases.                     | Change‑name event triggers re‑queue; updated summary saved.           |
| **R3**        | *As a user*, I can long‑press a summary to view a "Why this summary?" panel that cites it was AI‑generated and offers a feedback button. | Feedback event logged; copy consistent across platforms.              |

### Epic C – Safety (AI‑Assisted Moderation)

| User Story ID | Story                                                                                                                 | Acceptance Hint                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **C1**        | *As the platform*, I scan every photo/video/text via a multi‑model ensemble and quarantine if confidence ≥ threshold. | Flag rate dashboard meets ≥ 98 % detection.                      |
| **C2**        | *As a sender*, if my media is blocked, I immediately receive an error toast with a link to appeal.                    | Appeal link deep‑links to Help Center.                           |
| **C3**        | *As Trust & Safety staff*, I can view flagged items and their summaries in a review queue.                            | Internal tool shows media preview + summary + confidence scores. |

---

## 6. Functional Requirements

### 6.1 Phase 1

| FR‑ID | Description                                                                                                                | Priority | Status |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR‑1  | The system shall start TTL countdown at `receivedAt`.                                                                      | Must     | ✅ IMPLEMENTED |
| FR‑2  | The system shall hide media after `expiresAt` locally without server round‑trip.                                           | Must     | ✅ IMPLEMENTED |
| FR‑3  | The system shall show a "Missed" placeholder once media expires unopened.                                                  | Must     | ✅ IMPLEMENTED |
| FR‑4  | The server shall delete media binaries after all recipients' TTLs elapse + 1 h buffer.                                     | Must     | ✅ IMPLEMENTED (10 min schedule) |
| FR‑5  | The system shall allow the sender to choose a TTL per message from a predefined list (min 30 s, max 24 h, coarse presets). | Must     | ✅ IMPLEMENTED |
| FR‑6  | The system shall support both individual and group messaging with unified TTL logic.                                       | Must     | ✅ IMPLEMENTED |
| FR‑7  | The system shall support text messages with same TTL behavior as media messages.                                           | Must     | ✅ IMPLEMENTED |
| FR‑8  | The system shall track message receipts per participant for accurate TTL calculation.                                      | Must     | ✅ IMPLEMENTED |

**Implementation Notes:**
- **TTL Presets**: `['30s', '1m', '5m', '1h', '6h', '24h']` with user-configurable defaults
- **Cleanup Schedule**: Every 10 minutes (not hourly + 1h buffer as originally specified)
- **Group TTL Logic**: Messages only deleted when ALL participants' TTLs expire (known issue with offline users)
- **Receipt System**: Comprehensive `receipts` collection with `receivedAt` and `viewedAt` tracking
- **Message Types**: Full support for text, image, video with unified TTL behavior

### 6.2 Phase 2

| FR‑ID | Description                                                                                      | Priority | Status |
| ----- | ------------------------------------------------------------------------------------------------ | -------- | ------ |
| FR‑9  | The system shall generate a ≤ 30‑token summary for each message using RAG.                       | Must     | 🔮 SCAFFOLDED |
| FR‑10 | Summaries shall persist indefinitely unless manually deleted by user.                            | Must     | 🔮 SCAFFOLDED |
| FR‑11 | The system shall block delivery if content is flagged abusive/illegal.                           | Must     | 🔮 SCAFFOLDED |
| FR‑12 | The client shall render summaries under expired bubbles (and optionally while media still live). | Should   | 🔮 SCAFFOLDED |

**Phase 2 Preparation Status:**
- **LLM Configuration**: Complete config in `messaging.ts` with 30-token limit, 5s timeout, batch size 20
- **Summary Schema**: Full `Summary` interface with moderation metadata and retry logic
- **Database Preparation**: Security rules and indexes configured for `summaries` and `ragChunks`
- **Integration Points**: Message interface includes `hasSummary`, `summaryGenerated`, `ephemeralOnly` flags

---

## 7. Non‑Functional Requirements

| Category    | Requirement                                                                            |
| ----------- | -------------------------------------------------------------------------------------- |
| Performance | Summaries available within 2 s P95, text; 5 s image; 8 s video.                        |
| Cost        | Infra + LLM ≤ US\$0.15 / DAU.                                                          |
| Reliability | 99.9 % message delivery success.                                                       |
| Security    | All media encrypted in transit (TLS) and at rest (GCS CMEK).                           |
| Privacy     | Explicit sign‑up modal explaining persistence of summaries; GDPR/CCPA export endpoint. |

---

## 8. Technical Architecture (High‑Level)

```
Client (React Native) ──► Cloud Functions API ──► Firestore
                        │                        │
                        └─► Cloud Storage (media blobs)
                                │
                                ▼
         Summary & Moderation Worker (Cloud Run)
                        │
                        ▼
               Vector Store (pgvector)
```

**Actual Implementation Architecture:**

```
React Native/Expo Web ──► Firebase Auth ──► Firestore Collections:
                        │                   ├── users/{userId}
                        │                   ├── users/{userId}/friends/{friendId}
                        │                   ├── conversations/{conversationId}
                        │                   ├── messages/{messageId}
                        │                   ├── receipts/{receiptId}
                        │                   ├── friendRequests/{requestId} [global]
                        │                   └── summaries/{summaryId} [future]
                        │
                        ├─► Firebase Storage (/messages/{filename})
                        │
                        └─► Cloud Functions:
                            ├── acceptFriendRequest (onDocumentUpdated)
                            ├── cleanupExpiredMessages (onSchedule: every 10 min)
                            └── [Future: generateSummary, moderateContent]
```

**Current Implementation Details:**
- **Platform**: Expo Web (development), React Native (mobile target)
- **Database**: Firestore with 6 core collections + 2 future collections
- **Storage**: Firebase Storage with organized /messages/ folder structure
- **Security**: Comprehensive Firestore Security Rules with participant validation
- **TTL Logic**: Client-side countdown + server-side cleanup every 10 minutes
- **Group Chat**: Full implementation with conversation-scoped queries and receipt tracking

**Phase 2 Preparation:**
- **LLM Config**: Scaffolded in `config/messaging.ts` with OpenAI integration points
- **Summary Schema**: Complete `Summary` interface with moderation metadata
- **RAG Hooks**: Conversation-level message counting and RAG update tracking
- **Security Rules**: Pre-configured for `summaries` and `ragChunks` collections

---

## 9. Analytics & Observability

- **Events**: `send`, `download_complete`, `opened`, `expired_unopened`, `summary_generated`, `moderation_flagged`, `ttl_selected`.
- **Dashboards** in Looker: Daily sends, Miss ratio, Summary latency, Flag rate, TTL distribution.

**Current Implementation Status:**
- **✅ Implemented**: `media_sent`, `media_received`, `media_viewed`, `friend_request_sent`, `friend_request_accepted`, `login`, `sign_up`
- **⚠️ Missing**: `expired_unopened`, `ttl_selected`, `summary_generated`, `moderation_flagged`
- **Platform**: Firebase Analytics (web only), console logging (mobile)
- **Dashboard**: Not yet implemented - requires BigQuery export setup

---

## 10. Dependencies

- Firebase project with Blaze plan.
- OpenAI API key (GPT‑4o, Moderation, Vision).
- Vector DB (Supabase Managed Postgres).
- Trust & Safety review tooling.

---

## 11. Risks & Mitigations

| Risk                                | Impact         | Likelihood | Mitigation                                                                             |
| ----------------------------------- | -------------- | ---------- | -------------------------------------------------------------------------------------- |
| High LLM cost spike                 | Stretch budget | Medium     | Resolution‑aware image scaling; daily cost alerting.                                   |
| Content filter false negatives      | User harm      | Low‑Medium | Ensemble models + human review queue on confidence < 0.6                               |
| Users complain about "miss" feature | Retention drop | Medium     | Education toast first time a snap is missed; adjustable TTL presets based on feedback. |

---

## 12. Timeline (Draft)

| Milestone          | Target Date | Notes                          | Status |
| ------------------ | ----------- | ------------------------------ | ------ |
| M1 – Phase 1 Alpha | 30 Aug 2025 | Internal dogfood.              | ✅ COMPLETED |
| M2 – Phase 1 Beta  | 30 Sep 2025 | TestFlight/Play closed beta.   | ✅ COMPLETED |
| M3 – Phase 1 GA    | 15 Nov 2025 | Public launch.                 | 🎯 ON TRACK |
| M4 – Phase 2 Alpha | 15 Jan 2026 | Summaries + filter on staging. | 🔮 READY TO START |
| M5 – Phase 2 GA    | 31 Mar 2026 | Wide release.                  | 🔮 PLANNED |

**Timeline Updates Based on Current Progress:**
- **Phase 1**: Significantly ahead of schedule - core functionality complete by June 2025
- **Phase 2**: Well-positioned to start immediately with comprehensive scaffolding in place
- **Technical Debt**: Minimal due to thorough Phase 1 implementation
- **Risk Mitigation**: Group chat TTL issue documented but not blocking for GA launch

---

## 13. Out‑of‑Scope (v1)

- Group video calls.
- Search across summaries (future backlog).
- Desktop/web client.

---

## 14. Acceptance Criteria

1. A message downloaded at 12:00 with TTL 1 h is no longer visible after 13:00, regardless of open state.
2. Senders can select a TTL value only from the predefined list; attempts to set unsupported values are rejected client‑side and sever‑side.
3. A summary exists and is retrievable via API for every delivered message (Phase 2).
4. Media flagged as inappropriate never reaches recipient device.
5. P50 end‑to‑end media delivery latency ≤ 800 ms in production.

---

## 15. Implementation Status & Roadmap

### ✅ **COMPLETED - Phase 1 Core Features**

**Core Ephemeral Messaging:**
- ✅ TTL-based message expiration with client-side countdown
- ✅ Receipt tracking system for accurate `receivedAt` timestamps  
- ✅ Server-side cleanup pipeline (Cloud Functions, 10-minute schedule)
- ✅ Comprehensive TTL preset system (30s to 24h)
- ✅ "Missed message" placeholders for expired content

**Group Chat System:**
- ✅ Complete group conversation implementation
- ✅ Dynamic group member management (add/remove/leave)
- ✅ Group-aware message delivery and receipt tracking
- ✅ Dedicated group conversation UI with real-time updates
- ✅ Group settings and administration interface

**Enhanced Messaging:**
- ✅ Unified text and media message support
- ✅ Per-message TTL selection with user defaults
- ✅ Cross-platform compatibility (Expo Web + React Native)
- ✅ Responsive design with web optimizations

**Technical Infrastructure:**
- ✅ Firebase Authentication and Firestore integration
- ✅ Comprehensive security rules with participant validation
- ✅ Friend system with request/accept workflow
- ✅ Analytics scaffolding (Firebase Analytics + console logging)

### 🔮 **SCAFFOLDED - Phase 2 Preparation**

**LLM/AI Integration Preparation:**
- 🔮 Complete `Summary` data model with moderation metadata
- 🔮 LLM configuration constants (30-token limit, 5s timeout)
- 🔮 Message flags for summary generation (`hasSummary`, `ephemeralOnly`)
- 🔮 Database security rules for `summaries` and `ragChunks` collections
- 🔮 RAG system hooks in conversation model (`messageCount`, `lastRAGUpdateAt`)

### ⚠️ **KNOWN ISSUES**

**Group Chat TTL Extension:**
- **Issue**: Offline participants can artificially extend message TTL
- **Impact**: Messages persist longer than intended when group members are offline
- **Status**: Documented in `GROUP_CHAT_KNOWN_ISSUES.md`, acceptable for Phase 1
- **Solutions**: Multiple approaches under consideration for Phase 2

**Analytics Gaps:**
- **Missing Events**: `expired_unopened`, `ttl_selected`, `summary_generated`, `moderation_flagged`
- **Platform Limitation**: Firebase Analytics web-only, console logging on mobile
- **Dashboard**: BigQuery export and Looker dashboard not yet implemented

### 🚀 **NEXT PHASE - AI Integration**

**Phase 2 Priority Order:**
1. **OpenAI API Integration** - Summary generation pipeline
2. **Content Moderation** - Automated safety filtering  
3. **RAG System** - Vector database and semantic search
4. **Summary UI Components** - Client-side summary display
5. **Analytics Completion** - Missing events and dashboard

**Technical Readiness:**
- **Database Schema**: 100% ready for Phase 2
- **Security Rules**: Pre-configured for AI features
- **Integration Points**: Message interface fully prepared
- **Configuration**: LLM constants and timeouts defined

## 16. Open Questions

1. Which jurisdictions require age‑gating for disappearing‑media apps?

---

## 17. Implementation Blueprint – Phase 1 (Core Snapchat‑like Features)

> **Note:** Tasks assume the existing React Native + Firebase codebase ([https://github.com/G‑Jeffreys/my-app](https://github.com/G‑Jeffreys/my-app)) is the starting point. Each task can be tracked as a Jira epic → story → engineering sub‑tasks.

### 17.1 Foundation & Tooling

| Task                         | Sub‑tasks                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **T0 – Repo & CI Bootstrap** | 1. Fork template repo.2. Set up GitHub Actions (lint, Jest, TypeScript check, Detox).3. Configure Firebase project (dev, staging, prod).                           |
| **T1 – Data Models & Rules** | 1. Define `users`, `friends`, `messages`, `receipts` collections.2. Write Firestore Security Rules (sender/recipient only).3. Add unit tests using Emulator Suite. |

### 17.2 Friend System

| Task                         | Sub‑tasks                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **T2 – Friend Requests**     | 1. UI flow (search, send request, accept).2. Cloud Function: auto‑create reciprocal friend docs.3. Push notification on acceptance. |
| **T3 – Presence & Blocking** | 1. Online status via Realtime DB.2. Block list enforcement in rules.                                                                |

### 17.3 Messaging & Ephemerality

| Task                          | Sub‑tasks                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T4 – Send Message/Media**   | 1. Capture photo/video (≤10 s) component.2. Upload blob to Storage; create `messages/{id}` doc (fields: senderId, mediaURL, mediaType, ttlPreset, sentAt). |
| **T5 – Delivery & Receipt**   | 1. FCM push with message ID.2. On download complete, write `receipts/{userId}` with `receivedAt` (serverTimestamp).                                        |
| **T6 – Client Countdown UI**  | 1. `useCountdown` hook (expiresAt).2. Overlay timer on thumbnails.3. Accessibility: announce remaining seconds.                                            |
| **T7 – Missed Snap Handling** | 1. At expiration, replace media with placeholder (`MissedSnapCard`).2. Toast first‑time explanation.3. Track `media_missed` event.                         |
| **T8 – TTL Presets**          | 1. Settings screen with default preset.2. Per‑message selector carousel (30 s–24 h list).3. Validate client & server‑side.                                 |
| **T9 – Cleanup Pipeline**     | 1. Scheduled Cloud Function (hourly) queries for expired blobs.2. Delete Storage object + Firestore doc.3. Emit `cleanup_success` metric.                  |

### 17.4 Observability & Quality

| Task                   | Sub‑tasks                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **T10 – Analytics**    | 1. Fire `media_sent`, `media_received`, `opened`, `expired_unopened`, `ttl_selected` events.2. BigQuery export & Looker dashboard. |
| **T11 – Testing & QA** | 1. Unit tests for hooks & utils.2. Detox E2E: send/receive flow, expiration timing.3. Beta feedback survey (Qualtrics).            |

### 17.5 Stretch Goals

| Stretch               | Sub‑tasks                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **S‑A Stories**       | 1. New `stories` collection (24 h TTL fixed).2. Horizontal story tray UI.3. Viewer list & analytics.                                      |
| **S‑B Group Chat**    | 1. `conversations` doc with `participantIds` array.2. Gossip‑based receipts per member.3. Group name & avatar edit.                       |
| **S‑C Basic Filters** | 1. Integrate `react‑native‑vision‑camera` frame processors.2. Implement color LUT filters (vintage, noir).3. Toggle UI in capture screen. |
| **S‑D Group Member Management** | 1. "Add Member" UI in group settings screen.2. Update `participantIds` array in existing conversations.3. Handle receipt creation for new members joining existing conversations.4. Implement "Remove Member" and "Leave Group" functionality.5. Notifications for group membership changes. |

### 17.6 Timeline Estimate (Engineering Person‑Weeks)

| Task Block     | Est. PW |
| -------------- | ------- |
| T0‑T1          | 2       |
| T2‑T3          | 3       |
| T4‑T9          | 8       |
| T10‑T11        | 2       |
| **Core Total** | **15**  |
| S‑A            | 3       |
| S‑B            | 4       |
| S‑C            | 2       |
| S‑D            | 3       |

---

End of PRD

