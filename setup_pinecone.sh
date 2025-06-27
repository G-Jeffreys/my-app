#!/bin/bash
echo "🔧 Setting up Pinecone index..."

# Source environment variables from .env file if it exists
if [ -f .env ]; then
    echo "📁 Loading environment variables from .env..."
    export $(grep -v '^#' .env | xargs)
else
    echo "⚠️ .env file not found in current directory"
fi

# Check if PINECONE_API_KEY is set
if [ -z "$PINECONE_API_KEY" ]; then
    echo "❌ PINECONE_API_KEY not found in environment"
    echo "💡 Make sure your .env file contains:"
    echo "   PINECONE_API_KEY=your_api_key_here"
    exit 1
fi

echo "✅ PINECONE_API_KEY found"
echo "🐍 Running Python script to create index..."

# Run the Python script with environment variables
python3 create_pinecone_index.py

echo "🎯 Pinecone setup complete!"
