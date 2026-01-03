from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
import os
import tempfile
import shutil

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Client (New SDK)
# Vercel auto-injects GEMINI_API_KEY
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

@app.get("/api/ping")
def ping():
    return {"status": "pong"}

@app.post("/api/transmute")
@app.post("/transmute")
async def transmute_handler(file: UploadFile = File(...)):
    print(f"--- Received file: {file.filename} ({file.content_type}) ---")
    tmp_path = None
    try:
        # 1. SAVE TO TEMP (Critical for Vercel)
        # We preserve the extension so Gemini knows if it's mp3/wav/webm
        suffix = os.path.splitext(file.filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        print(f"Saved to temp: {tmp_path}")

        # 2. UPLOAD (New SDK Syntax)
        # client.files.upload replaces the old genai.upload_file
        file_ref = client.files.upload(file=tmp_path)
        print(f"Uploaded to Gemini: {file_ref.name}")

        # 3. GENERATE (New SDK Syntax)
        # We use 'gemini-1.5-flash' as requested
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[
                file_ref, 
                "Transcribe this audio. Then, refine it into a strategic executive summary. Do not use markdown bolding."
            ]
        )
        
        print("Generation complete.")
        
        # 4. CLEANUP
        os.remove(tmp_path)
        
        return {"status": "success", "text": response.text}

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
        return {"status": "error", "message": str(e)}
