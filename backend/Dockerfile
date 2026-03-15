FROM node:20-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    ln -s /usr/bin/python3 /usr/bin/python

# Install yt-dlp via pip (most stable for Railway)
RUN pip3 install --no-cache-dir -U yt-dlp --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create downloads folder with full permissions
RUN mkdir -p downloads && chmod 777 downloads

EXPOSE 8080

CMD ["node", "server.js"]
