#!/bin/bash
echo "🔐 Setting up Cloud Run IAM Permissions..."

# Get project details
PROJECT_ID=$(gcloud config get project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No active gcloud project. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📋 Project ID: $PROJECT_ID"

# Get the Cloud Run service account
echo "🔍 Finding Cloud Run service account..."
SERVICE_ACCOUNT=$(gcloud run services describe moderation-worker \
  --region=us-central1 \
  --format="value(spec.template.spec.serviceAccountName)")

if [ -z "$SERVICE_ACCOUNT" ]; then
    # If no custom service account, it's using the default compute service account
    SERVICE_ACCOUNT="${PROJECT_ID}-compute@developer.gserviceaccount.com"
    echo "🔧 Using default compute service account: $SERVICE_ACCOUNT"
else
    echo "✅ Found custom service account: $SERVICE_ACCOUNT"
fi

# Required IAM roles for the AI worker
echo "🛠️ Granting required IAM roles..."

# Firestore access (for reading messages, writing summaries/RAG chunks)
echo "  • Granting Firestore User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/datastore.user"

# Cloud Storage access (for media file operations during TTL cleanup)
echo "  • Granting Storage Object Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/storage.objectAdmin"

# Logging access (for proper error reporting)
echo "  • Granting Logging Writer role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/logging.logWriter"

# Cloud Tasks access (if needed for future enhancements)
echo "  • Granting Cloud Tasks Enqueuer role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/cloudtasks.enqueuer"

# Optional: Service Account Token Creator (for impersonation if needed)
echo "  • Granting Service Account Token Creator role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/iam.serviceAccountTokenCreator"

echo ""
echo "✅ IAM permissions configured successfully!"
echo ""
echo "🔧 Restarting Cloud Run service to apply new permissions..."

# Force a new revision to pick up the new permissions
gcloud run services update moderation-worker \
  --region=us-central1 \
  --set-env-vars="PERMISSIONS_UPDATED=$(date +%s)" \
  --quiet

echo ""
echo "🧪 Testing service health with new permissions..."
sleep 5  # Wait for service to restart

# Test the health endpoint
curl -s https://moderation-worker-yyaoaphbjq-uc.a.run.app/health | jq '.'

echo ""
echo "📋 Verification complete!"
echo "If the health check shows all services as available, permissions are working correctly."
echo ""
echo "🔍 To verify IAM permissions manually:"
echo "gcloud projects get-iam-policy $PROJECT_ID --flatten=\"bindings[].members\" --filter=\"bindings.members:$SERVICE_ACCOUNT\"" 