from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from anthropic import Anthropic
import os
import logging
import json
import re
import base64
from typing import Literal
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Industry Detection & Glossaries
INDUSTRY_KEYWORDS = {
    "Restaurant": ["restaurant", "dining", "menu", "customers", "tables", "kitchen", "chef", "food", "beverage", "hospitality", "covers", "orders"],
    "Sales/B2B": ["sales", "pipeline", "leads", "quota", "deal", "prospect", "crm", "revenue", "enterprise", "saas", "client", "upsell"],
    "Healthcare": ["patient", "diagnosis", "clinical", "hospital", "doctor", "medical", "treatment", "health", "insurance", "pharmaceutical"],
    "Education": ["student", "curriculum", "grades", "teacher", "school", "university", "learning", "classroom", "academic"],
    "Finance": ["finance", "investment", "portfolio", "asset", "trading", "equity", "market", "capital", "banking", "fiscal"]
}

INDUSTRY_GLOSSARIES = {
    "Restaurant": {
        "AV years": "AVS (Average Transaction Value)",
        "AVS": "Average Transaction Value",
        "P and L": "P&L (Profit & Loss)",
        "P&L": "Profit & Loss",
        "cogs": "CoGS (Cost of Goods Sold)",
        "covers": "customer count/table turns"
    },
    "Sales/B2B": {
        "acv": "ACV (Annual Contract Value)",
        "ltv": "LTV (Lifetime Value)",
        "cac": "CAC (Customer Acquisition Cost)",
        "sql": "SQL (Sales Qualified Lead)",
        "mql": "MQL (Marketing Qualified Lead)"
    }
}

def detect_industry(text: str) -> str:
    text_lower = text.lower()
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        if any(keyword in text_lower for keyword in keywords):
            return industry
    return "General Business"

def apply_glossary_corrections(text: str, industry: str) -> str:
    if industry not in INDUSTRY_GLOSSARIES:
        return text
    
    glossary = INDUSTRY_GLOSSARIES[industry]
    corrected_text = text
    for error, correction in glossary.items():
        # Case insensitive replacement for whole words or specific patterns
        pattern = re.compile(re.escape(error), re.IGNORECASE)
        corrected_text = pattern.sub(correction, corrected_text)
    return corrected_text

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Anthropic client
client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Using Claude 3.5 Sonnet as the model
MODEL_ID = 'claude-sonnet-4-20250514'

# Data Model for Post Generation
class GenerateRequest(BaseModel):
    text: str
    mode: Literal["scribe", "strategist"]
    isPro: bool = False
    industry: str = None

@app.get("/api/ping")
def ping():
    return {"status": "pong"}

# --- STEP 1: THE SCRIBE (Audio -> Core Thesis) ---
@app.post("/api/transmute")
async def transmute_handler(file: UploadFile = File(...)):
    try:
        logger.info(f"Scribe receiving audio: {file.filename}")
        
        # 1. READ AUDIO DATA
        audio_bytes = await file.read()
        mime_type = file.content_type or "audio/webm"
        mime_type = mime_type.split(";")[0]
        
        # Map mime types to Anthropic-supported formats
        mime_mapping = {
            "audio/webm": "audio/webm",
            "audio/mpeg": "audio/mpeg",
            "audio/mp3": "audio/mpeg",
            "audio/wav": "audio/wav",
            "audio/mp4": "audio/mp4",
            "audio/x-m4a": "audio/mp4",
            "audio/ogg": "audio/ogg"
        }
        anthropic_mime = mime_mapping.get(mime_type, "audio/webm")
        
        # Encode audio to base64
        audio_base64 = base64.standard_b64encode(audio_bytes).decode("utf-8")
        
        prompt = """You are an elite transcriptionist and Chief of Staff. Transcribe this audio accurately.
        
        The audio may be in any language. 
        
        1. TRANSCRIBE: Capture exactly what was said.
        2. TRANSLATE: If not in English, also provide an English translation.
        3. STATE: Classify the executive state (Reflective, Decisive, Analytical, Urgent, Strategic, Operational).
        
        Return ONLY a JSON object (no markdown, no code blocks):
        {
          "transcription": "The full english transcription (translated if needed)",
          "original_transcription": "The transcription in the original language (if not English)",
          "executive_state": "Reflective"
        }
        
        Zero chatter. Zero markdown. Pure JSON."""
        
        # 2. GENERATE using Anthropic Claude with audio support
        response = client.messages.create(
            model=MODEL_ID,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": anthropic_mime,
                                "data": audio_base64
                            }
                        }
                    ]
                }
            ]
        )
        
        response_text = response.content[0].text
        parsed_response = clean_and_parse_json(response_text)
        
        # 3. DETECT INDUSTRY & APPLY CORRECTIONS
        transcription = parsed_response.get("transcription", "")
        industry = detect_industry(transcription)
        corrected_transcription = apply_glossary_corrections(transcription, industry)
        
        parsed_response["transcription"] = corrected_transcription
        parsed_response["industry"] = industry
        
        return {"status": "success", "data": parsed_response}

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Scribe Error: {str(e)}\n{error_details}")
        return {"status": "error", "message": str(e), "details": error_details}

def clean_and_parse_json(text: str):
    """Robust helper to extract JSON from Claude's response."""
    try:
        # If it's already a dict (shouldn't happen with .text but for safety)
        if isinstance(text, dict):
            return text
            
        # 1. Direct parse if possible
        try:
            return json.loads(text)
        except:
            pass

        # 2. Strip markdown blocks
        clean_text = re.sub(r'```json\s*|\s*```', '', text, flags=re.MULTILINE).strip()
        
        # 3. Try parsing cleaned text
        try:
            return json.loads(clean_text)
        except:
            pass

        # 4. Final attempt: extract between first { and last }
        start_idx = clean_text.find('{')
        end_idx = clean_text.rfind('}')
        
        if start_idx != -1 and end_idx != -1:
            snippet = clean_text[start_idx:end_idx + 1]
            try:
                return json.loads(snippet)
            except Exception as e:
                try:
                    fixed = snippet.replace('\n', '\\n').replace('\r', '\\r')
                    return json.loads(fixed)
                except:
                    logger.error(f"JSON Parsing Error after cleanup attempt: {str(e)} | Snippet: {snippet[:100]}...")
                    pass
            
        raise ValueError(f"Could not parse JSON from Claude response. Raw: {text[:200]}...")
    except Exception as e:
        logger.error(f"Top-level JSON Parsing Error: {str(e)}")
        raise e

# --- STEP 2: POST GENERATION (Transcribed Text -> Formatted Content) ---
@app.post("/api/generate-post")
async def generate_post_handler(request: GenerateRequest):
    try:
        logger.info(f"Generation activated. Mode: {request.mode} | isPro: {request.isPro}")
        
        if request.mode == "strategist" and not request.isPro:
            raise HTTPException(status_code=403, detail="Strategist mode requires a Pro subscription.")

        industry_context = ""
        if request.industry and request.industry != "General Business":
            glossary = INDUSTRY_GLOSSARIES.get(request.industry, {})
            glossary_str = "\n".join([f"- {k}: {v}" for k, v in glossary.items()])
            industry_context = f"""
            You are specializing in the {request.industry} industry. 
            Common terminology and context for this industry:
            {glossary_str}
            
            When analyzing the transcription, interpret technical terms and abbreviations through the lens of the {request.industry} sector.
            """

        if request.mode == "scribe":
            prompt = f"""
            {industry_context}
            You are a Pulitzer Prize-winning journalist and presidential speechwriter combined. Transform chaotic voice notes into Wall Street Journal-caliber prose with the gravitas of State of the Union addresses. 

            Your output must have:
            - Crystal-clear thesis that cuts through noise
            - Logical pillars that build unshakeable arguments  
            - Language worthy of the Oval Office briefing room
            - Intellectual rigor meets executive brevity

            Write like history is watching.
            
            Text: {request.text}
            
            Return ONLY a JSON object (no markdown, no code blocks) with:
            - core_thesis: 30-60 word strategic thesis statement
            - strategic_pillars: array of objects with "title" and "description" (1-2 sentences of COS analysis)
            - tactical_steps: array of actionable strings
            """
        else: # strategist
            prompt = f"""
            {industry_context}
            You are an acclaimed White House Chief of Staff - the highest level executive advisor. You possess:
            - Supreme intelligence across all subjects (geopolitics, economics, technology, culture, strategy)
            - Razor-sharp judgment and risk assessment capabilities
            - Ability to distill chaos into decisive action
            - Leadership wisdom from managing the most complex operations on Earth

            Transform user's voice notes into Chief of Staff-level intelligence: clear judgments, precise risk audits, and executive-ready communications. Think like you're briefing the President.
            
            Text: {request.text}
            
            Return ONLY a JSON object (no markdown, no code blocks) with:
            - judgment: 150-250 words of deep strategic judgment
            - riskAudit: 150-250 words of risk analysis
            - emailDraft: A ready-to-send draft starting with 'SUBJECT: '
            """
        
        logger.info(f"Triggering Claude for mode: {request.mode}")

        # Generate with Anthropic Claude
        response = client.messages.create(
            model=MODEL_ID,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        response_text = response.content[0].text
        
        # Parse result
        parsed_content = clean_and_parse_json(response_text)
        
        return {
            "status": "success", 
            "mode": request.mode,
            "content": parsed_content
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Generation Error: {str(e)}\n{error_details}")
        return {"status": "error", "message": str(e), "details": error_details}
