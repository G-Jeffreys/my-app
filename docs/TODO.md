# Technical Debt & Implementation Progress

This document tracks tasks that were intentionally skipped to prioritize core functionality, plus our current major feature implementation.

## Completed Tasks
- **[X] T10.1 - Analytics Events:** Fire `media_sent`, `media_received`, `opened`, `expired_unopened`, `ttl_selected` events.

## Current Implementation Sprint - Course Corrections

### Phase 1: Core TTL Corrections & T8/T9 Completion ✅ COMPLETED
- **[X] 1.1 - Fix TTL Logic:** Move TTL countdown from `sentAt` to `receivedAt` (client-side only)
  - [X] Update `useCountdown` hook to use `receivedAt` timestamp
  - [X] Implement receipt tracking system for `receivedAt` 
  - [X] Update `MessageItem` component to use new logic
  - [X] Remove server-side TTL calculation dependencies
- **[X] 1.2 - T8: TTL Presets Implementation:** Settings screen with default preset + per-message selector
  - [X] Add TTL preset selector to settings screen
  - [X] Create per-message TTL selector UI component
  - [X] Add client & server-side validation for TTL presets
  - [X] Update message creation flow to use selected TTL
- **[X] 1.3 - T9: Cleanup Pipeline Fix:** Update server cleanup to use proper timing
  - [X] Modify Cloud Function to use `receivedAt + TTL` instead of `sentAt + TTL`
  - [X] Add proper handling for multiple recipients with different `receivedAt` times
  - [X] Add `cleanup_success` metric emission
- **[X] 1.4 - Database Schema Updates:** Prepare for new features
  - [X] Update `Message` interface for text integration
  - [X] Add `receipts` collection proper implementation
  - [X] Create database migration plan (wipe + restart)

### Phase 2: Enhanced Messaging & Group Chats ⚠️ IN PROGRESS
- **[X] 2.1 - Text Messaging Enhancement:** Full integration with TTL system
  - [X] Create text message composition UI
  - [X] Integrate text messages with same TTL/friend system
  - [X] Update security rules for text message access
- **[X] 2.2 - Group Chat Message Delivery Logic:** Backend support for group messaging
  - [X] Design `conversations` collection schema
  - [X] Enhanced message fetching for both individual + group messages
  - [X] Group message creation with proper receipt generation
  - [X] Group TTL logic (cleanup only when ALL participants expire)
  - [X] Updated TextMessageComposer for group support
  - [X] Updated select-friend screen for group recipients
  - [X] Cloud Function cleanup handles group messages properly
  - [X] Update Firestore security rules for group access
  - [X] Implement group-specific receipt tracking
- **[X] 2.3 - Group Chat UI Implementation:** Frontend for group management
  - [X] Implement group creation and management UI (`create-group.tsx`)
  - [X] Add group selection in camera/text flows (updated `select-friend.tsx`)
  - [X] Group conversation list and management screen (`groups.tsx`)
  - [X] Enhanced home screen with groups quick action
  - [X] Complete group workflow: create → manage → message → TTL

### Phase 3: Future-Proofing for LLM/RAG 🔮 LOW PRIORITY
- **[ ] 3.1 - LLM Summary Pipeline Architecture:** 
  - [ ] Add `summaries` collection schema
  - [ ] Create OpenAI API integration scaffolding
  - [ ] Design message → summary pipeline hooks
  - [ ] Add summary persistence and UI display
- **[ ] 3.2 - RAG System Preparation:** Group chat context chunking
  - [ ] Design RAG chunks collection schema
  - [ ] Add message batching logic for groups (every ~20 messages)
  - [ ] Create vector store integration scaffolding
  - [ ] Add low-resolution summary generation hooks

## Previously Skipped Tasks (Still Pending)
- **[ ] T2.3 – Push notification on acceptance:** Implement a push notification to be sent to the user who originally sent the friend request once it has been accepted.
- **[ ] T10.2 – BigQuery export & Looker dashboard:** Set up BigQuery export for analytics data and create a Looker dashboard for visualization.

## Database Migration Plan
🚨 **BREAKING CHANGE**: We will wipe the current database to implement proper schema for:
- Enhanced message structure with text support
- Receipt tracking for proper TTL timing
- Group conversation support
- Future LLM summary collections

**Impact**: Current test messages (10 or so) will be lost - this is acceptable per user confirmation. 