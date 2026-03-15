FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg python3 curl && \
    ln -s /usr/bin/python3 /usr/bin/python

# Download the latest yt-dlp binary directly (the most stable way for Linux)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
