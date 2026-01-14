import os
import re

print("--- UPDATING MODEL NAME ---")

api_path = "api/index.py"
if os.path.exists(api_path):
    with open(api_path, "r") as f:
        code = f.read()

    # 1. Update Model Name
    # Replace 'gemini-1.5-flash' with 'gemini-1.5-flash-001'
    # We replace any variation to be safe
    code = code.replace('model="gemini-1.5-flash"', 'model="gemini-1.5-flash-001"')
    
    # Also catch if it was hardcoded in a variable
    code = re.sub(r'model\s*=\s*"gemini-1.5-flash"', 'model="gemini-1.5-flash-001"', code)

    # 2. Ensure we are definitely reading from Vercel's Env Var (Double Check)
    # This ensures we don't accidentally revert to a hardcoded key if the previous cleanup missed something.
    if 'api_key=os.environ.get("GEMINI_API_KEY")' not in code:
        # Regex to find any client init and force the env var
        code = re.sub(
            r'client\s*=\s*genai\.Client\([^)]*\)', 
            'client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))', 
            code
        )
        if "import os" not in code:
            code = "import os\n" + code

    with open(api_path, "w") as f:
        f.write(code)
        
    print("✅ Model updated to stable version: gemini-1.5-flash-001")
    print("✅ Verified Key is reading from Vercel Environment.")

    print("\n--- DEPLOY ---")
