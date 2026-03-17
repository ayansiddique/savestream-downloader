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

# Simple state to track WhatsApp link inclusion (in a real app, this would be per session)
whatsapp_count = 0

def get_ai_response(text: str) -> str:
    """
    Advanced response logic for SaveStream AI Assistant.
    Supports Roman Urdu/Hindi and English. 
    Includes step-by-step instructions and smart link inclusion.
    """
    global whatsapp_count
    msg = text.lower()
    
    # WhatsApp Logic Setup
    whatsapp_link = "https://whatsapp.com/channel/0029VbCLfMP5fM5Qug9m0S0c"
    whatsapp_promo = f"\n\nFor updates, you can also join our WhatsApp channel: {whatsapp_link}"
    
    # Decide whether to show WhatsApp link (Shown every 3rd message or on relevant questions)
    show_promo = False
    whatsapp_count += 1
    if whatsapp_count % 3 == 0:
        show_promo = True

    # 1. Greetings
    if any(word in msg for word in ["hello", "hi", "hey", "asalam", "namaste"]):
        resp = "Hello! I am your SaveStream AI Assistant. I can help you download videos step-by-step. How can I assist you today?"
        return resp + (whatsapp_promo if show_promo else "")

    # 2. Main Download Instructions (Multilingual)
    elif any(phrase in msg for phrase in ["how to download", "download kaise", "kaise kare", "step", "tarika", "tareeka", "downloading process"]):
        resp = ("To download a video, please follow these steps:\n"
                "1. Copy the video URL from any platform.\n"
                "2. Paste it into the input box on our homepage.\n"
                "3. Click the 'Fetch Video' button.\n"
                "4. Choose your preferred format: MP4 (Video) or MP3 (Audio).\n"
                "5. Click 'Download' to save the file.")
        # Always prioritize WhatsApp link for the main "How-to" question if it hasn't been shown much
        return resp + whatsapp_promo if (show_promo or whatsapp_count < 2) else resp

    # 3. MP3 / Audio Converting
    elif any(word in msg for word in ["mp3", "audio", "convert", "music", "gana", "gaana"]):
        resp = ("Yes! You can definitely download MP3. Just paste your link, click 'Fetch Video', and then select the 'Audio (.mp3)' tab before clicking Download.")
        return resp

    # 4. Thumbnails & Quality
    elif any(word in msg for word in ["thumbnail", "image", "pic", "photo", "png", "jpg"]):
        resp = ("Our new update allows you to download Thumbnails in HD quality!\n"
                "1. Fetch the video.\n"
                "2. Go to the 'Thumbnail' tab.\n"
                "3. Choose 'High Quality JPG' or 'Lossless PNG'.\n"
                "We automatically select the highest possible resolution from the platform to avoid blurriness.")
        return resp

    # 5. Troubleshooting (Why not working?)
    elif any(phrase in msg for phrase in ["not working", "error", "failed", "download nahi", "masla", "problem", "nahi ho raha", "connection"]):
        return ("If you see a Connection Error, please ensure the Python AI Backend is running on your server.\n"
                "For download issues:\n"
                "- Private videos cannot be downloaded.\n"
                "- Check if the URL is correct.\n"
                "- Refresh the page and try again.")

    # 5. Platforms & Features
    elif any(word in msg for word in ["platform", "sites", "youtube", "tiktok", "insta", "facebook", "twitter", "free", "cost"]):
        return ("SaveStream supports 1000+ platforms including YouTube, TikTok, and Instagram. It is 100% free with no installation required!")

    # 6. Unrelated questions
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
