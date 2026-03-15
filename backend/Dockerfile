FROM node:20

# Install Python, FFmpeg, and other dependencies
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    ln -s /usr/bin/python3 /usr/bin/python

# Install and force-update yt-dlp to the latest version
RUN pip3 install --no-cache-dir -U yt-dlp --break-system-packages
RUN yt-dlp -U

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
