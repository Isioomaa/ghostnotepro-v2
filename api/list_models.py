from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY")
if not api_key:
    print(f"Error: API Key not found. Cwd: {os.getcwd()}")
    exit(1)
print(f"Using API Key: {api_key[:10]}...")

client = genai.Client(api_key=api_key)

print("Available models:")
try:
    for model in client.models.list():
        if "generateContent" in model.supported_generation_methods:
            print(f"- {model.name}")
except Exception as e:
    print(f"Failed to list models: {e}")
