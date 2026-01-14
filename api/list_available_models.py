import os
from google import genai

NEW_API_KEY = "AIzaSyCWHu0xJqXr89Qw0Wsn3UCXLLjMHCfs1HU"

print(f"--- LISTING MODELS FOR KEY: {NEW_API_KEY[:10]}... ---")

try:
    client = genai.Client(api_key=NEW_API_KEY)
    print("Attempting to list models...")
    for model in client.models.list():
        # Just print the name and display_name if available
        # The SDK model object usually has .name, .display_name
        print(f"FOUND: {model.name}")
        
except Exception as e:
    print(f"❌ Error listing models: {e}")
