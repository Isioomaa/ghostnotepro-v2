import os
from google import genai

# --- PASTE YOUR KEY FROM THE 'GHOSTNOTEPRO' PROJECT HERE ---
NEW_API_KEY = "AIzaSyCWHu0xJqXr89Qw0Wsn3UCXLLjMHCfs1HU"
# -----------------------------------------------------------

print(f"--- CONNECTING TO PROJECT: Ghostnotepro ---")

try:
    client = genai.Client(api_key=NEW_API_KEY)
    
    # 1. Verify the connection to the Standard Model (1.5 Flash)
    target_model = "gemini-1.5-flash"
    print(f"Pinging {target_model}...", end=" ")
    
    # This proves the 404 is gone and the API works
    response = client.models.generate_content(
        model=target_model,
        contents="System Check: Online."
    )
    print("✅ SUCCESS! Access Granted.")

    # 2. Update .env file
    # Preserving VITE_GEMINI_API_KEY for frontend
    with open(".env", "w") as f:
        f.write(f"GEMINI_API_KEY={NEW_API_KEY}\n")
        f.write(f"VITE_GEMINI_API_KEY={NEW_API_KEY}\n")
    print("✅ Saved new API Key to .env (Backend & Frontend)")
    
    # 3. Update api/index.py to force this model
    api_path = "api/index.py"
    if os.path.exists(api_path):
        with open(api_path, "r") as f:
            code = f.read()
            
        import re
        # Replace any existing model="XYZ" with model="gemini-1.5-flash"
        code = re.sub(r'model="[^"]+"', f'model="{target_model}"', code)
        
        with open(api_path, "w") as f:
            f.write(code)
            
        print(f"✅ App code updated to use {target_model} (1,500 req/day)")
        
except Exception as e:
    print(f"\n❌ VERIFICATION FAILED: {str(e)}")
    print("Ensure you copied the key specifically for the 'Ghostnotepro' project.")
