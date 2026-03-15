FROM node:20-slim

# Install system dependencies with extra packages for stealth
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl brotli && \
    ln -s /usr/bin/python3 /usr/bin/python

# Install yt-dlp and recommended extras for better extraction
RUN pip3 install --no-cache-dir -U yt-dlp[default] --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Ensure directory exist
RUN mkdir -p downloads && chmod 777 downloads

EXPOSE 8080

CMD ["node", "server.js"]
