import os
import re

print("--- REMOVING KEY FROM CODE ---")

api_path = "api/index.py"
if os.path.exists(api_path):
    with open(api_path, "r") as f:
        code = f.read()

    # We are looking for: client = genai.Client(api_key="AIza...")
    # We replace it with: client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    # This regex finds the hardcoded version and fixes it
    # Modified regex to be slightly more robust to spacing
    code = re.sub(
        r'client\s*=\s*genai\.Client\(api_key="[^"]+"[^)]*\)', 
        'client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))', 
        code
    )
    
    # Also ensure 'import os' is at the top
    if "import os" not in code:
        code = "import os\n" + code

    with open(api_path, "w") as f:
        f.write(code)
        
    print("✅ Hardcoded key removed.")
    print("✅ App is now using the key from Vercel Settings.")

    print("\n--- DONE ---")
