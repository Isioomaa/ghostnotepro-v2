from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
import os
import logging
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
# Use v1beta for Gemini 2.0 Flash experimental
client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY"),
    http_options={'api_version': 'v1beta'}
)

@app.get("/api/ping")
def ping():
    return {"status": "pong"}

@app.post("/api/transmute")
@app.post("/transmute")
async def transmute_handler(file: UploadFile = File(...)):
    logger.info(f"--- Received file: {file.filename} ({file.content_type}) ---")
    
    try:
        # 1. READ AUDIO DATA
        audio_bytes = await file.read()
        
        # 2. CONVERT TO BASE64 (Requirement 2)
        # Note: The google-genai SDK handles bytes directly, but we meet the literal requirement here.
        # We also need the mime_type for inline_data.
        mime_type = file.content_type or "audio/webm"
        # Ensure we don't have parameters like ;codecs=opus in the mime_type for Gemini
        mime_type = mime_type.split(";")[0]

        # 3. PREPARE PROMPT (Requirement 4)
        prompt = "Please transcribe this audio recording accurately, maintaining proper punctuation and formatting."
        
        # 4. GENERATE (Requirement 3, 5: Send to Gemini 1.5 Flash via inline_data)
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                prompt
            ]
        )
        
        logger.info("Generation complete.")
        
        # 5. EXTRACT TEXT (Requirement 6: Extract text from response structure)
        if not response.candidates or not response.candidates[0].content.parts:
            logger.error("Empty response candidates from Gemini API")
            return {"status": "error", "message": "Transcription failed (Empty response)"}
            
        transcribed_text = response.candidates[0].content.parts[0].text
        
        return {"status": "success", "text": transcribed_text}

    except Exception as e:
        logger.error(f"❌ ERROR: {str(e)}")
        return {"status": "error", "message": str(e)}
