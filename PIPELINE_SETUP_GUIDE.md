# 🚀 AI Pipeline Setup Guide

## 📋 Required Environment Variables

Add these to your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Pinecone Configuration  
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=snaps-prod

# Cloud Tasks Configuration (already set)
TASK_QUEUE_LOCATION=us-central1
MODERATION_TASK_QUEUE_NAME=moderate-summary-queue
MODERATION_WORKER_URL=https://moderation-worker-435345795137.us-central1.run.app
```

## 🎯 Setup Steps

### 1. Configure Environment Variables
- Add the above variables to your `.env` file
- Make sure you have valid OpenAI and Pinecone API keys

### 2. Create Pinecone Index
```bash
# You'll need to create a Pinecone index named 'snaps-prod' 
# with dimensions: 1536 (for text-embedding-3-small)
# metric: cosine
```

### 3. Update Cloud Run Service
```bash
# Run this after setting up your .env file:
./setup_cloud_run_env.sh
```

### 4. Test the Pipeline
```bash
# Run comprehensive pipeline test:
./test_ai_pipeline.sh
```

## 🔍 What Happens in the Pipeline

1. **Message Created** → Firebase Function triggered
2. **enqueueModerationJob** → Creates Cloud Tasks job
3. **Cloud Run Worker** → Processes the job:
   - Fetches message from Firestore
   - Optional image captioning (GPT-4o-vision)
   - Content moderation (OpenAI Moderation API)
   - If flagged: blocks message, stores in moderation collection
   - If safe: generates summary (GPT-4o-mini)
   - Stores summary in Firestore
   - Creates embedding and stores in Pinecone
   - Marks message as delivered

## 📊 Expected Results

**Successful Processing:**
- Message marked as `delivered: true, summaryGenerated: true`
- Summary created in `/summaries/{messageId}`
- Embedding stored in Pinecone namespace by conversationId
- Analytics events logged

**Blocked Content:**
- Message marked as `blocked: true, delivered: false`
- Moderation data stored in `/moderation/{messageId}`
- No summary generated

## 🧪 Testing

The failed task from our earlier test (ID: 45559775767233198821) will automatically retry once the environment variables are configured!

You can also send new test messages through the app to trigger fresh pipeline runs.
