FROM node:20-slim

# Install system dependencies with extra packages for stealth and SSL
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl brotli ca-certificates && \
    update-ca-certificates && \
    ln -s /usr/bin/python3 /usr/bin/python

# Install yt-dlp with specific extras for faster and more reliable extraction
RUN pip3 install --no-cache-dir -U yt-dlp[default] brotli ujson certifi --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Ensure directory exist
RUN mkdir -p downloads && chmod 777 downloads

EXPOSE 8080

CMD ["node", "server.js"]
