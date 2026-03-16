FROM node:20-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl brotli ca-certificates && \
    update-ca-certificates && \
    ln -s /usr/bin/python3 /usr/bin/python

# Install latest yt-dlp
RUN pip3 install --no-cache-dir -U yt-dlp[default] brotli ujson certifi --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Ensure directories exist
RUN mkdir -p downloads && chmod 777 downloads
RUN mkdir -p cookies && chmod 777 cookies

EXPOSE 8080

CMD ["node", "server.js"]
