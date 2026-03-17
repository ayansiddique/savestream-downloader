// SaveStream AI Features Widget
// Inject this file into your main website index.html

(function() {
    // ------------------------------------------------------------------------
    // STYLES (Self-injected to avoid requiring external CSS)
    // ---------------------------------------------------------
    const style = document.createElement('style');
    style.innerHTML = `
        /* Floating Button */
        #savestream-ai-btn {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: linear-gradient(135deg, #c471ed, #f64f59);
            color: #ffffff;
            border: none;
            border-radius: 9999px;
            padding: 14px 24px;
            font-size: 16px;
            font-weight: 700;
            box-shadow: 0 10px 15px -3px rgba(196, 113, 237, 0.4);
            cursor: pointer;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            font-family: inherit;
        }

        #savestream-ai-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 14px 20px -3px rgba(246, 79, 89, 0.4);
        }

        /* Chat Window Container */
        #savestream-ai-window {
            position: fixed;
            bottom: 90px;
            right: 24px;
            width: 380px;
            height: 550px;
            background-color: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            z-index: 9999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.2);
            font-family: inherit;
            animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Header */
        #savestream-ai-header {
            background: linear-gradient(135deg, #121025, #1e1b3b);
            color: white;
            padding: 16px 20px;
            font-weight: 600;
            font-size: 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            line-height: 1;
        }

        /* Chat Area */
        #savestream-ai-chat-box {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background-color: #f8fafc;
        }

        /* Messages */
        .ai-msg, .user-msg {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 14.5px;
            line-height: 1.5;
            word-wrap: break-word;
        }

        .ai-msg {
            background-color: #ffffff;
            color: #1e293b;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .user-msg {
            background: linear-gradient(135deg, #c471ed, #f64f59);
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
            box-shadow: 0 4px 6px -1px rgba(246, 79, 89, 0.2);
        }

        /* Typing Indicator */
        .typing-indicator {
            font-size: 13px;
            color: #64748b;
            align-self: flex-start;
            font-style: italic;
            display: none;
            margin-left: 8px;
        }

        /* Smart Suggestions */
        .suggestions-container {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 5px;
        }
        
        .suggestion-btn {
            background: #e2e8f0;
            border: none;
            color: #334155;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 13px;
            cursor: pointer;
            text-align: left;
            transition: background 0.2s;
            align-self: flex-start;
        }
        
        .suggestion-btn:hover {
            background: #cbd5e1;
        }

        /* Input Area */
        #savestream-ai-input-area {
            display: flex;
            padding: 16px;
            background-color: #ffffff;
            border-top: 1px solid #e2e8f0;
            gap: 10px;
        }

        #savestream-ai-input {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid #cbd5e1;
            border-radius: 9999px;
            outline: none;
            font-size: 14px;
            transition: border-color 0.2s;
        }

        #savestream-ai-input:focus {
            border-color: #c471ed;
        }

        #savestream-ai-send-btn {
            background: linear-gradient(135deg, #c471ed, #f64f59);
            color: white;
            border: none;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            cursor: pointer;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        }

        #savestream-ai-send-btn:hover {
            transform: scale(1.05);
        }

        #savestream-ai-send-btn:disabled {
            background: #cbd5e1;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        @media (max-width: 480px) {
            #savestream-ai-window {
                width: calc(100% - 32px);
                right: 16px;
                bottom: 80px;
                height: 500px;
            }
            #savestream-ai-btn {
                bottom: 16px;
                right: 16px;
            }
        }
    `;
    document.head.appendChild(style);


    // ------------------------------------------------------------------------
    // HTML STRUCTURE INJECTION
    // ---------------------------------------------------------
    
    // 1. Floating Button
    const floatBtn = document.createElement('button');
    floatBtn.id = 'savestream-ai-btn';
    floatBtn.innerHTML = `
        <svg fill="currentColor" viewBox="0 0 24 24" width="20" height="20">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-1H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 12 2zm-1 8a5 5 0 0 0-5 5v5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5a5 5 0 0 0-5-5h-2zM9 13a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
        </svg>
        Ask AI
    `;
    document.body.appendChild(floatBtn);

    // 2. Chat Window Container
    const chatWindow = document.createElement('div');
    chatWindow.id = 'savestream-ai-window';
    chatWindow.innerHTML = `
        <div id="savestream-ai-header">
            <span>✨ SaveStream AI</span>
            <button class="close-btn" id="savestream-ai-close">&times;</button>
        </div>
        
        <div id="savestream-ai-chat-box">
            <!-- Initial Greeting -->
            <div class="ai-msg">Hi! I'm the SaveStream AI. How can I help you?</div>
            
            <!-- Smart Suggestions -->
            <div class="suggestions-container" id="ai-suggestions">
                <button class="suggestion-btn">How do I download a video?</button>
                <button class="suggestion-btn">Can I download MP3?</button>
                <button class="suggestion-btn">Video not downloading</button>
            </div>
            
            <div class="typing-indicator" id="ai-typing">AI is typing...</div>
        </div>
        
        <div id="savestream-ai-input-area">
            <input type="text" id="savestream-ai-input" placeholder="Type a message..." autocomplete="off">
            <button id="savestream-ai-send-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
    `;
    document.body.appendChild(chatWindow);


    // ------------------------------------------------------------------------
    // LOGIC & EVENTS
    // ---------------------------------------------------------
    const closeBtn = document.getElementById('savestream-ai-close');
    const chatBox = document.getElementById('savestream-ai-chat-box');
    const inputBox = document.getElementById('savestream-ai-input');
    const sendBtn = document.getElementById('savestream-ai-send-btn');
    const typingIndicator = document.getElementById('ai-typing');
    const suggestionsDiv = document.getElementById('ai-suggestions');
    
    // The backend API URL
    const AI_BACKEND_URL = "http://127.0.0.1:8000/chat";

    // Toggle Chat Window
    floatBtn.addEventListener('click', () => {
        chatWindow.style.display = chatWindow.style.display === 'flex' ? 'none' : 'flex';
        if (chatWindow.style.display === 'flex') inputBox.focus();
    });

    closeBtn.addEventListener('click', () => {
        chatWindow.style.display = 'none';
    });

    // Helper: Append a completely styled message bubble
    function appendMessage(text, isAI) {
        const msgDiv = document.createElement('div');
        msgDiv.className = isAI ? 'ai-msg' : 'user-msg';
        msgDiv.textContent = text; // Set the content!
        
        // Hide smart suggestions once the conversation actually starts
        if (!isAI && suggestionsDiv) {
            suggestionsDiv.style.display = 'none';
        }

        // The typing indicator should always be at the very bottom
        chatBox.insertBefore(msgDiv, typingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        return msgDiv;
    }

    // Helper: Live Typing Effect (Letter by Letter)
    async function typeMessage(element, text, speed = 15) {
        element.textContent = "";
        for (let i = 0; i < text.length; i++) {
            element.textContent += text.charAt(i);
            chatBox.scrollTop = chatBox.scrollHeight; // Keep scrolling down
            await new Promise(r => setTimeout(r, speed));
        }
    }

    // Core Send Function
    async function sendMessage(text) {
        text = text.trim();
        if (!text) return;

        // Display user message
        appendMessage(text, false);
        inputBox.value = '';
        inputBox.disabled = true;
        sendBtn.disabled = true;

        // Show typing indicator
        typingIndicator.style.display = 'block';
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            // Fetch AI Response
            const response = await fetch(AI_BACKEND_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok) throw new Error("Server disconnected");

            const data = await response.json();
            
            // Hide typing indicator
            typingIndicator.style.display = 'none';
            
            // Create an empty AI message div
            const msgDiv = appendMessage("", true);
            
            // Start the live typing effect
            await typeMessage(msgDiv, data.response);

        } catch (e) {
            typingIndicator.style.display = 'none';
            const msgDiv = appendMessage("", true);
            await typeMessage(msgDiv, "Connection error. Make sure the FastAPI Python backend is currently running.");
        } finally {
            inputBox.disabled = false;
            sendBtn.disabled = false;
            inputBox.focus();
        }
    }

    // Event binding: Send Button & Enter Key
    sendBtn.addEventListener('click', () => sendMessage(inputBox.value));
    inputBox.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage(inputBox.value);
    });

    // Event binding: Smart Suggestions Click
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            sendMessage(e.target.textContent);
        });
    });

})();
