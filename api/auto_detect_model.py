import os
from google import genai
from dotenv import load_dotenv
import re

# Load the API key from .env
load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")

print("--- STARTING MODEL AUTO-DISCOVERY ---")

if not api_key:
    # Fallback to manual reading if dotenv fails or key not found
    print("⚠️  Warning: DOTENV failed or key missing. Trying manual read...")
    try:
        with open('.env', 'r') as f:
            for line in f:
                if line.startswith('GEMINI_API_KEY='):
                    api_key = line.strip().split('=', 1)[1]
                    break
    except Exception as e:
        print(f"❌ Error reading .env manually: {e}")

if not api_key:
    print("❌ Error: No API Key found in .env. Please check your file.")
    exit()

print(f"Key found: {api_key[:5]}...")

try:
    client = genai.Client(api_key=api_key)
except Exception as e:
    print(f"❌ Error initializing client: {e}")
    exit()

# List of candidates to try (in order of preference)
candidates = [
    "gemini-1.5-flash",          # The Standard (Best)
    "gemini-1.5-flash-001",      # The Backup
    "gemini-1.5-flash-002",      # The Bleeding Edge
    "gemini-1.5-pro",            # The Heavyweight
    "gemini-1.5-pro-001",
    "gemini-2.0-flash-exp",      # Experimental (if nothing else works)
]

working_model = None

for model_name in candidates:
    print(f"Testing: {model_name}...", end=" ")
    try:
        # We try to generate a tiny "hello" to prove it works
        client.models.generate_content(
            model=model_name,
            contents="Hello"
        )
        print("✅ SUCCESS!")
        working_model = model_name
        break
    except Exception as e:
        # If it fails (404, 400, etc), we skip it
        print(f"❌ Failed. ({str(e)[:50]}...)")

if working_model:
    print(f"\n🏆 WINNER FOUND: {working_model}")
    
    # Now we update the code automatically
    api_path = "api/index.py"
    if os.path.exists(api_path):
        with open(api_path, "r") as f:
            code = f.read()
        
        # We replace the old failed model with the new winner
        # We look for the line client.models.generate_content(model="...")
        # A simple string replace is safer here to catch all variants
            
        # This pattern finds model="ANYTHING" and replaces it with model="WINNER"
        # We target model="..." inside the client.models.generate_content calls (or similar)
        # The user provided regex was: re.sub(r'model="[^"]+"', f'model="{working_model}"', code)
        code = re.sub(r'model="[^"]+"', f'model="{working_model}"', code)
        
        with open(api_path, "w") as f:
            f.write(code)
            
        print(f"✅ Updated 'api/index.py' to use {working_model}")
        print("\n--- FINAL STEPS ---")
        print("1. git add .")
        print(f"2. git commit -m 'Fix: Switch to working model {working_model}'")
        print("3. git push origin main")
    else:
        print("❌ Error: Could not find api/index.py")
else:
    print("\n❌ FATAL: No working models found. Check your API Key permissions.")
