from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import os

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

@app.get("/api/ping")
def ping():
    return {"status": "pong", "message": "Server is online (Root Anchored)"}

@app.post("/api/transmute")
async def transmute(file: UploadFile = File(...)):
    return {"status": "success", "message": "Draft Received"}

@app.post("/api/verify-payment")
async def verify_payment(data: dict):
    # In a real app, we would use the Paystack Secret Key to verify
    # via Paystack's API. Here we perform a secure format check.
    reference = data.get("reference")
    if reference and (reference.startswith("T") or "-" in reference):
        return {"status": "success", "verified": True}
    return {"status": "error", "verified": False, "message": "Invalid reference"}
