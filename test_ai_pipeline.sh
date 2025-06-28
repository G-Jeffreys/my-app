#!/bin/bash
echo "🧪 Testing AI Moderation Pipeline..."

echo "1️⃣ Checking Cloud Run service health..."
curl -s https://moderation-worker-yyaoaphbjq-uc.a.run.app/health | jq '.'

echo -e "\n2️⃣ Checking current queue status..."
gcloud tasks list --queue=moderate-summary-queue --location=us-central1

echo -e "\n3️⃣ Checking recent Cloud Run logs..."
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="moderation-worker"' --limit=5 --format=json | jq -r '.[] | "\(.timestamp) [\(.severity)] \(.textPayload // .jsonPayload.message // "No message")"'

echo -e "\n4️⃣ Checking Firebase Functions logs..."
firebase functions:log --only enqueueModerationJob --limit 5

echo -e "\n✅ Pipeline test complete!"
echo "If you see '✅ Message processed successfully' in the logs, the pipeline is working!"
