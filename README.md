# SnapConnect - Ephemeral Messaging App

**A mobile chat application inspired by Snapchat where media disappears after a countdown that starts upon delivery (receipt) rather than on open.** Future Phase 2 will add persistent LLM summaries using Retrieval-Augmented Generation and automated content moderation.

## 🚀 **Current Status: Phase 1 Complete**

✅ **Core ephemeral messaging with TTL system**  
✅ **Complete group chat implementation**  
✅ **Text and media messaging unified**  
✅ **Real-time receipt tracking and cleanup**  
🔮 **Phase 2 AI integration ready to begin**

---

## 📱 **Features**

### **Core Messaging**
- **Ephemeral Messages**: Photos, videos (≤10s), and text that disappear after configurable TTL
- **Smart TTL Logic**: Countdown starts on `receivedAt` (not `sentAt` or open)
- **TTL Presets**: 30s, 1m, 5m, 1h, 6h, 24h with user-configurable defaults
- **Missed Messages**: Gray placeholders for expired unopened content
- **Real-time Delivery**: Firebase-powered instant message delivery

### **Group Chat System**
- **Group Conversations**: Up to 5 participants with dedicated conversation views
- **Member Management**: Add/remove members, leave groups, group settings
- **Group-aware TTL**: Messages expire when ALL participants' TTLs complete
- **Real-time Updates**: Live conversation state with Firestore listeners

### **Enhanced UX**
- **Cross-platform**: Expo Web (development) + React Native (mobile target)
- **Responsive Design**: Web-optimized layouts with mobile-first approach
- **Friend System**: Send/accept friend requests, friend-only messaging
- **Receipt Tracking**: Comprehensive delivery and view confirmation system

---

## 🏗️ **Tech Stack**

| Area | Technology |
|------|------------|
| **Frontend** | React Native + Expo Router + NativeWind (Tailwind CSS) |
| **State Management** | Zustand + React hooks |
| **Backend** | Firebase (Auth + Firestore + Storage + Functions) |
| **Real-time** | Firestore listeners + real-time subscriptions |
| **Media Storage** | Firebase Storage with organized folder structure |
| **Analytics** | Firebase Analytics (web) + comprehensive console logging |
| **Deployment** | Expo Web + EAS Build ready |

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ and npm
- Expo CLI (`npm install -g @expo/cli`)
- Firebase project with Blaze plan (for Cloud Functions)

### **1. Clone and Install**
```bash
git clone <repository-url> snapconnect
cd snapconnect
npm install
```

### **2. Firebase Setup**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and select your project
firebase login
firebase use --add

# Deploy Firestore rules and indexes
firebase deploy --only firestore:rules,firestore:indexes

# Deploy Cloud Functions
cd functions
npm install
cd ..
firebase deploy --only functions
```

### **3. Environment Configuration**
Create `.env` in project root:
```env
# Firebase Config (get from Firebase Console > Project Settings)
EXPO_PUBLIC_FB_API_KEY=your_api_key_here
EXPO_PUBLIC_FB_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FB_PROJECT_ID=your_project_id
EXPO_PUBLIC_FB_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FB_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FB_APP_ID=1:123456789:web:abcdef123456
```

### **4. Start Development**
```bash
# Start Expo development server
npx expo start -c

# For web development
npx expo start --web

# For mobile (requires Expo Go app)
npx expo start
```

---

## 📁 **Project Structure**

```
snapconnect/
├── app/                          # Expo Router pages
│   ├── _layout.tsx              # Root navigation layout
│   ├── index.tsx                # Landing/redirect screen
│   ├── (auth)/                  # Public authentication stack
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (protected)/             # Auth-gated application stack
│       ├── _layout.tsx
│       ├── home.tsx             # Main message feed
│       ├── camera.tsx           # Photo/video capture
│       ├── preview.tsx          # Media preview with TTL selection
│       ├── compose-text.tsx     # Text message composition
│       ├── select-friend.tsx    # Friend/recipient selection
│       ├── friends.tsx          # Friend management
│       ├── add-friend.tsx       # Send friend requests
│       ├── groups.tsx           # Group conversation list
│       ├── create-group.tsx     # Group creation
│       ├── settings.tsx         # User settings and TTL defaults
│       ├── group-conversation/
│       │   └── [conversationId].tsx    # Group chat view
│       ├── group-settings/
│       │   └── [conversationId].tsx    # Group administration
│       └── add-group-member/
│           └── [conversationId].tsx    # Add members to existing group
│
├── components/                   # Reusable UI components
│   ├── Header.tsx               # Navigation header
│   ├── MessageItem.tsx          # Individual message display
│   ├── GroupMessageItem.tsx     # Group message with sender info
│   ├── InConversationComposer.tsx # In-chat message composition
│   ├── TextMessageComposer.tsx  # Standalone text composer
│   ├── TtlSelector.tsx          # TTL preset selection UI
│   ├── LoadingSpinner.tsx       # Loading states
│   ├── Toast.tsx                # Notification system
│   └── ConfirmDialog.tsx        # Confirmation modals
│
├── config/                      # Configuration files
│   └── messaging.ts             # TTL presets, group limits, LLM config
│
├── hooks/                       # Custom React hooks
│   ├── useCountdown.ts          # TTL countdown logic
│   └── useReceiptTracking.ts    # Message receipt management
│
├── lib/                         # Core utilities
│   ├── firebase.ts              # Firebase initialization
│   └── analytics.ts             # Analytics event tracking
│
├── models/firestore/            # TypeScript interfaces
│   ├── user.ts                  # User data model
│   ├── friend.ts                # Friend relationship model
│   ├── friendRequest.ts         # Friend request model
│   ├── conversation.ts          # Group conversation model
│   ├── message.ts               # Message data model
│   ├── receipt.ts               # Receipt tracking model
│   ├── summary.ts               # LLM summary model (Phase 2)
│   └── blockedUser.ts           # User blocking model
│
├── store/                       # Global state management
│   ├── useAuth.ts               # Authentication state
│   └── usePresence.ts           # User presence tracking
│
├── functions/                   # Firebase Cloud Functions
│   └── src/
│       └── index.ts             # Friend requests + TTL cleanup
│
├── docs/                        # Project documentation
│   ├── PRD.md                   # Product Requirements Document
│   ├── TODO.md                  # Implementation progress tracking
│   ├── REMAINING_TASKS.md       # Future roadmap
│   └── GROUP_CHAT_KNOWN_ISSUES.md # Known issues documentation
│
├── firestore.rules              # Database security rules
├── firestore.indexes.json       # Database indexes
├── storage.rules                # Storage security rules
└── env.ts                       # Type-safe environment variables
```

---

## 🔧 **Key Configuration Files**

### **TTL and Messaging Config** (`config/messaging.ts`)
```typescript
// TTL Presets - values in milliseconds
export const TTL_PRESETS = {
  '30s': 30 * 1000,
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
} as const;

// Group chat limits
export const GROUP_CHAT_LIMITS = {
  MAX_PARTICIPANTS: 5,
  MIN_PARTICIPANTS: 1, // Excluding creator
  MAX_NAME_LENGTH: 50,
} as const;

// Future LLM configuration (Phase 2)
export const LLM_CONFIG = {
  MAX_SUMMARY_TOKENS: 30,
  BATCH_SIZE_FOR_RAG: 20,
  SUMMARY_GENERATION_TIMEOUT_MS: 5000,
} as const;
```

### **Firebase Security Rules** (`firestore.rules`)
Comprehensive security rules supporting:
- User authentication and authorization
- Friend-only messaging restrictions
- Group participant validation
- Receipt tracking permissions
- Future AI feature preparation

---

## 🗄️ **Database Schema**

### **Core Collections**
- **`users/{userId}`** - User profiles with TTL defaults
- **`users/{userId}/friends/{friendId}`** - Friend relationships
- **`conversations/{conversationId}`** - Group chat metadata
- **`messages/{messageId}`** - All messages (individual + group)
- **`receipts/{receiptId}`** - Delivery and view tracking
- **`friendRequests/{requestId}`** - Global friend request queue

### **Future Collections (Phase 2)**
- **`summaries/{summaryId}`** - LLM-generated message summaries
- **`ragChunks/{chunkId}`** - RAG system conversation chunks

---

## ⚡ **Core Features Deep Dive**

### **TTL System**
1. **Client-side Countdown**: Real-time countdown using `useCountdown` hook
2. **Receipt Tracking**: `useReceiptTracking` manages delivery timestamps
3. **Server Cleanup**: Cloud Function runs every 10 minutes to delete expired content
4. **Group Logic**: Messages expire only when ALL participants' TTLs complete

### **Group Chat Architecture**
1. **Conversation-scoped**: Each group has dedicated conversation document
2. **Participant Management**: Dynamic add/remove with proper receipt handling
3. **Real-time Updates**: Firestore listeners for live conversation state
4. **Member Validation**: Security rules enforce participant permissions

### **Message Flow**
1. **Composition**: TTL selection → content creation → recipient selection
2. **Delivery**: Firebase Storage upload → Firestore document → receipt generation
3. **Display**: Real-time listeners → countdown UI → expiration handling
4. **Cleanup**: Server-side deletion based on receipt timestamps

---

## 🚀 **Deployment**

### **Development**
```bash
# Web development
npx expo start --web

# Mobile development (Expo Go)
npx expo start
```

### **Production Build**
```bash
# Configure EAS Build
npx expo install @expo/cli
eas build:configure

# Build for platforms
eas build --platform ios
eas build --platform android
eas build --platform web
```

### **Firebase Deployment**
```bash
# Deploy all Firebase resources
firebase deploy

# Deploy specific components
firebase deploy --only firestore:rules
firebase deploy --only functions
firebase deploy --only storage
```

---

## 🔮 **Phase 2 Roadmap: AI Integration**

### **Immediate Next Steps**
1. **OpenAI API Integration** - Message summary generation pipeline
2. **Content Moderation** - Automated safety filtering with confidence scoring
3. **RAG System** - Vector database integration for contextual summaries
4. **Summary UI** - Client-side summary display and interaction
5. **Analytics Completion** - Missing events and dashboard implementation

### **Technical Readiness**
- ✅ **Database Schema**: 100% ready for AI features
- ✅ **Security Rules**: Pre-configured for summaries and RAG
- ✅ **Integration Points**: Message flags and conversation hooks in place
- ✅ **Configuration**: LLM constants and timeouts defined

---

## 🐛 **Known Issues**

### **Group Chat TTL Extension**
- **Issue**: Offline participants can extend message TTL indefinitely
- **Impact**: Messages may persist longer than intended
- **Status**: Documented, acceptable for Phase 1
- **Solutions**: Multiple approaches under consideration for Phase 2

### **Analytics Gaps**
- **Missing Events**: `expired_unopened`, `ttl_selected`, `summary_generated`, `moderation_flagged`
- **Platform**: Firebase Analytics web-only, console logging on mobile
- **Dashboard**: BigQuery export and Looker dashboard not implemented

---

## 📚 **Documentation**

- **[Product Requirements Document](docs/PRD.md)** - Complete feature specifications
- **[Implementation Progress](docs/TODO.md)** - Detailed task tracking
- **[Future Roadmap](docs/REMAINING_TASKS.md)** - Phase 2 planning
- **[Known Issues](docs/GROUP_CHAT_KNOWN_ISSUES.md)** - Issue documentation

---

## 🤝 **Contributing**

1. **Development Setup**: Follow Quick Start guide
2. **Code Style**: TypeScript + ESLint + Prettier (configured)
3. **Testing**: Console logging throughout for debugging
4. **Documentation**: Update README and docs for significant changes

---

## 📄 **License**

This project is private and proprietary. All rights reserved.

---

**Built with ❤️ using React Native, Expo, and Firebase**

