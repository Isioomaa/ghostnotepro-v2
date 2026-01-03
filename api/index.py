from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
import os
import tempfile
import shutil
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Client (Gemini 2.5 Flash)
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# Data Model for The Strategist
class GenerateRequest(BaseModel):
    text: str
    tone: str = "Professional"

@app.get("/api/ping")
def ping():
    return {"status": "pong"}

# --- STEP 1: THE SCRIBE (Audio -> Core Thesis) ---
@app.post("/api/transmute")
@app.post("/transmute")
async def transmute_handler(file: UploadFile = File(...)):
    tmp_path = None
    try:
        logger.info(f"Scribe receiving audio: {file.filename}")
        
        # Save to /tmp (Vercel Requirement)
        suffix = os.path.splitext(file.filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        # Upload
        file_ref = client.files.upload(file=tmp_path)
        
        # Generate 'The Scribe' Output
        # We ask specifically for a "Core Thesis" structure as shown in the design
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                file_ref, 
                "You are The Scribe. Transcribe this audio accurately. Then, refine it into a clear, articulate 'Core Thesis'. Do not use bolding."
            ]
        )
        
        os.remove(tmp_path)
        return {"status": "success", "text": response.text}

    except Exception as e:
        logger.error(f"Scribe Error: {str(e)}")
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
        return {"status": "error", "message": str(e)}

# --- STEP 2: THE STRATEGIST (Core Thesis -> Executive Suite) ---
@app.post("/api/generate-post")
async def generate_post_handler(request: GenerateRequest):
    try:
        logger.info(f"Strategist activated. Tone: {request.tone}")
        
        prompt = f'''
        You are The Strategist.
        
        INPUT CONTEXT (The Scribe's Output):
        "{request.text}"
        
        TONE: {request.tone}
        
        TASK:
        Apply executive reasoning to operationalize this thinking.
        Generate a "Strategic Executive Suite" with these 3 distinct sections:
        
        1. LINKEDIN POST (Viral, punchy, max 200 words)
        2. TWITTER/X THREAD (3-5 high-impact tweets)
        3. INTERNAL MEMO (Formal, actionable, clear next steps)
        
        Format the output clearly.
        '''

        # Generate with Gemini 2.5 Flash
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        return {"status": "success", "data": response.text}

    except Exception as e:
        logger.error(f"Strategist Error: {str(e)}")
        return {"status": "error", "message": str(e)}
