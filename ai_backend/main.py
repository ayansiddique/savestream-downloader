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

# Simple state to track bot metrics
class BotState:
    whatsapp_count = 0

state = BotState()

def get_ai_response(text: str) -> str:
    """
    Advanced response logic for SaveStream AI Assistant.
    Supports Roman Urdu/Hindi and English. 
    Includes step-by-step instructions and smart link inclusion.
    """
    msg = text.lower()
    
    # WhatsApp Logic Setup
    whatsapp_link = "https://whatsapp.com/channel/0029VbCLfMP5fM5Qug9m0S0c"
    whatsapp_promo = f"\n\nFor updates, you can also join our WhatsApp channel: {whatsapp_link}"
    
    # Decide whether to show WhatsApp link (Shown every 3rd message or on relevant questions)
    show_promo = False
    state.whatsapp_count += 1
    if state.whatsapp_count % 3 == 0:
        show_promo = True

    # Robust matching: Strip punctuation and check sets
    import re
    msg_clean = re.sub(r'[^\w\s]', '', msg)
    words = set(msg_clean.split())
    
    # 1. Greetings
    if any(w in words for w in ["hello", "hi", "hey", "asalam", "namaste", "aoa", "greetings", "salam"]):
        resp = "Assalam-o-Alaikum! Hello! I am your SaveStream AI Assistant. 🚀\n\nI can help you download videos step-by-step from 1000+ sites like YouTube, TikTok, and Instagram. How can I assist you today?"
        return resp + whatsapp_promo

    # 1.1 Thanks / Shukria
    elif any(w in words for w in ["thanks", "thank", "shukria", "shukriya", "tysm", "ty", "jazakallah", "welcome", "shuker", "shukr", "meherbani", "meharbani", "thx", "thnk"]):
        return "You're very welcome! JazakAllah! 😊 Mazeed koi madad chahiye ho toh batayein. Happy downloading with SaveStream! 🚀"

    # 2. Thumbnails & Quality (SPECIFIC - Check before general download)
    elif any(w in words for w in ["thumbnail", "thumbnails", "image", "images", "pic", "photo", "png", "jpg", "hd", "blur", "quality"]):
        resp = ("🖼️ **HD Thumbnails:**\n"
                "Humne naya feature add kiya hai! \n"
                "1. Video ka link paste karke fetch karein.\n"
                "2. 'Thumbnail' tab par jayein.\n"
                "3. 'High Quality JPG' ya 'Lossless PNG' choose karein.\n"
                "Ab aap High Definition thumbnails asani se download kar sakte hain! ✅")
        return resp + whatsapp_promo

    # 3. MP3 / Audio (SPECIFIC - Check before general download)
    elif any(w in words for w in ["mp3", "audio", "convert", "music", "gana", "gaana", "song", "awaz", "mp3s"]):
        resp = ("🎵 **MP3 Downloads:**\n"
                "Yes! Aap kisi bhi video ko MP3 (Audio) mein convert kar sakte hain.\n"
                "Video fetch karne ke baad 'Audio (.mp3)' tab select karein aur download button dabayein.")
        return resp + whatsapp_promo

    # 4. Features / Pages / About 
    elif any(w in words for w in ["feature", "features", "pages", "page", "website", "details", "function", "kaam", "about", "list"]):
        resp = ("✨ **SaveStream Features:**\n"
                "- **Multi-Platform:** YouTube, Facebook, TikTok (No Watermark), Instagram, aur 1000+ sites.\n"
                "- **High Quality:** 4K/1080p Support.\n"
                "- **Audio:** Video to MP3 Conversion.\n"
                "- **Thumbnails:** HD Quality options (JPG/PNG).\n"
                "- **Pages:** Hamare paas **Home**, **Why Choose Us**, aur **FAQ** pages hain.")
        return resp + whatsapp_promo

    # 5. Platforms / Supported Sites
    elif any(w in words for w in ["platform", "platforms", "sites", "site", "youtube", "tiktok", "twitter", "free", "cost", "yt", "fb", "insta", "supported", "which"]):
        return ("SaveStream 100% free hai! ✨\nHum YouTube, TikTok (without watermark), Instagram Reels, aur 1000+ zyada websites support karte hain. Aap kisi bhi public link ko try kar sakte hain!") + whatsapp_promo

    # 6. Social Links / Contact
    elif any(w in words for w in ["social", "whatsapp", "facebook", "insta", "contact", "link", "channel", "fb", "instagram", "number", "group"]):
        resp = (f"SaveStream se jurray rehne ke liye niche diye gaye links check karein: 📱\n"
                f"✅ WhatsApp Channel: {whatsapp_link}\n"
                f"✅ Facebook Official: https://facebook.com/SaveStream\n"
                f"✅ Instagram Page: https://instagram.com/SaveStream_official")
        return resp

    # 7. Troubleshooting
    elif any(w in words for w in ["error", "failed", "working", "masla", "problem", "connection", "nahi", "ruk", "reha", "issue"]):
        return ("🛠️ **Troubleshooting Tips:**\n"
                "- Link 'Public' hona chahiye.\n"
                "- Check karein ke URL bilkul sahi hai.\n"
                "- Page ko refresh karke dobara koshish karein.\n"
                "- Check karein ke internet connection sahi ho.") + whatsapp_promo

    # 8. Main Download Instructions (GENERAL - If nothing else matches)
    elif any(w in words for w in ["download", "downloading", "how", "kaise", "step", "tarika", "tareeka", "method", "load", "video"]):
        resp = ("✅ **Video Download Karne Ka Tarika:**\n"
                "1. Video ka link copy karke box mein paste karein.\n"
                "2. 'Fetch Video' par click karein.\n"
                "3. Tab (Video, Audio, ya Thumbnail) select karein.\n"
                "4. Download button par click karein.\n\n"
                "Ji hamari website se downloads bohat asan hain! 🚀")
        return resp + whatsapp_promo

    # Fallback
    else:
        return "I am your SaveStream Assistant. I can help with Downloads, MP3, HD Thumbnails, and troubleshooting. Ask me 'How to download' or about 'Features'!"

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
        # Try different encodings for Windows compatibility
        encodings = ['utf-8', 'utf-16', 'latin-1']
        lines = []
        for enc in encodings:
            try:
                with open(log_file, "r", encoding=enc) as file:
                    lines = file.readlines()
                break
            except (UnicodeDecodeError, Exception):
                continue
        
        if not lines:
             return {"error_detected": False, "message": "Log file empty or unreadable"}

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
