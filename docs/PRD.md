# Product Requirements Document (PRD)

## Document Control

- **Version:** 2.0 (Updated for LLM-First Implementation)
- **Author:** AI Assistant (updated based on current implementation)
- **Last Updated:** December 2024

---

## 1. Purpose & Background

A next-generation social media platform that revolutionizes ephemeral content sharing through **intelligent AI summaries**. Unlike Snapchat and other disappearing content platforms, every photo, video, and message generates smart, context-aware summaries that preserve the essence of shared moments while maintaining complete media privacy. This "smart ephemeral" approach gives users the freedom to share authentically knowing their memories are intelligently preserved, without the anxiety of permanent digital footprints.

**Target Market**: Gen Z and millennial social media users who want the spontaneity of ephemeral sharing with the intelligence of AI-powered memory preservation.

**Current Status**: Core social platform (Phase 1) is **fully implemented**. Advanced AI social features (Phase 2) are **scaffolded and ready for activation**.

---

## 2. Goals & Success Metrics

| Goal                                | Metric                                         | Target (90 days post‑AI launch) |
| ----------------------------------- | ---------------------------------------------- | -------------------------------- |
| **Social Content Sharing**          | Daily posts/shares per active user            | ≥ 12                             |
| **AI Memory Engagement**            | Users viewing AI summaries weekly             | ≥ 80%                            |
| **Smart Content Discovery**         | Users finding memories via AI search          | ≥ 60% weekly                     |
| **Social Group Activity**           | Group sharing sessions per user/week          | ≥ 5                              |
| **Platform Stickiness**             | 7-day retention rate                          | ≥ 75%                            |
| **AI Processing Performance**       | P95 summary generation time                    | ≤ 3s                             |
| **Content Safety**                  | Harmful content blocked before delivery       | ≥ 98%                            |

---

## 3. Implementation Status & Phased Approach

### ✅ Phase 1 – Core Social Platform (COMPLETED)

**Status**: **FULLY IMPLEMENTED AND DEPLOYED**

1. **✅ Visual Content Sharing** - Photos, videos ≤10s, text posts with Firebase Storage + Firestore
2. **✅ Ephemeral Timeline** - Client-side TTL with `expiresAt = receivedAt + TTL`
3. **✅ Content Lifespan Control** - Complete preset system (30s to 24h) with user preferences
4. **✅ Content Expiration** - Grey placeholder "Missed content" for expired posts
5. **✅ Automated Cleanup** - Cloud Function purges expired content every 10 minutes
6. **✅ Group Social Features** - Full group sharing with dedicated social spaces
7. **✅ Social Analytics** - User engagement tracking with Firebase Analytics

**Beyond Core Requirements**:
- **Advanced Group Dynamics**: Member management, group settings, real-time social interactions
- **Smart Content Preservation**: Preserves content metadata for AI summary generation
- **Cross-Platform Design**: Mobile-first with responsive web optimization

### 🔮 Phase 2 – AI-Powered Intelligence (READY FOR ACTIVATION)

**Status**: **EXTENSIVELY SCAFFOLDED - 95% IMPLEMENTATION READY**

1. **🔮 LLM Summary Generation** - Complete OpenAI integration for text and image content
2. **🔮 RAG-Enhanced Context** - Full Pinecone vector database with semantic search
3. **🔮 Content Moderation** - OpenAI Moderation API with vision safety for images
4. **🔮 Smart UI Components** - Summary display with context indicators
5. **🔮 Conversation Search** - Semantic search across message history

**Activation Requirements**: OpenAI API key configuration only

**Current Limitations**: Video content receives basic placeholder summaries only (no vision model integration)

---

## 4. Target Audience

- **Primary**: Gen Z and younger millennials (13-34 years old) who value visual social sharing with privacy
- **Secondary**: Social media users seeking intelligent content discovery without permanent storage
- **Demographics**: 
  - Mobile-first users comfortable with emerging technology
  - Daily social media sharers who communicate primarily through visual content
  - Privacy-conscious but social - want to share moments without permanent digital footprint
  - Friends and close social circles as primary sharing audience
- **Use Cases**: 
  - Daily social moments and visual storytelling
  - Friend-to-friend social sharing with smart memory
  - Group hangouts and social coordination
  - Visual communication that's more intelligent than traditional disappearing content

---

## 5. User Stories (Social Media + AI-Focused)

The focus is on AI-powered social features that enhance ephemeral content sharing and discovery.

### Epic SOCIAL – Smart Ephemeral Sharing

| User Story ID | Story                                                                                                                                                  | Acceptance Criteria                                              | Implementation Status |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------- |
| **SOC1**       | *As a social media user*, I can share photos and videos with friends that disappear but leave intelligent summaries of what we shared.  | Content expires on schedule, AI summary appears with context indicator  | 🔮 **READY TO ACTIVATE** |
| **SOC2**       | *As a content creator*, I can post to my story/friends with the confidence that AI will capture the key moments even after content disappears.                                    | Stories generate smart summaries that preserve social context            | 🔮 **READY TO ACTIVATE** |
| **SOC3**       | *As a friend*, I can look back at our shared memories through AI summaries without having permanent photo storage cluttering my device.                             | Memory timeline shows AI-generated summaries of past shared moments          | 🔮 **READY TO ACTIVATE** |
| **SOC4**       | *As a group member*, when someone shares content in our group, I get intelligent summaries that understand our ongoing conversations and inside jokes.                | Group context enhances summary quality with relationship awareness   | 🔮 **READY TO ACTIVATE** |
| **SOC5**       | *As a privacy-conscious sharer*, I can disable AI processing for ultra-sensitive content while keeping normal social sharing smart.                        | "Fully Ephemeral" toggle bypasses all AI processing | ⚠️ **CURRENT LIMITATION** |

### Epic DISCOVERY – Intelligent Content Search

| User Story ID | Story                                                                                                                                    | Acceptance Criteria                                                       | Implementation Status |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- |
| **DISC1**      | *As a social user*, I can search "that funny video Tom shared last week" and find relevant content through AI understanding.          | Natural language search returns ranked results with social context                   | 🔮 **READY TO ACTIVATE** |
| **DISC2**      | *As a friend*, I can ask "what did we share about the concert?" and get AI answers about our shared experiences.                        | Conversational search interface returns contextual answers with sources          | 🔮 **READY TO ACTIVATE** |
| **DISC3**      | *As a group member*, AI summaries reference our shared experiences so "remember that place we went" becomes "that coffee shop downtown we visited".                       | Context-aware summaries resolve social references with 85%+ accuracy   | 🔮 **READY TO ACTIVATE** |
| **DISC4**      | *As a frequent sharer*, the app learns my social patterns to generate better summaries of my content over time.                    | Personalized AI improves summary relevance based on sharing history | 🔮 **READY TO ACTIVATE** |

### Epic SAFETY – Social Content Protection

| User Story ID | Story                                                                                                                 | Acceptance Criteria                                                  | Implementation Status |
| ------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------- |
| **SAFE1**      | *As a platform user*, harmful content is automatically blocked before my friends see it, keeping our social space positive.           | 98%+ harmful content detection with minimal false positives             | 🔮 **READY TO ACTIVATE** |
| **SAFE2**      | *As a content creator*, if my post is flagged, I get clear feedback on why and how to share appropriately.   | User-friendly moderation feedback with educational guidance         | 🔮 **READY TO ACTIVATE** |
| **SAFE3**      | *As a social group*, our AI summaries filter out inappropriate references while preserving the fun and context of our conversations.   | Smart content filtering maintains social context while ensuring safety | 🔮 **READY TO ACTIVATE** |

### Epic SOCIAL_INTELLIGENCE – Next-Gen Social Features

| User Story ID | Story                                                                                                                    | Acceptance Criteria                                                | Implementation Status |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------- |
| **SI1**    | *As a social media user*, I can see which of my friends are most active in sharing and get suggestions for who to share with.          | Friend activity insights and sharing suggestions               | 🔮 **READY TO ACTIVATE** |
| **SI2**    | *As a content viewer*, I can tell which summaries used advanced social context vs. basic AI by visual indicators.            | Social context indicators (👥 for group context, 🧠 for AI-enhanced)    | 🔮 **READY TO ACTIVATE** |
| **SI3**    | *As an engaged user*, I can give feedback on AI summaries to help improve the social understanding of my friend group.            | Social feedback collection improves group-specific AI performance              | 🔮 **READY TO ACTIVATE** |

---

## 6. Functional Requirements

### 6.1 Phase 1 (COMPLETED)

| FR‑ID | Description                                                                                                                | Priority | Status |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR‑1  | The system shall start TTL countdown at `receivedAt` timestamp.                                                           | Must     | ✅ **IMPLEMENTED** |
| FR‑2  | The system shall hide media after `expiresAt` locally without server round‑trip.                                          | Must     | ✅ **IMPLEMENTED** |
| FR‑3  | The system shall show a "Missed" placeholder once media expires unopened.                                                 | Must     | ✅ **IMPLEMENTED** |
| FR‑4  | The server shall mark messages as expired while preserving documents for AI access.                                       | Must     | ✅ **IMPLEMENTED** |
| FR‑5  | The system shall allow TTL selection from presets (30s to 24h) with user-configurable defaults.                         | Must     | ✅ **IMPLEMENTED** |
| FR‑6  | The system shall support group messaging with unified TTL logic and dedicated conversation UI.                           | Must     | ✅ **IMPLEMENTED** |
| FR‑7  | The system shall track receipts per participant for accurate group TTL calculation.                                       | Must     | ✅ **IMPLEMENTED** |

### 6.2 Phase 2 (LLM Features - READY FOR ACTIVATION)

| FR‑ID | Description                                                                                      | Priority | Status |
| ----- | ------------------------------------------------------------------------------------------------ | -------- | ------ |
| FR‑8  | The system shall generate ≤20-token summaries for text and image content using RAG-enhanced context. | Must     | 🔮 **SCAFFOLDED** |
| FR‑9  | Summaries shall persist indefinitely with confidence scoring and context metadata.              | Must     | 🔮 **SCAFFOLDED** |
| FR‑10 | The system shall block delivery if content fails AI moderation (OpenAI + Vision APIs for images). | Must     | 🔮 **SCAFFOLDED** |
| FR‑11 | The client shall render summaries with RAG indicators and interactive action sheets.            | Must     | 🔮 **SCAFFOLDED** |
| FR‑12 | The system shall provide semantic search across conversation history via natural language.      | Should   | 🔮 **SCAFFOLDED** |
| FR‑13 | AI shall resolve pronouns and context references using conversation history (85% accuracy).     | Should   | 🔮 **SCAFFOLDED** |
| FR‑14 | Video messages shall receive basic placeholder summaries pending video analysis implementation (see Section 14 - Stretch Goals for intelligent video summaries).  | Should   | ⚠️ **LIMITED** |

### 6.3 Stretch Goals (Future Implementation)

| FR‑ID | Description                                                                                      | Priority | Status |
| ----- | ------------------------------------------------------------------------------------------------ | -------- | ------ |
| FR‑15 | The system shall generate intelligent video summaries using vision models for scene analysis and action recognition. | Could    | 🎯 **STRETCH GOAL** |
| FR‑16 | Video summaries shall include temporal understanding, object detection, and social context integration. | Could    | 🎯 **STRETCH GOAL** |
| FR‑17 | The system shall provide vision-based content moderation for video streams with 98%+ accuracy. | Could    | 🎯 **STRETCH GOAL** |
| FR‑18 | The system shall deliver real-time push notifications within 5 seconds of content sharing. | Could    | 🎯 **STRETCH GOAL** |
| FR‑19 | Push notifications shall use AI-powered prioritization based on social relationships and engagement patterns. | Could    | 🎯 **STRETCH GOAL** |
| FR‑20 | The system shall provide granular notification privacy controls and intelligent batching to prevent notification fatigue. | Could    | 🎯 **STRETCH GOAL** |

---

## 7. Non‑Functional Requirements

| Category         | Requirement                                                                            | Current Status |
| ---------------- | -------------------------------------------------------------------------------------- | -------------- |
| **AI Performance** | Summaries available within 3s P95; RAG context retrieval within 500ms              | 🔮 **CONFIGURED** |
| **Cost Control**   | LLM costs ≤ US$2/DAU with 20-token limit and batch processing                       | 🔮 **CONFIGURED** |
| **Reliability**    | 99.9% message delivery success with graceful AI failure handling                    | ✅ **IMPLEMENTED** |
| **Privacy**        | AI processing with conversation-scoped data isolation and user consent             | 🔮 **CONFIGURED** |
| **Scalability**    | Vector search supporting 10K+ conversations with sub-second response times         | 🔮 **CONFIGURED** |

---

## 8. Technical Architecture (Current Implementation)

```
React Native/Expo Web ──► Firebase Auth ──► Firestore Collections:
                        │                   ├── users/{userId}
                        │                   ├── conversations/{conversationId}
                        │                   ├── messages/{messageId}
                        │                   ├── receipts/{receiptId}
                        │                   ├── summaries/{summaryId} [READY]
                        │                   └── ragChunks/{chunkId} [READY]
                        │
                        ├─► Firebase Storage (/messages/{filename})
                        │
                        └─► Cloud Functions:
                            ├── acceptFriendRequest
                            ├── cleanupExpiredMessages (10min schedule)
                            └── triggerSummaryGeneration [READY]

AI Processing Pipeline (SCAFFOLDED):
Message Created ──► Cloud Tasks ──► Cloud Run Worker ──► AI Processing:
                                                        ├── OpenAI Moderation
                                                        ├── RAG Context Retrieval (Pinecone)
                                                        ├── Enhanced Summary Generation
                                                        └── Vector Embedding Storage
```

**Key Infrastructure Components**:
- **OpenAI Integration**: GPT-4o-mini for summaries, text-embedding-3-small for RAG
- **Pinecone Vector DB**: Conversation-scoped namespaces with 1536-dimension embeddings  
- **Cloud Run Worker**: Complete moderation and summarization pipeline
- **Firebase Security**: Pre-configured rules for all LLM collections

---

## 9. Analytics & Observability

### ✅ Implemented Social Events
- `content_shared`, `content_received`, `content_viewed`
- `friend_request_sent`, `friend_request_accepted`
- `group_joined`, `group_content_shared`
- `user_signup`, `daily_active_session`

### 🔮 Ready for AI Social Launch
- `ai_summary_generated`, `ai_summary_viewed`, `memory_accessed`
- `social_search_performed`, `content_discovery_success`
- `group_context_enhanced`, `social_reference_resolved`
- `content_moderation_flagged`, `user_feedback_provided`

**Dashboards**: BigQuery export configured for social engagement metrics, AI cost tracking, and content discovery analytics.

---

## 10. Dependencies (Current Status)

- ✅ **Firebase Blaze Plan** - Active and configured
- 🔮 **OpenAI API Access** - Integration built, key needed
- 🔮 **Pinecone Account** - Vector DB configured, key needed  
- ✅ **Cloud Run Infrastructure** - Deployed and ready

---

## 11. Updated Timeline

| Milestone                    | Target Date  | Status |
| ---------------------------- | ------------ | ------ |
| ✅ **M1 – Phase 1 Complete** | June 2024    | ✅ **COMPLETED** |
| 🎯 **M2 – LLM Feature Launch** | January 2025 | 🔮 **READY** |
| 🚀 **M3 – RAG Enhancement**   | February 2025| 🔮 **READY** |
| 📊 **M4 – AI Analytics GA**   | March 2025   | 🔮 **PLANNED** |

**Acceleration**: Project is **6+ months ahead** of original timeline due to comprehensive Phase 2 scaffolding.

---

## 12. Success Criteria for AI Social Features Launch

1. **Smart Content Processing**: 95% of shared photos and posts receive AI summaries within 3s of expiration
2. **Social Context Understanding**: 85% accuracy in resolving social references and group dynamics  
3. **Memory Engagement**: 60% of users regularly view and interact with AI-generated memory summaries
4. **Social Discovery**: 40% of users use AI search to find shared content within first week
5. **Platform Adoption**: 75% 7-day retention rate with AI features active
6. **Content Safety**: 98% harmful content detection before friends see it

**Note**: Success criteria apply to photos, text posts, and stories. Video content currently receives basic placeholder summaries pending advanced video analysis implementation (see Section 14 - Stretch Goals for intelligent video summaries and push notifications).

---

## 13. Risk Mitigation

| Risk                               | Mitigation Strategy                                                    | Status |
| ---------------------------------- | ---------------------------------------------------------------------- | ------ |
| **OpenAI API Cost Spike**          | 20-token limit, batch processing, cost alerting                      | 🔮 **CONFIGURED** |
| **RAG Context Quality**            | Confidence scoring, fallback to basic summaries                      | 🔮 **IMPLEMENTED** |
| **Moderation False Positives**     | Human review queue, appeal process                                    | 🔮 **CONFIGURED** |
| **Vector Search Performance**      | Conversation-scoped namespaces, optimized embedding dimensions       | 🔮 **IMPLEMENTED** |

---

## 14. Stretch Goals

### 🎯 **Video Summaries with Vision Models**

**Priority**: High-value enhancement for complete AI-powered content understanding

**Description**: Implement intelligent video content analysis using advanced vision models to generate contextual summaries of video content, replacing current basic placeholder summaries.

#### User Stories
| User Story ID | Story | Acceptance Criteria | Implementation Status |
| ------------- | ----- | ------------------- | -------------------- |
| **VID1** | *As a content creator*, I can share videos knowing AI will capture key visual moments and actions in intelligent summaries | Video summaries include scene description, action recognition, and object detection | 🎯 **STRETCH GOAL** |
| **VID2** | *As a friend*, I can search for "that video where we were at the beach" and find relevant video content through AI vision understanding | Vision-based search accurately identifies video content and scenes | 🎯 **STRETCH GOAL** |
| **VID3** | *As a group member*, AI video summaries understand our shared activities and reference previous video conversations | Video summaries include social context and activity recognition | 🎯 **STRETCH GOAL** |
| **VID4** | *As a privacy-conscious user*, video content moderation automatically detects inappropriate visual content before sharing | Vision-based content moderation with 98%+ accuracy for video | 🎯 **STRETCH GOAL** |

#### Technical Requirements
- **Vision Model Integration**: GPT-4V or specialized video analysis models for frame-by-frame understanding
- **Video Processing Pipeline**: Keyframe extraction, scene segmentation, and temporal analysis
- **Enhanced Moderation**: Computer vision-based content safety for video streams
- **Performance Targets**: Video summary generation within 10s P95 for ≤10s videos

#### Implementation Approach
1. **Phase 1**: Keyframe extraction and static image analysis of video frames
2. **Phase 2**: Temporal video analysis for action and movement recognition  
3. **Phase 3**: Advanced scene understanding and social context integration
4. **Phase 4**: Real-time video processing for live content analysis

### 📱 **Push Notifications**

**Priority**: Essential for user engagement and real-time social interaction

**Description**: Implement intelligent push notification system that respects ephemeral content privacy while maximizing social engagement and timely content delivery.

#### User Stories
| User Story ID | Story | Acceptance Criteria | Implementation Status |
| ------------- | ----- | ------------------- | -------------------- |
| **PUSH1** | *As a social user*, I receive immediate notifications when friends share content, ensuring I don't miss ephemeral moments | Real-time push notifications with <5s delivery time | 🎯 **STRETCH GOAL** |
| **PUSH2** | *As a friend*, I get smart notifications that prioritize close friends and active conversations without overwhelming me | AI-powered notification prioritization based on social graph | 🎯 **STRETCH GOAL** |
| **PUSH3** | *As a group member*, I receive group-specific notifications for shared content with intelligent batching to avoid spam | Group notification management with customizable settings | 🎯 **STRETCH GOAL** |
| **PUSH4** | *As a content creator*, I can see delivery confirmations and know when friends have been notified about my shared content | Notification delivery tracking and analytics | 🎯 **STRETCH GOAL** |
| **PUSH5** | *As a privacy-focused user*, I can customize notification content to balance engagement with privacy preferences | Granular notification privacy controls and content masking | 🎯 **STRETCH GOAL** |

#### Notification Types
- **Immediate Social**: New content from close friends (highest priority)
- **Group Activity**: Group conversations and shared moments (medium priority)  
- **Memory Insights**: AI-generated summaries and memory discoveries (low priority)
- **System Updates**: Friend requests, content expiration warnings (as needed)

#### Technical Requirements
- **Multi-Platform Support**: iOS APNs, Android FCM, and web push notifications
- **Intelligent Batching**: Group multiple notifications to prevent notification fatigue
- **Privacy-Preserving**: Notification content respects ephemeral content principles
- **Performance Targets**: 95% delivery success rate within 5 seconds

#### Implementation Approach
1. **Phase 1**: Basic push notification infrastructure with Firebase Cloud Messaging
2. **Phase 2**: Smart notification prioritization based on social relationships
3. **Phase 3**: AI-powered notification content optimization and batching
4. **Phase 4**: Advanced analytics and personalized notification strategies

### 🔗 **Integration with Core Platform**

Both stretch goals integrate seamlessly with existing architecture:

**Video Summaries**: Extend current AI processing pipeline to include video analysis workers
**Push Notifications**: Leverage existing social graph and engagement analytics for intelligent delivery

**Resource Requirements**: Additional OpenAI API costs for vision models, Firebase Cloud Messaging setup, enhanced Cloud Run compute for video processing

**Success Metrics**:
- Video summaries: 80% user satisfaction with video content understanding
- Push notifications: 40% increase in content engagement within first hour of sharing

---

## 15. Out‑of‑Scope (Current Version)

### **Not Currently Implemented**
- **Advanced Video Content Analysis**: Intelligent video summarization beyond basic placeholders (see Section 14 - Stretch Goals)
- **Push Notification System**: Real-time user engagement notifications (see Section 14 - Stretch Goals)
- **Video Frame Extraction**: Keyframe analysis for video content understanding
- **Advanced Video Moderation**: Vision-based analysis of video content streams

### **Future Considerations Beyond Stretch Goals**
- Advanced conversation analytics dashboard
- Multi-language AI support  
- Voice message transcription and analysis
- Custom AI model training for personalized content understanding
- Real-time collaborative content creation

**Note**: Core ephemeral messaging and group chat features are **fully implemented and production-ready**. AI features are ready for text and image content, with video content receiving basic placeholder summaries pending stretch goal implementation.

---

## 15. Activation Checklist for AI Social Features

### Immediate (< 1 day)
- [ ] Configure OpenAI API key in Cloud Functions environment
- [ ] Configure Pinecone API key and index settings  
- [ ] Enable Cloud Tasks queue for social content summarization
- [ ] Activate content moderation pipeline for social posts and images

### Short-term (< 1 week)  
- [ ] Deploy updated Cloud Run worker with AI social features (photos/posts)
- [ ] Enable AI memory summary UI components in social feeds
- [ ] Configure social engagement monitoring and cost alerts
- [ ] Begin user testing with AI features for social content sharing

### Medium-term (< 1 month)
- [ ] Implement social feedback collection for AI summaries
- [ ] Launch social content discovery interface
- [ ] Deploy comprehensive social AI analytics dashboard
- [ ] Scale to full social media user base

### Future Social Development (Stretch Goals - See Section 14)
- [ ] **Video Summaries with Vision Models**: Implement video frame extraction and intelligent video content analysis
- [ ] **Video AI Integration**: Deploy video-specific AI models for intelligent video story summarization  
- [ ] **Push Notifications**: Implement real-time notification system with smart prioritization
- [ ] **Enhanced Video Moderation**: Deploy vision-based content moderation pipeline for video streams
- [ ] Add AI-powered friend and content recommendations

The project is uniquely positioned for **rapid AI social feature deployment** with comprehensive social platform infrastructure already in place.

