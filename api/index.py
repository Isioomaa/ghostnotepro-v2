from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
import os
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
    try:
        logger.info(f"Scribe receiving audio: {file.filename}")
        
        # 1. READ AUDIO DATA (In-memory, bypasses read-only filesystem issues)
        audio_bytes = await file.read()
        mime_type = file.content_type or "audio/webm"
        mime_type = mime_type.split(";")[0]

        # 2. GENERATE (Inline approach - NO FILE UPLOAD)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                "You are an elite Chief of Staff. Your executive just voice-recorded rambling, unstructured thoughts - \"chaos.\" Your job: turn it into \"strategy.\"\n\nThis audio may be in ANY language. Here's your process:\n\nSTEP 1 - TRANSCRIBE & TRANSLATE:\n- Transcribe the audio accurately in its original language\n- If not in English, translate to English\n- Preserve the executive's intent and nuance\n\nSTEP 2 - EXTRACT THE CORE THESIS:\nYour executive is smart but scattered. What is the ONE core strategic insight buried in this recording?\n\n- Distill it into a single, powerful statement (30-60 words)\n- This should be Board-meeting quality\n- Format: Clear subject + strategic insight + why it matters\n- Think: \"The core strategic opportunity in [X] is [Y], which positions us to [Z]\"\n\nSTEP 3 - IDENTIFY STRATEGIC PILLARS:\nWhat are the 3-5 supporting points that make this thesis actionable?\n\n- Each pillar should be a strategic lever (not a to-do item)\n- Format: Bold claim + 1-2 sentences of supporting logic\n- Think like McKinsey: What are the key drivers?\n\nOUTPUT FORMAT:\nReturn ONLY the English Core Thesis + Strategic Pillars in Wall Street Journal editorial style.\n\nTONE: Confident. Analytical. Executive-grade prose. Zero fluff.\n\nDo not use markdown formatting or bolding in your output - the frontend will handle styling."
            ]
        )
        
        return {"status": "success", "text": response.text}

    except Exception as e:
        logger.error(f"Scribe Error: {str(e)}")
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
            2) Pillars (3-5 supporting points, each with a title and description)
            3) Steps (actionable items)

            Text: {request.text}

            Return ONLY a valid JSON object with keys: 
            - "core_thesis": string
            - "strategic_pillars": list of objects with "title" (string) and "description" (string)
            - "tactical_steps": list of strings

            Do not include any conversational text or markdown bolding.
            """
        else: # strategist
            prompt = f"""
            You are an elite Chief of Staff to C-suite executives - the best in the world. You hold advanced degrees (MBA, JD, or equivalent), have worked at McKinsey/BCG/Bain, and have been Chief of Staff to Fortune 500 CEOs. You think 3-5 chess moves ahead. You see what others miss. You are trusted with the most sensitive strategic decisions.

            Your executive just voice-recorded their thoughts. Your job: turn chaos into clarity, rambling into strategy.

            Analyze this transcription and provide THREE critical deliverables:

            ═══════════════════════════════════════════════════════════

            1) JUDGMENT (Chief of Staff Strategic Assessment)

            You are in the room where it happens. What would you tell your executive privately?

            - What is the REAL strategic challenge or opportunity here? (Not the surface issue)
            - What are the second and third-order implications?
            - What would a seasoned Chief of Staff flag immediately?
            - What is the one move that changes the game?
            - What's at stake if we get this wrong?

            Be direct. Be insightful. Be the advisor executives wish they had.
            150-250 words. No fluff.

            ═══════════════════════════════════════════════════════════

            2) RISK AUDIT (Recursive Risk Intelligence)

            You've seen strategies fail. You know where bodies are buried. Audit this like your career depends on it.

            - PRIMARY RISKS: What are the obvious operational, financial, and reputational risks?
            - HIDDEN RISKS: What are the cascading, second-order risks most people won't see until it's too late?
            - CAREER-ENDING RISKS: What could go catastrophically wrong? (Think: Enron, Theranos-level)
            - MITIGATION PRIORITY: What must be de-risked first, this week?

            Think like a Chief of Staff who has to brief the Board tomorrow.
            150-250 words. Be brutally honest.

            ═══════════════════════════════════════════════════════════

            3) EMAIL DRAFT (Executive Communication - Ready to Send)

            Draft an email your executive could send RIGHT NOW to their team, board, or key stakeholder.

            CRITICAL: Format this as a complete, ready-to-send email with:

            SUBJECT LINE: (Clear, professional, 5-8 words max)

            BODY:
            [Opening: Context in 1-2 sentences - why this matters now]

            [Core: The strategy/decision/recommendation - what we're doing]

            [Close: Next steps with owners and timelines - who does what by when]

            REQUIREMENTS:
            - TONE: Confident but not arrogant. Clear but sophisticated. Decisive but measured.
            - LENGTH: 150-250 words total
            - VOICE: This should sound like a seasoned executive wrote it, not an AI
            - FORMATTING: Use paragraph breaks for readability, but NO markdown bolding or bullets

            This email should be ready to copy-paste and send with zero editing.

            ═══════════════════════════════════════════════════════════

            Text to analyze: {request.text}

            Return ONLY valid JSON with this EXACT structure:

            {{
              "judgment": "your judgment text here",
              "riskAudit": "your risk audit text here",
              "emailDraft": "SUBJECT: Your subject line here\\n\\nYour email body with proper paragraph breaks here"
            }}

            IMPORTANT: The emailDraft field should be a single string that includes both the subject line (prefixed with "SUBJECT: ") and the body separated by two newlines.

            No additional markdown. No bolding. No preamble. Just world-class Chief of Staff intelligence.
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
