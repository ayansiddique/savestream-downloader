FROM node:20

# Install Python, Pip, and FFmpeg
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    ln -s /usr/bin/python3 /usr/bin/python

# Install latest yt-dlp via pip3 (most reliable for Railway Linux)
# Using --break-system-packages for modern Debian/Node images
RUN pip3 install --no-cache-dir -U yt-dlp --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose port 8080 (Railway will map the dynamic port here)
EXPOSE 8080

CMD ["node", "server.js"]
