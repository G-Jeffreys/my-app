#!/bin/bash
echo "🔍 Validating AI Pipeline Setup..."

# Check environment variables
echo "1️⃣ Checking environment variables..."
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY not set"
else
    echo "✅ OPENAI_API_KEY configured"
fi

if [ -z "$PINECONE_API_KEY" ]; then
    echo "❌ PINECONE_API_KEY not set"
else
    echo "✅ PINECONE_API_KEY configured"
fi

# Check Cloud Run service
echo -e "\n2️⃣ Checking Cloud Run service..."
curl -s https://moderation-worker-yyaoaphbjq-uc.a.run.app/health | jq '.'

# Check Cloud Tasks queue
echo -e "\n3️⃣ Checking Cloud Tasks queue..."
gcloud tasks queues describe moderate-summary-queue --location=us-central1 --format="value(state)"

# Check Firebase Functions
echo -e "\n4️⃣ Checking Firebase Functions..."
firebase functions:list

echo -e "\n✅ Validation complete!"
echo "If all checks pass, run: ./setup_cloud_run_env.sh"
