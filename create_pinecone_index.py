#!/usr/bin/env python3
"""
Script to create Pinecone index for SnapConnect AI pipeline
Run this after setting up your Pinecone API key
"""

import os
from pinecone import Pinecone, ServerlessSpec

def create_index():
    # Initialize Pinecone
    api_key = os.getenv('PINECONE_API_KEY')
    if not api_key:
        print("❌ PINECONE_API_KEY environment variable not set")
        print("💡 Make sure to set it in your .env file and source it:")
        print("   export PINECONE_API_KEY=your_api_key_here")
        return False
    
    pc = Pinecone(api_key=api_key)
    
    index_name = "snaps-prod"
    
    # Check if index already exists
    try:
        existing_indexes = pc.list_indexes()
        if any(idx.name == index_name for idx in existing_indexes):
            print(f"✅ Index '{index_name}' already exists")
            
            # Get index info
            index_info = pc.describe_index(index_name)
            print(f"📊 Index details: {index_info.dimension} dimensions, {index_info.metric} metric")
            return True
    except Exception as e:
        print(f"⚠️ Error checking existing indexes: {e}")
    
    # Create index
    print(f"🔧 Creating Pinecone index: {index_name}")
    try:
        pc.create_index(
            name=index_name,
            dimension=1536,  # text-embedding-3-small dimensions
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
        
        print(f"✅ Index '{index_name}' created successfully!")
        print("📊 Configuration: 1536 dimensions, cosine metric, AWS us-east-1")
        return True
        
    except Exception as e:
        print(f"❌ Failed to create index: {e}")
        return False

if __name__ == "__main__":
    success = create_index()
    if success:
        print("\n🎉 Pinecone setup complete! You can now run: ./setup_cloud_run_env.sh")
    else:
        print("\n💡 Please check your PINECONE_API_KEY and try again")
