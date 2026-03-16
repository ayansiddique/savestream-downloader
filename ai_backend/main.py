from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import asyncio

app = FastAPI(
    title="SaveStream AI Assistant",
    description="Backend Server for the SaveStream Floating AI Assistant"
)

# Enable CORS so the main website can access this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model for chat
class ChatRequest(BaseModel):
    message: str

@app.get("/")
def read_root():
    return {"status": "SaveStream AI server running"}

def get_ai_response(text: str) -> str:
    """
    Intelligent response logic for the SaveStream Downloader assistant.
    Includes regular help and troubleshooting tips.
    """
    msg = text.lower()
    
    # Greetings
    if "hello" in msg or "hi" in msg or "hey" in msg:
        return "Hello there! I am your SaveStream AI Assistant. How can I help you with downloading today?"
        
    # Download instructions
    elif "how" in msg and "download" in msg:
        return "It's easy! \n1. Copy the video URL.\n2. Paste it into the input box.\n3. Click 'Fetch Video'.\n4. Choose MP4 (Video) or MP3 (Audio).\n5. Click Download!"
        
    # Supported formats (MP3/MP4)
    elif "mp3" in msg or "audio" in msg or "music" in msg:
        return "Yes, you can extract and download high-quality MP3 audio from videos. Just click the 'Audio (.mp3)' tab after fetching the video."
    
    elif "mp4" in msg or "video" in msg or "format" in msg:
        return "We support MP4 video downloads in various qualities, from 360p up to 1080p Full HD!"

    # Allowed platforms
    elif "platform" in msg or "youtube" in msg or "tiktok" in msg or "instagram" in msg or "facebook" in msg:
        return "SaveStream Downloader supports over 1000+ platforms including YouTube, TikTok, Instagram, Reddit, Facebook, and Twitter."

    # Pricing
    elif "cost" in msg or "free" in msg or "pay" in msg:
        return "SaveStream is a 100% free tool! No payments, no hidden fees, and no installation required."

    # Troubleshooting & Errors
    elif "not downloading" in msg or "error" in msg or "failed" in msg or "doesn't work" in msg:
        return "I'm sorry you are having trouble. Here are a few possible causes:\n- The video might be private or region-locked.\n- The platform might be temporarily blocking requests.\n- The link might be incorrect.\n\nTry refreshing the page or testing a different video link!"
        
    elif "slow" in msg or "stuck" in msg:
        return "If the download is slow, it might be due to server load or network speed. Try pausing and resuming, or check your internet connection."

    # Out of scope fallback
    else:
        return "I can only answer questions related to SaveStream Downloader. Check the suggested questions or ask me how to download!"

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Accepts user questions and returns a simulated AI text response.
    """
    response_text = get_ai_response(request.message)
    # Simulate a slight "AI thinking delay" to make the typing effect look more natural on frontend
    await asyncio.sleep(0.5)
    return {"response": response_text}

@app.get("/check-errors")
def check_errors_endpoint():
    """
    Scans the local server.log file for error keywords and provides structured feedback.
    """
    error_keywords = ["ERROR", "FAILED", "CRASH", "EXCEPTION", "TIMEOUT"]
    log_file = "server.log"
    
    if not os.path.exists(log_file):
        return {
            "error_detected": False,
            "message": "System running normally"
        }
        
    try:
        with open(log_file, "r", encoding="utf-8") as file:
            lines = file.readlines()
            
        for line in reversed(lines):
            upper_line = line.upper()
            for keyword in error_keywords:
                if keyword in upper_line:
                    
                    if keyword == "TIMEOUT":
                        cause = "A request to an external server timed out."
                        fix = "Check internet status or restart the specific process."
                    elif keyword == "CRASH":
                        cause = "A critical failure caused the server to crash."
                        fix = "Check server memory and restart the backend."
                    elif keyword == "FAILED":
                        cause = "The download or fetch process failed."
                        fix = "Verify the target URL or check if the platform is blocking bots."
                    else:
                        cause = "A generic software exception was caught."
                        fix = "Review the recent application logs for traceability."

                    return {
                        "error_detected": True,
                        "explanation": f"Log flagged a '{keyword}' issue.",
                        "possible_cause": cause,
                        "suggested_fix": fix
                    }
                    
        return {
            "error_detected": False,
            "message": "System running normally"
        }
        
    except Exception as e:
        return {
            "error_detected": True,
            "explanation": "Log file parsing failed.",
            "possible_cause": f"System error reading the file: {str(e)}",
            "suggested_fix": "Ensure correct file permissions."
        }
