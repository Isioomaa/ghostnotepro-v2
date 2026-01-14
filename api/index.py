from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
import os
import logging
import json
import re
from typing import Literal, List, Optional
from pydantic import BaseModel, Field

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

# Initialize Client (Gemini 1.5 Flash)
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

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
        
        # 1. READ AUDIO DATA (In-memory, bypasses read-only filesystem issues)
        audio_bytes = await file.read()
        mime_type = file.content_type or "audio/webm"
        mime_type = mime_type.split(";")[0]

        # 2. GENERATE (Inline approach - NO FILE UPLOAD)
        response = client.models.generate_content(
            model="gemini-flash-latest",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                safety_settings=[
                    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
                ]
            ),
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                """You are an elite transcriptionist and Chief of Staff. Transcribe this audio accurately.
                
                The audio may be in any language. 
                
                1. TRANSCRIBE: Capture exactly what was said.
                2. TRANSLATE: If not in English, also provide an English translation.
                3. STATE: Classify the executive state (Reflective, Decisive, Analytical, Urgent, Strategic, Operational).
                
                Return ONLY a JSON object:
                {
                  "transcription": "The full english transcription (translated if needed)",
                  "original_transcription": "The transcription in the original language (if not English)",
                  "executive_state": "Reflective"
                }
                
                Zero chatter. Zero markdown. Pure JSON."""
            ]
        )
        
        parsed_response = clean_and_parse_json(response.text)
        
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
    """Robust helper to extract JSON from Gemini's response."""
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
        
        # 3. Handle problematic raw newlines in strings by finding content between brackets/braces
        # But first try the cleaned text
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
                # If it fails here, it might be due to unescaped newlines in JSON strings
                # Let's try to replace common problematic patterns if it still fails
                try:
                    # Very aggressive: try to fix common JSON errors if we're desperate
                    fixed = snippet.replace('\n', '\\n').replace('\r', '\\r')
                    # But wait, this might break the structure if not careful. 
                    # Actually, if we use response_mime_type, this should be less of an issue.
                    return json.loads(fixed)
                except:
                    logger.error(f"JSON Parsing Error after cleanup attempt: {str(e)} | Snippet: {snippet[:100]}...")
                    pass
            
        raise ValueError(f"Could not parse JSON from Gemini response. Raw: {text[:200]}...")
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
            """
            
            # Use structured output for Scribe
            schema = {
                "type": "OBJECT",
                "properties": {
                    "core_thesis": {"type": "STRING", "description": "30-60 word strategic thesis statement"},
                    "strategic_pillars": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "title": {"type": "STRING"},
                                "description": {"type": "STRING", "description": "1-2 sentences of COS analysis"}
                            },
                            "required": ["title", "description"]
                        }
                    },
                    "tactical_steps": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"}
                    }
                },
                "required": ["core_thesis", "strategic_pillars", "tactical_steps"]
            }
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
            """
            
            # Use structured output for Strategist
            schema = {
                "type": "OBJECT",
                "properties": {
                    "judgment": {"type": "STRING", "description": "150-250 words of deep strategic judgment"},
                    "riskAudit": {"type": "STRING", "description": "150-250 words of risk analysis"},
                    "emailDraft": {"type": "STRING", "description": "A ready-to-send draft starting with 'SUBJECT: '"}
                },
                "required": ["judgment", "riskAudit", "emailDraft"]
            }
        
        logger.info(f"Triggering Gemini for mode: {request.mode}")

        # Generate with Gemini using response_schema
        response = client.models.generate_content(
            model="gemini-flash-latest",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                safety_settings=[
                    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
                ]
            ),
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
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Generation Error: {str(e)}\n{error_details}")
        return {"status": "error", "message": str(e), "details": error_details}
