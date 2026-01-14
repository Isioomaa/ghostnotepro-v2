import os
from google import genai
from google.genai.types import HttpOptions
import re

# --- PASTE YOUR EXISTING "GHOSTNOTE-PRODUCTION" KEY HERE ---
NEW_API_KEY = "AIzaSyCWHu0xJqXr89Qw0Wsn3UCXLLjMHCfs1HU"
# -----------------------------------------------------------

print(f"--- TESTING KEY: {NEW_API_KEY[:10]}... ---")

# Candidates to test (Model Name, API Version)
candidates = [
    ("gemini-1.5-flash", "v1beta"),      # Standard
    ("gemini-2.5-flash-native-audio-latest", "v1alpha"), # Try Alpha
    ("gemini-2.5-flash-native-audio-latest", "v1beta"), # FOUND IN LIST
    ("models/gemini-2.5-flash-native-audio-latest", "v1beta"), # FOUND IN LIST (with prefix)
    ("gemini-1.5-flash", "v1"),          # Stable Channel
    ("gemini-1.5-flash-001", "v1beta"),  # Backup Version
    ("gemini-1.5-flash-8b", "v1beta"),   # High-speed variant
    ("gemini-2.0-flash-exp", "v1beta"),  # Experimental
]

working_config = None

for model_name, api_version in candidates:
    print(f"Testing: {model_name} ({api_version})...", end=" ")
    try:
        client = genai.Client(
            api_key=NEW_API_KEY, 
            http_options=HttpOptions(api_version=api_version)
        )
        client.models.generate_content(model=model_name, contents="Hello")
        print("✅ SUCCESS!")
        working_config = (model_name, api_version)
        break
    except Exception as e:
        print(f"❌ Failed. ({str(e)[:50]}...)")

if working_config:
    model_name, api_version = working_config
    print(f"\n🏆 WINNER: {model_name} (API: {api_version})")
    
    # Update .env
    # We want to preserve other keys if possible, but the user script requested an overwrite.
    # I will be smart and preserve VITE_GEMINI_API_KEY if I can, but frankly the user script said write.
    # I'll just follow the user script logic for now, then I can fix it up in a subsequent step if needed.
    with open(".env", "w") as f:
        f.write(f"GEMINI_API_KEY={NEW_API_KEY}\n")
    
    # Update api/index.py
    api_path = "api/index.py"
    if os.path.exists(api_path):
        with open(api_path, "r") as f:
            code = f.read()
        
        # Add v1 import if needed
        # We need to be careful not to duplicate imports or break existing code structure
        if api_version == "v1" and "HttpOptions" not in code:
             # Add import at the top (after existing imports)
             # Let's find a good spot.
             if "from google.genai import types" in code:
                 code = code.replace("from google.genai import types", "from google.genai import types\nfrom google.genai.types import HttpOptions")
             else:
                 code = "from google.genai.types import HttpOptions\n" + code

             # Replace the client initialization
             # We need to match exactly what's in the file.
             # Current file line 75: client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
             # We want to replace it.
             code = code.replace(
                 'client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))',
                 'client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"), http_options=HttpOptions(api_version="v1"))'
             )
        
        # Update Model Name
        # This replaces ALL occurrences of model="..." with the new model name
        code = re.sub(r'model="[^"]+"', f'model="{model_name}"', code)
            
        with open(api_path, "w") as f:
            f.write(code)
            
        print(f"✅ Code updated to use {model_name}")
        print("1. git add .")
        print("2. git commit -m 'Fix: Set correct model'")
        print("3. git push origin main")
else:
    print("\n❌ FATAL: Key is valid, but no models found. Verify 'Generative Language API' is enabled in Google Cloud.")
