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
AI_SERVER_COMMAND = ["python", "-m", "uvicorn", "main:app", "--port", "8000", "--host", "127.0.0.1"]
AI_SERVER_URL = "http://127.0.0.1:8000/check-errors"
LOG_FILE = "monitor.log"

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{timestamp}] {message}"
    try:
        print(entry)
    except:
        print(entry.encode('ascii', 'ignore').decode('ascii'))
        
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(entry + "\n")

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_ai_server():
    log("Starting SaveStream AI Server...")
    # Run uvicorn in a separate process
    process = subprocess.Popen(AI_SERVER_COMMAND, cwd=os.getcwd())
    return process

def main():
    log("SaveStream Smart Monitor Started (100% Efficiency Target)")
    process = None
    
    while True:
        try:
            # 1. Check if server is running on port 8000
            if not is_port_in_use(8000):
                log("SYSTEM ISSUE: AI Server is OFFLINE. Restarting now...")
                process = start_ai_server()
                time.sleep(5) # Wait for startup
            
            # 2. Daily Health Check via /check-errors endpoint
            try:
                response = requests.get(AI_SERVER_URL, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("error_detected"):
                        log(f"HEALTH MONITOR: ISSUE DETECTED -> {data['explanation']}")
                        log(f"Possible Cause: {data['possible_cause']}")
                        log(f"Fixing: Attempting '{data['suggested_fix']}' automatically...")
                        
                        # Auto-Fix Implementation
                        fix_cmd = data['suggested_fix'].upper()
                        if "RESTART" in fix_cmd:
                            curr_proc = process
                            if curr_proc is not None:
                                try:
                                    curr_proc.terminate()
                                    curr_proc.wait(timeout=5)
                                except:
                                    pass
                                time.sleep(2)
                            process = start_ai_server()
                        
                        elif "CLEAR_CACHE" in fix_cmd:
                            log("AUTO-FIX: Detected YouTube Block. Clearing yt-dlp cache...")
                            try:
                                # Run cache clear command
                                subprocess.run(["yt-dlp", "--rm-cache-dir"], check=True, capture_output=True)
                                log("CACHE CLEAR: Success. System should be able to retry now.")
                            except Exception as e:
                                log(f"CACHE CLEAR: Failed -> {str(e)}")

                        log("FIX ACTION COMPLETE.")
                    else:
                        pass # System is healthy
                else:
                    log(f"WARN: Health Check status: {response.status_code}")
            except requests.exceptions.RequestException:
                log("WARN: AI Server unreachable. Might be busy.")

        except Exception as e:
            log(f"CRITICAL MONITOR ERROR: {str(e)}")
        
        # Check every 30 seconds
        time.sleep(30)

if __name__ == "__main__":
    main()
