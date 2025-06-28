#!/bin/bash
echo "🔧 Setting up Cloud Run environment variables..."

# Source environment variables from .env file if it exists
if [ -f .env ]; then
    echo "📁 Loading environment variables from .env..."
    export $(grep -v '^#' .env | xargs)
else
    echo "⚠️ .env file not found in current directory"
    exit 1
fi

# Check if required environment variables are set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY not found in environment"
    exit 1
fi

if [ -z "$PINECONE_API_KEY" ]; then
    echo "❌ PINECONE_API_KEY not found in environment"
    exit 1
fi

echo "✅ Environment variables loaded successfully"
echo "🔧 Updating Cloud Run service..."

# Update the Cloud Run service with environment variables
gcloud run services update moderation-worker \
  --region=us-central1 \
  --set-env-vars="OPENAI_API_KEY=${OPENAI_API_KEY},PINECONE_API_KEY=${PINECONE_API_KEY},PINECONE_INDEX_NAME=snaps-prod" \
  --quiet

echo "✅ Cloud Run service updated with environment variables"
echo "🔄 Testing pipeline..."

# Test the pipeline by checking the health endpoint
curl -s https://moderation-worker-435345795137.us-central1.run.app/health | jq '.'

echo "📋 Check if the failed task will retry automatically..."
gcloud tasks list --queue=moderate-summary-queue --location=us-central1
