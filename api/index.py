from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
import os
import tempfile
import shutil
import logging
import json
import re
from typing import Literal

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

# Data Model for Post Generation
class GenerateRequest(BaseModel):
    text: str
    mode: Literal["scribe", "strategist"]
    isPro: bool = False

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

def clean_and_parse_json(text: str):
    """Robust helper to extract JSON from Gemini's response."""
    try:
        # Remove markdown code blocks if present
        json_str = re.sub(r'```json\s?|\s?```', '', text).strip()
        return json.loads(json_str)
    except Exception as e:
        logger.error(f"JSON Parsing Error: {str(e)} | Raw: {text}")
        # Fallback: attempt to find anything between braces
        try:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group())
        except:
            pass
        raise ValueError("Could not parse JSON from Gemini response")

# --- STEP 2: POST GENERATION (Transcribed Text -> Formatted Content) ---
@app.post("/api/generate-post")
async def generate_post_handler(request: GenerateRequest):
    try:
        logger.info(f"Generation activated. Mode: {request.mode} | isPro: {request.isPro}")
        
        if request.mode == "strategist" and not request.isPro:
            raise HTTPException(status_code=403, detail="Strategist mode requires a Pro subscription.")

        if request.mode == "scribe":
            prompt = f"""
            Format this transcription into a Wall Street Journal style article with:
            1) Core Thesis (main argument)
            2) Pillars (3-5 supporting points)
            3) Steps (actionable items)

            Text: {request.text}

            Return ONLY a valid JSON object with keys: "thesis", "pillars" (list of strings), "steps" (list of strings).
            Do not include any conversational text or markdown bolding.
            """
        else: # strategist
            prompt = f"""
            Analyze this from an executive perspective and provide:
            1) Judgment (strategic assessment)
            2) Risk Audit (potential risks and mitigations)
            3) Email Draft (professional executive summary)

            Text: {request.text}

            Return ONLY a valid JSON object with keys: "judgment", "riskAudit", "emailDraft".
            Do not include any conversational text or markdown bolding.
            """

        # Generate with Gemini
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        # Parse result
        parsed_content = clean_and_parse_json(response.text)
        
        return {
            "status": "success", 
            "mode": request.mode,
            "content": parsed_content
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Generation Error: {str(e)}")
        return {"status": "error", "message": str(e)}
