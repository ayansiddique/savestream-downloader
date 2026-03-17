import os
import time
import requests
import subprocess
import socket
from datetime import datetime
import sys

# Forces UTF-8 for everything to avoid Windows charmap errors
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# Configuration
BASE_DIR = r"c:\Users\786\Pictures\free vedio downloader"
AI_SERVER_COMMAND = ["python", "-m", "uvicorn", "main:app", "--port", "8000", "--host", "127.0.0.1"]
AI_SERVER_URL = "http://127.0.0.1:8000/check-errors"
LOG_FILE = os.path.join(BASE_DIR, "ai_backend", "monitor.log")

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{timestamp}] {message}"
    try:
        print(entry)
    except:
        pass
        
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(entry + "\n")

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_ai_server():
    log("Starting SaveStream AI Server...")
    # Use shell=True for Windows compatibility
    ai_dir = os.path.join(BASE_DIR, "ai_backend")
    process = subprocess.Popen(AI_SERVER_COMMAND, cwd=ai_dir, shell=True)
    return process

def main():
    log("SaveStream Smart Monitor Started (100% Efficiency Target)")
    process = None
    
    while True:
        try:
            # Check server health via endpoint (most reliable indicator)
            is_online = False
            data = {}
            try:
                response = requests.get(AI_SERVER_URL, timeout=3)
                if response.status_code == 200:
                    is_online = True
                    data = response.json()
            except:
                is_online = False

            if not is_online:
                log("SYSTEM ISSUE: AI Server unreachable. Restarting...")
                # Kill existing if any (clean start)
                if process:
                    try: process.terminate()
                    except: pass
                process = start_ai_server()
                time.sleep(15) # Wait longer for uvicorn to bind
                continue

            # If online, parse health data
            if data.get("error_detected"):
                log(f"HEALTH MONITOR: ISSUE -> {data['explanation']}")
                fix_cmd = data.get('suggested_fix', '').upper()
                
                if "RESTART" in fix_cmd:
                    log("AUTO-FIX: Restarting AI Backend...")
                    if process:
                        try: process.terminate()
                        except: pass
                    process = start_ai_server()
                    time.sleep(5)
                
                elif "CLEAR_CACHE" in fix_cmd:
                    log("AUTO-FIX: Detected YouTube Block. Clearing yt-dlp cache...")
                    try:
                        yt_binary = os.path.join(BASE_DIR, "backend", "node_modules", "yt-dlp-exec", "bin", "yt-dlp.exe")
                        if os.path.exists(yt_binary):
                            subprocess.run([yt_binary, "--rm-cache-dir"], check=True, capture_output=True)
                            log("CACHE CLEAR: Success using absolute path.")
                        else:
                            subprocess.run(["yt-dlp", "--rm-cache-dir"], check=True, capture_output=True)
                            log("CACHE CLEAR: Success using PATH fallback.")
                    except Exception as e:
                        log(f"CACHE CLEAR: Failed -> {str(e)}")

                log("FIX ACTION COMPLETE.")

        except Exception as e:
            log(f"CRITICAL MONITOR ERROR: {str(e)}")
        
        # Check every 30 seconds
        time.sleep(30)

if __name__ == "__main__":
    main()
