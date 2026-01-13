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

# Initialize Client (Gemini 2.5 Flash)
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
            model="gemini-1.5-flash-002",
            config=types.GenerateContentConfig(
                safety_settings=[
                    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
                ]
            ),
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                """You are an elite Chief of Staff serving global C-suite executives. Your executives operate across borders and speak multiple languages. They need strategic clarity in English, regardless of input language.

This audio recording may be in ANY language (English, Spanish, French, Mandarin, Arabic, Portuguese, German, Japanese, Hindi, etc.).

YOUR PROCESS:

STEP 1 - TRANSCRIBE ACCURATELY:
- Listen carefully and transcribe EXACTLY what was said
- Preserve the executive's original language
- Maintain nuance, tone, and strategic intent
- If there are multiple languages mixed (code-switching), handle both

STEP 2 - TRANSLATE TO ENGLISH (if needed):
- If the audio is NOT in English, translate it to English
- Preserve executive voice and strategic intent
- Don't over-formalize - keep the natural thinking style
- Maintain technical terms and business jargon appropriately

STEP 3 - EXTRACT CORE THESIS (Chief of Staff Intelligence):
Now, regardless of original language, distill this into a strategic brief in English.
Your executive is brilliant but their thoughts are scattered. What is the ONE core strategic insight here?
- Distill into a single, powerful Core Thesis statement (30-60 words)
- This should be Board-meeting caliber
- Format: Clear subject + strategic insight + why it matters now
- Think: "The strategic opportunity in [X] is [Y], which positions us to [Z]"

STEP 4 - IDENTIFY STRATEGIC PILLARS:
What are the 3-5 key strategic levers that make this thesis actionable?
- Each pillar should be a strategic driver (not a task list)
- Format: Bold strategic statement + 1-2 sentences of Chief of Staff-level analysis
- Think McKinsey/BCG framework quality

STEP 5 - CLASSIFY EXECUTIVE STATE:
Analyze the tone, pace, and content. Classify as ONE of:
- Reflective (thinking out loud, exploring)
- Decisive (clear directives, action-oriented)
- Analytical (data-driven, logical)
- Urgent (time-sensitive, high stakes)
- Strategic (long-term, big picture)
- Operational (execution-focused, tactical)

OUTPUT REQUIREMENTS:
Return ONLY valid JSON with this exact structure:
{
  "transcription": "The full english transcription of the audio...",
  "core_thesis": "The core thesis statement...",
  "strategic_pillars": [
      {"title": "Bold Strategic Statement", "description": "1-2 sentences of analysis..."}
  ],
  "tactical_steps": [
    "Step 1: concrete actionable item",
    "Step 2: concrete actionable item",
    "Step 3: concrete actionable item"
  ],
  "executive_state": "Reflective"
}

TONE: Confident. Analytical. Executive-grade. Zero fluff. This is what a $300K/year Chief of Staff would produce.

EXAMPLES OF LANGUAGE HANDLING:

If executive says in Spanish:
"Necesitamos cambiar nuestra estrategia de precios porque Amazon está bajando sus tarifas un 15%"
You produce logic for:
CORE THESIS: "The strategic imperative in pricing restructuring lies in responding to Amazon's 15% tariff reduction, positioning our value proposition to retain margin while maintaining competitive relevance in a commoditizing market."

If executive says in French:
"Je pense que notre problème n'est pas le produit mais notre go-to-market est complètement cassé"
You produce logic for:
CORE THESIS: "The core strategic challenge is not product-market fit but go-to-market execution dysfunction, which masks underlying product strengths and creates false signals about market demand."

CRITICAL: The output quality should be IDENTICAL whether the executive speaks in English, Spanish, Mandarin, or any other language. World-class Chief of Staff intelligence, always."""
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
        # Remove markdown code blocks and any trailing/leading whitespace/newlines
        json_str = re.sub(r'```json\s*|\s*```', '', text, flags=re.MULTILINE).strip()
        
        # If there's preamble text before the first '{', strip it
        start_idx = json_str.find('{')
        end_idx = json_str.rfind('}')
        
        if start_idx != -1 and end_idx != -1:
            json_str = json_str[start_idx:end_idx + 1]
            
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
            Format this transcription into a Wall Street Journal style strategic brief with:
            1) Core Thesis (main strategic argument)
            2) Pillars (3-5 supporting strategic points, each with a title and deep-dive description)
            3) Tactical Steps (3-5 concrete, actionable execution items)

            Text to analyze: {request.text}

            Return ONLY a valid JSON object with keys: 
            - "core_thesis": string
            - "strategic_pillars": list of objects with "title" (string) and "description" (string)
            - "tactical_steps": list of strings

            Direct output only. No markdown formatting.
            """
        else: # strategist
            prompt = f"""
            {industry_context}
            You are an elite Chief of Staff specializing in {request.industry if request.industry else 'global business'}. 
            You think 3-5 chess moves ahead. You see what others miss.

            Analyze this transcription and provide THREE critical deliverables:

            1) JUDGMENT: What is the REAL strategic challenge here? (150-250 words)
            2) RISK AUDIT: What are the primary and hidden risks? (150-250 words)
            3) EMAIL DRAFT: A ready-to-send draft for stakeholders. Include "SUBJECT: " at the top.

            Text to analyze: {request.text}

            Return ONLY a valid JSON object with this EXACT structure:
            {{
              "judgment": "judgment text here",
              "riskAudit": "risk audit text here",
              "emailDraft": "SUBJECT: Subject line here\\n\\nEmail body here"
            }}

            No markdown. No bolding. No preamble. Pure intelligence.
            """
        
        logger.info(f"Triggering Gemini for mode: {request.mode}")

        # Generate with Gemini
        response = client.models.generate_content(
            model="gemini-1.5-flash-002",
            config=types.GenerateContentConfig(
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
