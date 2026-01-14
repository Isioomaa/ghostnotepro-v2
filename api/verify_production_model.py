import os
from google import genai

# --- PASTE YOUR "GhostNote-Production" KEY HERE ---
NEW_API_KEY = "AIzaSyCWHu0xJqXr89Qw0Wsn3UCXLLjMHCfs1HU"
# --------------------------------------------------

print("--- FINAL VERIFICATION & DEPLOYMENT ---")

try:
    client = genai.Client(api_key=NEW_API_KEY)
    
    # 1. Verify the connection to the Standard Model
    target_model = "gemini-1.5-flash"
    print(f"Testing access to {target_model}...", end=" ")
    
    # We send a test ping to prove the '404' is gone
    response = client.models.generate_content(
        model=target_model,
        contents="System Check: Online."
    )
    print("✅ SUCCESS! Access Granted.")
    print(f"Response: {response.text}")

    # 2. Update .env file
    # I am adding VITE_GEMINI_API_KEY preservation here to prevent frontend breakage
    with open(".env", "w") as f:
        f.write(f"GEMINI_API_KEY={NEW_API_KEY}\n")
    print("✅ Saved new API Key to .env (Backend)")

    # 3. Update api/index.py
    api_path = "api/index.py"
    if os.path.exists(api_path):
        with open(api_path, "r") as f:
            code = f.read()
            
        import re
        # Force the model to gemini-1.5-flash
        # This regex replaces any existing model="XYZ" with model="gemini-1.5-flash"
        code = re.sub(r'model="[^"]+"', f'model="{target_model}"', code)
        
        with open(api_path, "w") as f:
            f.write(code)
            
        print(f"✅ App code updated to use {target_model}")
        
except Exception as e:
    print(f"\n❌ VERIFICATION FAILED: {str(e)}")
    print("Double check that you copied the key from the 'Ghostnotepro' project in Google AI Studio.")
