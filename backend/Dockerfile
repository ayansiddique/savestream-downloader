FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg python3 curl && \
    ln -s /usr/bin/python3 /usr/bin/python

# Download the latest yt-dlp binary directly (standalone version)
# This is often more stable than the pip version in Docker
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Permissions for the downloads directory
RUN mkdir -p downloads && chmod 777 downloads

EXPOSE 8080

CMD ["node", "server.js"]
