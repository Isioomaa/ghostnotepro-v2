import os
from google import genai

from dotenv import load_dotenv
load_dotenv()
NEW_API_KEY = os.environ.get("GEMINI_API_KEY")

print(f"--- LISTING MODELS FOR KEY: {NEW_API_KEY[:10] if NEW_API_KEY else 'None'}... ---")

try:
    client = genai.Client(api_key=NEW_API_KEY)
    print("Attempting to list models...")
    for model in client.models.list():
        # Just print the name and display_name if available
        # The SDK model object usually has .name, .display_name
        print(f"FOUND: {model.name}")
        
except Exception as e:
    print(f"❌ Error listing models: {e}")
