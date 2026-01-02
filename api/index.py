from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import os
import tempfile
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# Configure model
model = genai.GenerativeModel('gemini-1.5-flash')

@app.get("/api/ping")
def ping():
    return {"status": "pong", "message": "Server is online (Vercel Patch)"}

@app.post("/api/transmute")
async def transmute(file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        myfile = genai.upload_file(tmp_path)
        
        result = model.generate_content([
            myfile, 
            "Transcribe this audio. Return ONLY the text, no conversational filler or markdown."
        ])
        
        os.remove(tmp_path)
        return {"status": "success", "text": result.text}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/generate-post")
async def generate_post(data: dict):
    try:
        text = data.get("text", "")
        analysis = data.get("analysis", {})
        
        prompt = f"""
        ACT AS A WORLD-CLASS EXECUTIVE STRATEGIST.
        TRANSCRIPT: {text}
        TONE: {analysis.get('tone', 'Strategic')}

        GENERATE A JSON EXECUTIVE SUITE WITH THE FOLLOWING STRUCTURE:
        {{
            "free_tier": {{
                "core_thesis": "One powerful sentence summarizing the main idea",
                "strategic_pillars": [
                    {{"title": "Pillar name", "rich_description": "2-3 sentences of deep strategy"}}
                ],
                "tactical_steps": ["Step 1", "Step 2", "Step 3"]
            }},
            "pro_tier": {{
                "emphasis_audit": "One sentence on what the user is over-weighting vs under-weighting",
                "executive_judgement": "McKinsey-style high-level assessment of the strategy",
                "risk_audit": "Harsh reality check on the plan's weaknesses",
                "the_guillotine": [
                    {{"target": "Task/Idea", "verdict": "TERMINATE or DELEGATE", "reason": "Why?"}}
                ],
                "pre_mortem_risks": [
                    {{"risk": "Risk name", "likelihood": "High/Medium", "mitigation": "How to fix it"}}
                ],
                "immediate_protocols": [
                    {{"platform": "Email", "title": "Next Step", "content": "Ready-to-send draft"}}
                ]
            }}
        }}
        RETURN ONLY VALID JSON. NO MARKDOWN.
        """
        
        response = model.generate_content(prompt)
        # We return the raw text, the frontend's cleanAndParseJSON will handle it
        return response.text
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/verify-payment")
async def verify_payment(data: dict):
    reference = data.get("reference")
    if reference and (reference.startswith("T") or "-" in reference):
        return {"status": "success", "verified": True}
    return {"status": "error", "verified": False, "message": "Invalid reference"}

@app.post("/transmute")
async def transmute_alias(file: UploadFile = File(...)):
    return await transmute(file)
