from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

candidates = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002",
    "gemini-flash-latest",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001"
]

print("Testing candidates with Master Key...")

working_model = None

for model_name in candidates:
    print(f"Testing: {model_name}...", end="")
    try:
        response = client.models.generate_content(
            model=model_name,
            contents="Ping"
        )
        print(" SUCCESS")
        if not working_model and "flash" in model_name: 
            working_model = model_name
    except Exception as e:
        print(f" FAILED")

if working_model:
    print(f"\nRecommended Model: {working_model}")
else:
    print("\nNo working flash model found.")
